-- ============================================================
--  Fulmile Seed Data
--  Run after schema.sql: psql -U fulmile_user -d fulmile -f seed.sql
-- ============================================================

-- Roles
INSERT INTO roles (name, description) VALUES
  ('fleet_manager',     'Manages fleet assets, maintenance, and operations'),
  ('driver',            'Creates and executes trip dispatches'),
  ('safety_officer',    'Monitors driver compliance and safety scores'),
  ('financial_analyst', 'Tracks costs, fuel economy, and ROI')
ON CONFLICT (name) DO NOTHING;

-- Vehicles (Van-05 for walkthrough, plus 4 extras for charts)
INSERT INTO vehicles (registration_number, model_name, vehicle_type,
    max_load_capacity_kg, odometer, acquisition_cost, region, status) VALUES
  ('KA-01-VAN-05', 'Van-05',   'van',         500,  12000, 800000,  'South', 'Available'),
  ('KA-02-TRK-01', 'Truck-01', 'truck',      5000,  45000, 3500000, 'North', 'Available'),
  ('KA-03-MIN-01', 'Mini-01',  'mini_truck',  2000,   8000, 1200000, 'East',  'Available'),
  ('KA-04-VAN-02', 'Van-02',   'van',          500,   9000,  750000, 'West',  'Available'),
  ('KA-05-TRK-02', 'Truck-02', 'truck',      4000,  62000, 3200000, 'South', 'Available');

-- Drivers (Alex for walkthrough, plus 3 extras)
INSERT INTO drivers (name, license_number, license_category,
    license_expiry_date, contact_number, safety_score, status) VALUES
  ('Alex',   'KA-DL-2028-001', 'LMV', '2028-12-31', '9876543210', 8.5, 'Available'),
  ('Ravi',   'KA-DL-2027-002', 'HMV', '2027-06-30', '9876543211', 7.2, 'Available'),
  ('Meera',  'KA-DL-2027-003', 'LMV', '2027-03-15', '9876543212', 9.0, 'Available'),
  ('Suresh', 'KA-DL-2024-004', 'LMV', '2024-01-01', '9876543213', 3.0, 'Suspended');
