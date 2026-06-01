-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.car_decommissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL,
  decommission_date date NOT NULL,
  reason text NOT NULL,
  final_mileage numeric NOT NULL,
  total_revenue_at_decommission numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT car_decommissions_pkey PRIMARY KEY (id),
  CONSTRAINT car_decommissions_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id)
);
CREATE TABLE public.cars (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plate_number character varying NOT NULL UNIQUE,
  model character varying NOT NULL,
  passenger_capacity integer NOT NULL CHECK (passenger_capacity > 0),
  initial_mileage numeric NOT NULL DEFAULT 0.0,
  last_serviced date,
  registration_date date NOT NULL,
  status character varying NOT NULL DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'decommissioned'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  make character varying NOT NULL,
  vehicle_type character varying NOT NULL CHECK (vehicle_type::text = ANY (ARRAY['Sedan'::character varying, 'Hatchback'::character varying, 'SUV'::character varying, 'Truck'::character varying, 'Coupe'::character varying, 'Minivan'::character varying, 'Station Wagon'::character varying, 'Minibus'::character varying]::text[])),
  CONSTRAINT cars_pkey PRIMARY KEY (id)
);
CREATE TABLE public.driver_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  document_type character varying NOT NULL CHECK (document_type::text = ANY (ARRAY['nrc'::character varying, 'license'::character varying]::text[])),
  storage_path text NOT NULL,
  original_filename character varying NOT NULL,
  mime_type character varying NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT driver_documents_pkey PRIMARY KEY (id),
  CONSTRAINT driver_documents_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id)
);
CREATE TABLE public.driver_terminations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  termination_date date NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT driver_terminations_pkey PRIMARY KEY (id),
  CONSTRAINT driver_terminations_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id)
);
CREATE TABLE public.drivers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  phone character varying NOT NULL,
  nrc_number character varying NOT NULL UNIQUE,
  license_number character varying NOT NULL,
  license_expiry date NOT NULL,
  next_of_kin_name character varying NOT NULL,
  next_of_kin_relationship character varying NOT NULL,
  next_of_kin_phone character varying NOT NULL,
  next_of_kin_email character varying,
  status character varying NOT NULL DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'terminated'::character varying]::text[])),
  registration_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT drivers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.weekly_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  week_start_date date NOT NULL,
  year integer NOT NULL,
  start_mileage numeric NOT NULL,
  closing_mileage numeric NOT NULL,
  total_mileage numeric DEFAULT (closing_mileage - start_mileage),
  total_revenue numeric NOT NULL DEFAULT 0.00 CHECK (total_revenue >= 0::numeric),
  shortage numeric NOT NULL DEFAULT 0.00 CHECK (shortage >= 0::numeric),
  expense_on_car numeric NOT NULL DEFAULT 0.00 CHECK (expense_on_car >= 0::numeric),
  net_revenue numeric DEFAULT ((total_revenue - expense_on_car) - shortage),
  spares_bought text,
  spares_cost numeric NOT NULL DEFAULT 0.00 CHECK (spares_cost >= 0::numeric),
  comments text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT weekly_logs_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_logs_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id),
  CONSTRAINT weekly_logs_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id)
);