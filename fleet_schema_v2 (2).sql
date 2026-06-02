-- =====================================================================
-- GEE DRIVE MOTORS FLEET MANAGEMENT SYSTEM
-- PHASE 1: DATABASE ARCHITECTURE & SCHEMA DESIGN (V2.0)
-- IDEMPOTENT DEPLOYMENT SCRIPT
-- Fixed: NULLABLE syntax, health score formula, driver performance formula,
--        needs_service logic, status constraint values, nrc_exists function
-- =====================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. CORE TABLES
-- =====================================================================

-- Cars Registry
CREATE TABLE IF NOT EXISTS public.cars (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number        VARCHAR(20)  UNIQUE NOT NULL,
    model               VARCHAR(100) NOT NULL,
    passenger_capacity  INTEGER      NOT NULL CHECK (passenger_capacity > 0),
    initial_mileage     NUMERIC(10,1) NOT NULL DEFAULT 0.0,
    last_serviced       DATE,                        -- NULL = never serviced
    registration_date   DATE         NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'decommissioned')),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Car Decommissions (replaces Decommissioned Vehicles sheet)
-- ON DELETE RESTRICT: prevents orphan decommission records
CREATE TABLE IF NOT EXISTS public.car_decommissions (
    id                              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id                          UUID          NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
    decommission_date               DATE          NOT NULL,
    reason                          TEXT          NOT NULL,
    final_mileage                   NUMERIC(10,1) NOT NULL,
    total_revenue_at_decommission   NUMERIC(12,2) NOT NULL,
    created_at                      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Drivers Registry
-- NOTE: nrc_number is the primary business identity key per GAS system design.
--       status uses lowercase values ('active'/'terminated') — migration script
--       must normalise GAS values ('Active' -> 'active', 'Inactive' -> 'terminated').
CREATE TABLE IF NOT EXISTS public.drivers (
    id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    email                   VARCHAR(255) UNIQUE NOT NULL,
    phone                   VARCHAR(30)  NOT NULL,
    nrc_number              VARCHAR(50)  UNIQUE NOT NULL,
    license_number          VARCHAR(50)  NOT NULL,
    license_expiry          DATE         NOT NULL,
    next_of_kin_name        VARCHAR(200) NOT NULL,
    next_of_kin_relationship VARCHAR(50) NOT NULL,
    next_of_kin_phone       VARCHAR(30)  NOT NULL,
    next_of_kin_email       VARCHAR(255),            -- optional
    status                  VARCHAR(20)  NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'terminated')),
    registration_date       DATE         NOT NULL,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Driver Documents (replaces inline Google Drive URL columns)
-- Supports versioning: a driver can have multiple document revisions.
-- storage_path references the Supabase Storage bucket path, not a public URL.
CREATE TABLE IF NOT EXISTS public.driver_documents (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id         UUID         NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
    document_type     VARCHAR(20)  NOT NULL CHECK (document_type IN ('nrc', 'license')),
    storage_path      TEXT         NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type         VARCHAR(100) NOT NULL,
    uploaded_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Driver Terminations (replaces Driver Terminations sheet)
CREATE TABLE IF NOT EXISTS public.driver_terminations (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id         UUID        NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
    termination_date  DATE        NOT NULL,
    reason            TEXT        NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly Logs — immutable transactional ledger
-- total_mileage and net_revenue are GENERATED ALWAYS columns: they are computed
-- from raw inputs on every read. This means no historical record can be silently
-- corrupted if the calculation formula changes in application code.
-- CONSTRAINT: closing_mileage > start_mileage enforced at DB level,
--             matching the Pydantic validator in the FastAPI layer.
CREATE TABLE IF NOT EXISTS public.weekly_logs (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id           UUID          NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
    driver_id        UUID          NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
    week_start_date  DATE          NOT NULL,
    year             INTEGER       NOT NULL,          -- retained for fast year-partitioned queries
    start_mileage    NUMERIC(10,1) NOT NULL,
    closing_mileage  NUMERIC(10,1) NOT NULL,
    total_mileage    NUMERIC(10,1) GENERATED ALWAYS AS (closing_mileage - start_mileage) STORED,
    total_revenue    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    shortage         NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    expense_on_car   NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    net_revenue      NUMERIC(12,2) GENERATED ALWAYS AS (total_revenue - expense_on_car - shortage) STORED,
    spares_bought    TEXT,                            -- optional
    spares_cost      NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    comments         TEXT,                            -- optional
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT chk_mileage_progression CHECK (closing_mileage > start_mileage),
    CONSTRAINT chk_non_negative_revenue  CHECK (total_revenue  >= 0),
    CONSTRAINT chk_non_negative_shortage CHECK (shortage       >= 0),
    CONSTRAINT chk_non_negative_expense  CHECK (expense_on_car >= 0),
    CONSTRAINT chk_non_negative_spares   CHECK (spares_cost    >= 0)
);

-- =====================================================================
-- 2. INDEXING STRATEGY
-- Targets <100ms analytical view queries at operational scale.
-- All indexes mirror the GROUP BY and WHERE patterns in the views below.
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_weekly_logs_car_id        ON public.weekly_logs(car_id);
CREATE INDEX IF NOT EXISTS idx_weekly_logs_driver_id     ON public.weekly_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_weekly_logs_week_start    ON public.weekly_logs(week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_logs_year          ON public.weekly_logs(year);
CREATE INDEX IF NOT EXISTS idx_drivers_nrc_number        ON public.drivers(nrc_number);
CREATE INDEX IF NOT EXISTS idx_drivers_last_name         ON public.drivers(last_name);
CREATE INDEX IF NOT EXISTS idx_cars_plate_number         ON public.cars(plate_number);
CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_uploaded_at
    ON public.driver_documents(driver_id, uploaded_at);

-- Composite index for the needs_service correlated subquery in view_car_analytics
-- (car_id, week_start_date) covers the WHERE wl2.car_id = c.id AND wl2.week_start_date > c.last_serviced filter
CREATE INDEX IF NOT EXISTS idx_weekly_logs_car_date ON public.weekly_logs(car_id, week_start_date);

-- =====================================================================
-- 3. HELPER FUNCTION
-- =====================================================================

-- NRC existence check — used by the FastAPI /drivers/check-nrc endpoint.
-- STABLE: Postgres can cache the result within a single query.
-- Index on nrc_number (above) makes this an index scan, not a seq scan.
CREATE OR REPLACE FUNCTION public.nrc_exists(p_nrc VARCHAR)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM public.drivers WHERE nrc_number = p_nrc);
$$ LANGUAGE SQL STABLE;

-- =====================================================================
-- 4. ANALYTICAL VIEWS
-- DEPENDENCY ORDER (must not be changed):
--   1. view_car_analytics       (no view dependencies)
--   2. view_driver_analytics    (no view dependencies)
--   3. view_dashboard_summary   (depends on view_car_analytics)
--   4. view_financial_analysis  (no view dependencies)
--
-- view_dashboard_summary references view_car_analytics for services_due.
-- Always recreate view_car_analytics before view_dashboard_summary.
-- =====================================================================

-- View 1: Car Analytics
-- Replaces: getCarDetails() + updateCarHealth() + getCarsPerformance()
--
-- HEALTH SCORE formula matches App.js getCarDetails() exactly:
--   healthScore = 100
--   healthScore -= min(costPerKm * 2, 30)    where costPerKm = (totalExpenses / odometer) * 100
--   healthScore -= min(sparesPerKm * 2, 30)  where sparesPerKm = (totalSpares / odometer) * 100
--   healthScore = max(0, healthScore)
--
-- NULLIF on odometer prevents division-by-zero for newly registered cars with no logs.
-- odometer = distance driven since initial registration (not since last service).
--
-- NEEDS_SERVICE uses mileage since last_serviced date, matching the GAS
-- weeklyMileage field which resets after each service. Correlated subquery
-- is covered by idx_weekly_logs_car_date.
CREATE OR REPLACE VIEW public.view_car_analytics AS
SELECT
    c.id                                                    AS car_id,
    c.plate_number,
    c.model,
    c.status,
    c.last_serviced,
    COUNT(wl.id)                                            AS trip_count,
    COALESCE(SUM(wl.total_mileage),  0)                    AS total_mileage,
    COALESCE(SUM(wl.total_revenue),  0)                    AS total_revenue,
    COALESCE(SUM(wl.spares_cost),    0)                    AS total_spares,
    COALESCE(SUM(wl.expense_on_car), 0)                    AS total_expenses,
    COALESCE(SUM(wl.net_revenue),    0)                    AS net_profit,
    COALESCE(MAX(wl.closing_mileage), c.initial_mileage)   AS current_mileage,

    -- Odometer distance used as the health score denominator.
    -- Separate CTE-style expression reused twice below via subquery pattern.
    (COALESCE(MAX(wl.closing_mileage), c.initial_mileage) - c.initial_mileage) AS odometer,

    -- Health score: exact match to App.js getCarDetails() formula.
    GREATEST(0,
        100
        - LEAST(30,
            (COALESCE(SUM(wl.expense_on_car), 0)
             / NULLIF(COALESCE(MAX(wl.closing_mileage), c.initial_mileage) - c.initial_mileage, 0)
            ) * 100 * 2
          )
        - LEAST(30,
            (COALESCE(SUM(wl.spares_cost), 0)
             / NULLIF(COALESCE(MAX(wl.closing_mileage), c.initial_mileage) - c.initial_mileage, 0)
            ) * 100 * 2
          )
    )                                                       AS health_score,

    -- Service flag: mileage accumulated since last_serviced date.
    -- Falls back to true if last_serviced is NULL (never serviced).
    CASE
        WHEN c.last_serviced IS NULL THEN true
        WHEN COALESCE((
            SELECT SUM(wl2.total_mileage)
            FROM   public.weekly_logs wl2
            WHERE  wl2.car_id = c.id
            AND    wl2.week_start_date > c.last_serviced
        ), 0) >= 450 THEN true
        ELSE false
    END                                                     AS needs_service

FROM  public.cars c
LEFT JOIN public.weekly_logs wl ON c.id = wl.car_id
GROUP BY c.id, c.plate_number, c.model, c.status, c.initial_mileage, c.last_serviced;


-- View 2: Driver Analytics
-- Replaces: getDriversPerformance() + getDriverStats()
--
-- PERFORMANCE SCORE formula matches App.js getDriversPerformance() exactly:
--   score = 100
--   score -= min(totalShortage / 100, 30)
--   score -= min(expenseRatio / 50, 30)    where expenseRatio = (totalExpense / totalRevenue) * 100
--   score -= min(shortageRate / 50, 20)    where shortageRate = (shortagesCount / trips) * 100
--   score = max(0, score)
CREATE OR REPLACE VIEW public.view_driver_analytics AS
SELECT
    d.id                                                        AS driver_id,
    d.first_name || ' ' || d.last_name                         AS full_name,
    d.nrc_number,
    d.status,
    d.license_expiry,
    COUNT(wl.id)                                                AS trip_count,
    COALESCE(SUM(wl.total_revenue),  0)                        AS total_revenue,
    COALESCE(AVG(wl.total_revenue),  0)                        AS avg_revenue,
    COALESCE(SUM(wl.shortage),       0)                        AS total_shortage,
    COUNT(CASE WHEN wl.shortage > 0 THEN 1 END)                AS shortages_count,

    -- expense_ratio = (totalExpense / totalRevenue) * 100; 0 if no revenue
    CASE
        WHEN COALESCE(SUM(wl.total_revenue), 0) > 0
        THEN (COALESCE(SUM(wl.expense_on_car), 0) / SUM(wl.total_revenue)) * 100
        ELSE 0
    END                                                         AS expense_ratio,

    -- Performance score: exact match to App.js getDriversPerformance() formula.
    GREATEST(0,
        100
        -- Penalty 1: shortage amount (max -30)
        - LEAST(30, COALESCE(SUM(wl.shortage), 0) / 100.0)
        -- Penalty 2: expense ratio penalty (max -30)
        - LEAST(30,
            CASE
                WHEN COALESCE(SUM(wl.total_revenue), 0) > 0
                THEN ((COALESCE(SUM(wl.expense_on_car), 0) / SUM(wl.total_revenue)) * 100) / 50.0
                ELSE 0
            END
          )
        -- Penalty 3: shortage frequency rate (max -20)
        - LEAST(20,
            CASE
                WHEN COUNT(wl.id) > 0
                THEN (COUNT(CASE WHEN wl.shortage > 0 THEN 1 END)::NUMERIC / COUNT(wl.id)) * 100 / 50.0
                ELSE 0
            END
          )
    )                                                           AS performance_score

FROM  public.drivers d
LEFT JOIN public.weekly_logs wl ON d.id = wl.driver_id
GROUP BY d.id, d.first_name, d.last_name, d.nrc_number, d.status, d.license_expiry;


-- View 3: Dashboard Summary
-- Replaces: getDashboardData()
-- DEPENDENCY: Requires view_car_analytics to exist (created above).
--             services_due is pulled from view_car_analytics to avoid
--             duplicating the needs_service logic.
CREATE OR REPLACE VIEW public.view_dashboard_summary AS
SELECT
    COALESCE(SUM(vca.total_revenue),  0)    AS total_revenue,
    COALESCE(SUM(vca.total_expenses), 0)    AS total_expenses,
    COALESCE(SUM(vca.total_mileage),  0)    AS total_mileage,
    COALESCE(SUM(vca.net_profit),     0)    AS total_net_profit,
    (SELECT COUNT(*) FROM public.cars  WHERE status = 'active') AS active_cars,
    (SELECT COUNT(*) FROM public.view_car_analytics WHERE needs_service = true) AS services_due
FROM public.view_car_analytics vca;


-- View 4: Financial Analysis
-- Replaces: updateFinancialAnalysis() stub
-- Groups by year, month, car, and driver for multi-dimensional reporting.
-- TO_CHAR month name is locale-independent via the 'C' locale pattern.
CREATE OR REPLACE VIEW public.view_financial_analysis AS
SELECT
    wl.year,
    EXTRACT(MONTH FROM wl.week_start_date)::INTEGER     AS month_number,
    TO_CHAR(wl.week_start_date, 'Month')                AS month_name,
    c.plate_number                                       AS car_plate,
    d.first_name || ' ' || d.last_name                  AS driver_name,
    SUM(wl.total_revenue)                                AS revenue_by_month,
    SUM(wl.expense_on_car)                               AS expense_by_month,
    SUM(wl.spares_cost)                                  AS spares_by_month,
    SUM(wl.net_revenue)                                  AS net_by_month,
    COUNT(wl.id)                                         AS trip_count
FROM  public.weekly_logs wl
JOIN  public.cars    c ON wl.car_id    = c.id
JOIN  public.drivers d ON wl.driver_id = d.id
GROUP BY
    wl.year,
    EXTRACT(MONTH FROM wl.week_start_date),
    TO_CHAR(wl.week_start_date, 'Month'),
    c.plate_number,
    d.first_name,
    d.last_name;

-- =====================================================================
-- 5. ROW LEVEL SECURITY
-- All tables: anon role has zero access.
-- service_role (used exclusively by the FastAPI backend): unrestricted.
-- The frontend never connects to Supabase directly.
-- =====================================================================

ALTER TABLE public.cars                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_decommissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_terminations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_logs          ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t      TEXT;
    tables TEXT[] := ARRAY[
        'cars', 'car_decommissions', 'drivers',
        'driver_documents', 'driver_terminations', 'weekly_logs'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS service_role_full_access ON public.%I', t
        );
        EXECUTE format(
            'CREATE POLICY service_role_full_access ON public.%I
             FOR ALL TO service_role USING (true) WITH CHECK (true)', t
        );
    END LOOP;
END $$;

-- =====================================================================
-- END OF SCHEMA DEPLOYMENT SCRIPT
-- Run this against a staging Supabase instance first.
-- Validate view outputs against GAS sheet totals before production run.
-- =====================================================================
