-- ============================================================
--  Fulmile PostgreSQL Schema
--  Run: psql -U fulmile_user -d fulmile -f schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. ROLES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT  uq_roles_name UNIQUE (name),
    CONSTRAINT  chk_roles_name CHECK (
        name IN ('fleet_manager','driver','safety_officer','financial_analyst')
    )
);

-- ── 2. USERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone         VARCHAR(20),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    token_version INT NOT NULL DEFAULT 0, -- bumped on logout/reset; invalidates older JWTs
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_email UNIQUE (email)
);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- ── 3. VEHICLES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_number  VARCHAR(30) NOT NULL,
    model_name           VARCHAR(100) NOT NULL,
    vehicle_type         VARCHAR(50) NOT NULL,
    max_load_capacity_kg NUMERIC(10,2) NOT NULL CHECK (max_load_capacity_kg > 0),
    odometer             NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (odometer >= 0),
    acquisition_cost     NUMERIC(14,2) NOT NULL CHECK (acquisition_cost > 0),
    region               VARCHAR(100),
    status               VARCHAR(20) NOT NULL DEFAULT 'Available',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vehicles_reg    UNIQUE (registration_number),
    CONSTRAINT chk_vehicle_type   CHECK (vehicle_type IN ('bike','van','truck','mini_truck','container_truck')),
    CONSTRAINT chk_vehicle_status CHECK (status IN ('Available','On Trip','In Shop','Retired'))
);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_region ON vehicles(region);
CREATE INDEX IF NOT EXISTS idx_vehicles_type   ON vehicles(vehicle_type);

-- ── 4. DRIVERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    name                VARCHAR(100) NOT NULL,
    license_number      VARCHAR(50) NOT NULL,
    license_category    VARCHAR(30) NOT NULL,
    license_expiry_date DATE NOT NULL,
    contact_number      VARCHAR(20) NOT NULL,
    safety_score        NUMERIC(3,1) NOT NULL DEFAULT 5.0
                            CHECK (safety_score >= 0 AND safety_score <= 10),
    status              VARCHAR(20) NOT NULL DEFAULT 'Available',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_drivers_license  UNIQUE (license_number),
    CONSTRAINT chk_driver_status   CHECK (status IN ('Available','On Trip','Off Duty','Suspended'))
);
CREATE INDEX IF NOT EXISTS idx_drivers_status         ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_license_expiry ON drivers(license_expiry_date);

-- ── 4.5 ROUTES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id          UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    source              VARCHAR(200) NOT NULL,
    destination         VARCHAR(200) NOT NULL,
    intermediate_points JSONB DEFAULT '[]'::jsonb,
    departure_time      TIMESTAMPTZ,
    estimated_arrival   TIMESTAMPTZ,
    price_per_kg        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price_per_kg >= 0),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_routes_vehicle_id ON routes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_routes_active     ON routes(is_active);

-- ── 5. TRIPS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id           UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    driver_id            UUID NOT NULL REFERENCES drivers(id)  ON DELETE RESTRICT,
    source               VARCHAR(200) NOT NULL,
    destination          VARCHAR(200) NOT NULL,
    cargo_weight         NUMERIC(10,2) NOT NULL CHECK (cargo_weight > 0),
    planned_distance     NUMERIC(10,2) NOT NULL CHECK (planned_distance > 0),
    status               VARCHAR(20) NOT NULL DEFAULT 'Draft',
    final_odometer       NUMERIC(12,2),
    fuel_consumed_liters NUMERIC(8,2),
    is_shared            BOOLEAN DEFAULT FALSE,
    price_quote          NUMERIC(12, 2) DEFAULT 0,
    route_id             UUID REFERENCES routes(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dispatched_at        TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    CONSTRAINT chk_trip_status CHECK (status IN ('Draft','Dispatched','Completed','Cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id     ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id      ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status         ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_status ON trips(vehicle_id, status);

-- ── 6. MAINTENANCE LOGS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id     UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    type           VARCHAR(20) NOT NULL,
    description    TEXT NOT NULL,
    cost           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    status         VARCHAR(10) NOT NULL DEFAULT 'open',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_maint_type   CHECK (type IN ('preventive','corrective')),
    CONSTRAINT chk_maint_status CHECK (status IN ('open','closed')),
    CONSTRAINT chk_maint_dates  CHECK (completed_date IS NULL OR completed_date >= scheduled_date)
);
CREATE INDEX IF NOT EXISTS idx_maint_vehicle_id ON maintenance_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maint_status     ON maintenance_logs(status);

-- ── 7. FUEL LOGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    trip_id    UUID          REFERENCES trips(id)    ON DELETE SET NULL,
    liters     NUMERIC(8,2) NOT NULL CHECK (liters > 0),
    cost       NUMERIC(12,2) NOT NULL CHECK (cost > 0),
    date       DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_id ON fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_trip_id    ON fuel_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_fuel_date       ON fuel_logs(date);

-- ── 8. EXPENSES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    type        VARCHAR(20) NOT NULL,
    cost        NUMERIC(12,2) NOT NULL CHECK (cost > 0),
    date        DATE NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_expense_type CHECK (type IN ('tolls','maintenance','other'))
);
CREATE INDEX IF NOT EXISTS idx_expense_vehicle_id ON expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expense_type       ON expenses(type);
CREATE INDEX IF NOT EXISTS idx_expense_date       ON expenses(date);

-- ── Operational cost view ─────────────────────────────────────
CREATE OR REPLACE VIEW vehicle_operational_costs AS
SELECT
    v.id                AS vehicle_id,
    v.model_name,
    v.registration_number,
    v.acquisition_cost,
    COALESCE(fuel_agg.total_fuel_cost, 0)          AS total_fuel_cost,
    COALESCE(maint_agg.total_maintenance_cost, 0)  AS total_maintenance_cost,
    COALESCE(fuel_agg.total_fuel_cost, 0)
      + COALESCE(maint_agg.total_maintenance_cost, 0)
      + COALESCE(exp_agg.total_expense_cost, 0) AS total_operational_cost,
    -- Appended last: CREATE OR REPLACE VIEW can only add columns at the end.
    COALESCE(exp_agg.total_expense_cost, 0)        AS total_expense_cost
FROM vehicles v
LEFT JOIN (
    SELECT vehicle_id, SUM(cost) AS total_fuel_cost
    FROM fuel_logs GROUP BY vehicle_id
) fuel_agg ON fuel_agg.vehicle_id = v.id
LEFT JOIN (
    SELECT vehicle_id, SUM(cost) AS total_maintenance_cost
    FROM maintenance_logs WHERE status = 'closed' GROUP BY vehicle_id
) maint_agg ON maint_agg.vehicle_id = v.id
-- Tolls and other running costs. 'maintenance'-type expenses are left out so they
-- aren't counted twice alongside closed maintenance_logs.
LEFT JOIN (
    SELECT vehicle_id, SUM(cost) AS total_expense_cost
    FROM expenses WHERE type IN ('tolls', 'other') GROUP BY vehicle_id
) exp_agg ON exp_agg.vehicle_id = v.id;

-- ── 9. TRACKING CHECKPOINTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS tracking (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    location    VARCHAR(200) NOT NULL,
    latitude    NUMERIC(9,6) NOT NULL,
    longitude   NUMERIC(9,6) NOT NULL,
    status      VARCHAR(50) NOT NULL DEFAULT 'in_transit',
    notes       TEXT,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tracking_trip_id ON tracking(trip_id);

-- Row-level security (restricted role + policies) is applied by: cd backend && npm run db:migrate-auth
