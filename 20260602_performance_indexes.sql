-- Conservative indexes for app-generated Supabase query load.
-- Safe to run repeatedly.

CREATE INDEX IF NOT EXISTS idx_drivers_last_name
    ON public.drivers(last_name);

CREATE INDEX IF NOT EXISTS idx_cars_plate_number
    ON public.cars(plate_number);

CREATE INDEX IF NOT EXISTS idx_weekly_logs_car_date
    ON public.weekly_logs(car_id, week_start_date);

CREATE INDEX IF NOT EXISTS idx_weekly_logs_driver_id
    ON public.weekly_logs(driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_uploaded_at
    ON public.driver_documents(driver_id, uploaded_at);
