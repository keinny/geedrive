You are working on the GeeDrive Motors Fleet Management System. This is a single HTML file (`fleetmis_v2.html`) frontend connected to a FastAPI + Supabase backend. Below is everything you need to implement the required changes. Do not ask clarifying questions — implement everything described.

---

## CONTEXT

**Stack:**
- Frontend: Single HTML file with vanilla JavaScript, no frameworks
- Backend: FastAPI with Pydantic schemas, Supabase (PostgreSQL) database
- Auth: Bearer token via `FLEET_API_KEY`
- The `FleetAPI` object handles all API calls

**Relevant backend files to update:**
- `app/schemas/cars.py` — CarCreate, CarUpdate, CarResponse, VehicleType enum
- `app/repositories/car_repo.py` — CarRepository
- `app/routers/cars.py` — car endpoints
- `fleet_schema_v2.sql` — analytical views

**Relevant frontend sections:**
- Car registration modal (`#carRegistrationModal`)
- Cars table (`#carsTable`) rendered by `populateCarsTable()`
- Driver registration modal (`#driverRegistrationModal`)
- Drivers table (`#driversTable`) rendered by `populateDriversTable()`
- Dashboard tab rendered by `loadDashboardData()` and `populateDashboardTable()`
- `FleetAPI` client object
- `allCars` and `allDrivers` global arrays

---

## CHANGE 1 — Car Registration Modal: Add Missing Fields

**Problem:** The modal is missing `make` and `vehicle_type` which are required by the database schema. The `carCapacity` field has the wrong label and placeholder.

**Implement the following:**

In the car registration modal form (`#carRegForm`), make these changes:

1. Split the existing single "Vehicle Model Specification" field into two separate fields:
   - Label: `Make` — input `id="carMake"`, placeholder "e.g., Toyota"
   - Label: `Model` — input `id="carModel"`, placeholder "e.g., Hiace"

2. Add a new required dropdown field:
   - Label: `Vehicle Type`
   - `id="vehicleType"`
   - Options: Sedan, Hatchback, SUV, Truck, Coupe, Minivan, Station Wagon, Minibus
   - Default empty option: `-- Select Type --`

3. Fix the capacity field:
   - Change label from "Engine Displacement Capacity" to "Passenger Capacity (Seats)"
   - Change `type` from `text` to `number`
   - Change placeholder from "e.g., 1.8L" to "e.g., 14"
   - Add `min="1"`

4. In `submitCarRegistration()`, update `carData` to include the new fields:
   ```javascript
   const carMake = document.getElementById('carMake').value.trim();
   const vehicleType = document.getElementById('vehicleType').value;
   // Add to validation check: !carMake || !vehicleType
   // Add to carData object: make: carMake, vehicleType: vehicleType
   ```

5. In `FleetAPI.registerCar()`, update the body to include:
   ```javascript
   make: payload.make,
   vehicle_type: payload.vehicleType,
   ```

---

## CHANGE 2 — Cars Table: Pull Health Data from Analytics

**Problem:** `populateCarsTable()` uses `FleetAPI.getCars()` which hits `GET /cars` and returns raw rows with no `healthScore`. The health bar always shows 0%. The `make` and `vehicle_type` columns are absent from the table.

**Implement the following:**

1. Create a new `FleetAPI` method `getEnrichedCars()`:
   ```javascript
   async getEnrichedCars() {
       const [carsData, analyticsData] = await Promise.all([
           this.getCars(),
           this._get('/cars/analytics')
       ]);
       const analyticsMap = {};
       analyticsData.forEach(a => { analyticsMap[a.plate_number] = a; });
       return {
           status: 'success',
           cars: carsData.cars.map(c => ({
               ...c,
               healthScore: analyticsMap[c.plate_number]?.health_score ?? 0,
               needsService: analyticsMap[c.plate_number]?.needs_service ?? false,
               tripCount: analyticsMap[c.plate_number]?.trip_count ?? 0,
               totalRevenue: analyticsMap[c.plate_number]?.total_revenue ?? 0
           }))
       };
   }
   ```

2. In `loadCarsData()`, replace `FleetAPI.getCars()` with `FleetAPI.getEnrichedCars()`.

3. Update the cars table `<thead>` to replace "Model" with three columns: "Make", "Model", "Type". Keep all other columns. Update `colspan` references from 7 to 9.

4. Update `populateCarsTable()` to render the new columns:
   - `car.make` in the Make cell
   - `car.model` in the Model cell
   - `car.vehicle_type` in the Type cell
   - Use `car.needsService` boolean for the service badge instead of the health score threshold
   - Health bar uses `car.healthScore` as before

---

## CHANGE 3 — Dashboard: Fix Service Threshold Logic

**Problem:** `populateDashboardTable()` compares `car.weeklyMileage` (which is mapped from `odometer` — total lifetime distance) against the 450km weekly threshold. This flags every car incorrectly. The `needs_service` boolean from the analytics view is the correct field to use.

**Implement the following:**

In `FleetAPI.getDashboard()`, add `needs_service` to the analytics mapping:
```javascript
carsAnalysis: analytics.map(c => ({
    plate: c.plate_number,
    revenue: c.total_revenue,
    expenses: c.total_expenses,
    profit: c.net_profit,
    odometer: c.odometer,
    needsService: c.needs_service,   // add this
    healthScore: c.health_score
}))
```

In `populateDashboardTable()`, replace the entire `serviceDue` block:
```javascript
// REMOVE this entire block:
let serviceDue = '✓ Operational';
if (car.weeklyMileage >= 450) { ... }
else if (car.weeklyMileage >= 350) { ... }

// REPLACE with:
const serviceDue = car.needsService
    ? '⚠️ SERVICE DUE'
    : '✓ Operational';
const serviceColor = car.needsService ? 'var(--danger)' : 'var(--success)';
```

Update the table cell to use `serviceColor` instead of the inline threshold comparison.

---

## CHANGE 4 — Frontend Caching Layer

**Problem:** Every tab switch triggers a fresh API call. Cars and drivers data is re-fetched on every visit to the car/driver management tabs even when nothing has changed.

**Implement the following:**

Add a cache object at the top of the script block alongside `allCars` and `allDrivers`:
```javascript
const _cache = {
    cars: null,
    drivers: null,
    carsAnalytics: null,
    TTL: 60000, // 60 seconds
    timestamps: {},
    isStale(key) {
        return !this.timestamps[key] || (Date.now() - this.timestamps[key]) > this.TTL;
    },
    set(key, data) {
        this[key] = data;
        this.timestamps[key] = Date.now();
    },
    invalidate(key) {
        this.timestamps[key] = 0;
    }
};
```

Apply the cache in the following places:

- `loadCarsData()` — check `_cache.isStale('cars')` before fetching. If fresh, call `populateCarsTable(_cache.cars)` directly. After a successful fetch, call `_cache.set('cars', data.cars)`.

- `loadDriversData()` — same pattern with `_cache.drivers`.

- After any successful car registration or decommission, call `_cache.invalidate('cars')` so the next tab visit refetches.

- After any successful driver registration or termination, call `_cache.invalidate('drivers')`.

- `loadCarsData_Init()` and `loadDriversData_Init()` should always fetch fresh (they are called on page load and after mutations) — do not apply the cache check to these.

---

## CHANGE 5 — Driver Registration: Historical Backfill Toggle

**Problem:** `registration_date` is always set to today silently. There is no way to register a historical driver with a past date.

**Implement the following:**

In the driver registration modal, just above the modal footer, add:

```html
<div class="form-section">
    <div class="form-group" style="flex-direction: row; align-items: center; gap: 12px;">
        <input type="checkbox" id="historicalBackfill" style="width: auto; margin: 0;">
        <label for="historicalBackfill" style="margin: 0; font-weight: 500; cursor: pointer;">
            This is a historical record — registration date differs from today
        </label>
    </div>
    <div id="backfillDateGroup" style="display: none; margin-top: 12px;">
        <label for="registrationDate" class="required">Actual Registration Date</label>
        <input type="date" id="registrationDate" max="">
        <span class="form-note">Must be today or earlier. Used for backfilling historical driver records.</span>
    </div>
</div>
```

Add this JavaScript:
```javascript
document.getElementById('historicalBackfill')?.addEventListener('change', function() {
    const group = document.getElementById('backfillDateGroup');
    const input = document.getElementById('registrationDate');
    group.style.display = this.checked ? 'block' : 'none';
    if (this.checked) {
        input.max = new Date().toISOString().split('T')[0];
        input.required = true;
    } else {
        input.required = false;
        input.value = '';
    }
});
```

In `submitDriverRegistration()`, update the registration date logic:
```javascript
const useBackfill = document.getElementById('historicalBackfill').checked;
const registrationDate = useBackfill
    ? document.getElementById('registrationDate').value
    : new Date().toISOString().split('T')[0];

if (useBackfill && !registrationDate) {
    showDriverModalMessage('⚠️ Please enter the actual registration date.', 'error');
    return;
}
```

Pass `registrationDate` into the `driver_data` JSON sent to `FleetAPI.registerDriver()`.

In `closeDriverRegModal()`, add a reset for the backfill toggle:
```javascript
document.getElementById('historicalBackfill').checked = false;
document.getElementById('backfillDateGroup').style.display = 'none';
document.getElementById('registrationDate').value = '';
```

---

## CHANGE 6 — NRC Real-Time Check: Debounced API Validation

**Problem:** The `input` event listener on `#nrcNumber` checks the stale local `allDrivers` cache instead of calling the API. It also fires on every keystroke with no debounce.

**Implement the following:**

Replace the entire existing NRC `input` event listener with this implementation:

```javascript
let _nrcCheckTimer = null;
let _nrcIsValid = false;

document.getElementById('nrcNumber')?.addEventListener('input', function() {
    const val = this.value.trim().toUpperCase();
    const msg = document.getElementById('nrcValidationMessage');
    const submitBtn = document.getElementById('driverSubmitBtn');

    // Reset state on any new input
    _nrcIsValid = false;
    submitBtn.disabled = true;

    if (!val) {
        msg.className = 'validation-message';
        msg.textContent = '';
        submitBtn.disabled = false; // allow submit attempt (server will catch it)
        return;
    }

    // Show checking state
    msg.className = 'validation-message info';
    msg.textContent = '⏳ Checking NRC...';

    // Clear any pending check
    clearTimeout(_nrcCheckTimer);

    // Debounce: wait 500ms after user stops typing
    _nrcCheckTimer = setTimeout(() => {
        FleetAPI.checkNRC(val)
            .then(({ isDuplicate }) => {
                if (isDuplicate) {
                    msg.className = 'validation-message error';
                    msg.textContent = '❌ This NRC number is already registered';
                    _nrcIsValid = false;
                    submitBtn.disabled = true;
                } else {
                    msg.className = 'validation-message success';
                    msg.textContent = '✓ NRC available';
                    _nrcIsValid = true;
                    submitBtn.disabled = false;
                }
            })
            .catch(() => {
                // Network error during check — allow submission, server is the final guard
                msg.className = 'validation-message';
                msg.textContent = '⚠️ Could not verify — will check on submission';
                _nrcIsValid = true;
                submitBtn.disabled = false;
            });
    }, 500);
});
```

In `submitDriverRegistration()`, remove the existing NRC duplicate check block entirely (both the local cache check and the inline `FleetAPI.checkNRC()` call). The debounced listener now handles real-time feedback. The server remains the final authority on submission.

In `closeDriverRegModal()`, add:
```javascript
_nrcIsValid = false;
document.getElementById('driverSubmitBtn').disabled = false;
```

---

## CHANGE 7 — Postgres Views: Add Missing Columns and Fix Redundancy

**Problem:** `view_car_analytics` is missing `make` and `vehicle_type`. `view_dashboard_summary` has a redundant nested subquery for `services_due` and is missing `active_drivers`. `view_driver_analytics` is missing a computed `license_status` convenience column.

**Update the following views in `fleet_schema_v2.sql`:**

**view_car_analytics** — add to SELECT after `c.model`:
```sql
c.make,
c.vehicle_type,
```

**view_driver_analytics** — add to SELECT after `d.license_expiry`:
```sql
CASE
    WHEN d.license_expiry < CURRENT_DATE
        THEN 'expired'
    WHEN d.license_expiry < CURRENT_DATE + INTERVAL '30 days'
        THEN 'expiring_soon'
    ELSE 'valid'
END AS license_status,
```

**view_dashboard_summary** — replace the `services_due` subquery with an inline aggregate and add `active_drivers`:
```sql
CREATE OR REPLACE VIEW public.view_dashboard_summary AS
SELECT
    COALESCE(SUM(vca.total_revenue),  0) AS total_revenue,
    COALESCE(SUM(vca.total_expenses), 0) AS total_expenses,
    COALESCE(SUM(vca.total_mileage),  0) AS total_mileage,
    COALESCE(SUM(vca.net_profit),     0) AS total_net_profit,
    COUNT(CASE WHEN vca.needs_service = true THEN 1 END) AS services_due,
    (SELECT COUNT(*) FROM public.cars    WHERE status = 'active')     AS active_cars,
    (SELECT COUNT(*) FROM public.drivers WHERE status = 'active')     AS active_drivers
FROM public.view_car_analytics vca;
```

Run these as `CREATE OR REPLACE VIEW` in the Supabase SQL Editor — they are safe to run on a live database without dropping existing data.

In `FleetAPI.getDrivers()`, add `license_status` to the driver object mapping:
```javascript
licenseStatus: d.license_status ?? 'valid'
```

In `populateDriversTable()`, update the License Info cell to render a badge based on `licenseStatus`:
- `'expired'` → red badge with text "Expired"
- `'expiring_soon'` → amber badge with text "Expiring Soon"
- `'valid'` → the existing expiry date display with no badge

This makes the visual feedback actually appear in the UI, which is the whole point of adding the column.

---

## CHANGE 8 — Backend: Update CarResponse Schema

**Problem:** `CarResponse` in `app/schemas/cars.py` does not include `make` or `vehicle_type`, so the API strips these fields from responses even though the database stores them.

**In `app/schemas/cars.py`**, add to `CarResponse`:
```python
make: str
vehicle_type: VehicleType
```

**In `view_car_analytics`**, the analytics endpoint response will now include `make` and `vehicle_type` automatically since the view SELECTs them. No router changes needed.

**In `CarAnalyticsResponse`**, add:
```python
make: str
vehicle_type: VehicleType
```

---

## ADDITIONAL CONSTRAINTS

- Do not change any CSS variables or the overall visual design
- Do not rename any existing JavaScript functions — only modify their internals
- Do not change the `FleetAPI._get()`, `_post()`, or `_patch()` base methods
- The `_cache` object must be declared before `allCars` and `allDrivers`
- All SQL changes must use `CREATE OR REPLACE VIEW` — never `DROP VIEW`
- Preserve all existing HTML element IDs — only add new ones
- The `_nrcIsValid` and `_nrcCheckTimer` variables must be declared at the top of the script block alongside other globals

---