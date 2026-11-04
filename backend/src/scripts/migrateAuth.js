// Adds email verification, session revocation and row-level security. Safe to re-run.
const sequelize = require('../config/database');

const statements = [
  // ── Auth columns ──
  // Existing accounts predate verification: they get TRUE once, new rows default to FALSE.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE`,
  `ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0`,
  // Demo data: link driver Alex to the alex@ login.
  `UPDATE drivers SET user_id = (SELECT id FROM users WHERE email = 'alex@fulmile.com')
     WHERE name = 'Alex' AND user_id IS NULL`,

  // ── Restricted role used by authenticated requests (SET LOCAL ROLE in middleware/auth.js) ──
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fulmile_app') THEN
       CREATE ROLE fulmile_app NOLOGIN NOBYPASSRLS;
     END IF;
   END $$`,
  `GRANT fulmile_app TO CURRENT_USER`,
  `GRANT USAGE ON SCHEMA public TO fulmile_app`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fulmile_app`,
  `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fulmile_app`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fulmile_app`,

  // ── Policies (apply only to fulmile_app; login/register/public tracking run as the owner) ──
  `CREATE OR REPLACE FUNCTION app_user_id() RETURNS UUID LANGUAGE sql STABLE AS
     $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$`,
  // A driver may change a trip only if it is theirs. Driver logins not yet linked to a driver
  // record keep the old behaviour (same rule as trackingController.addTracking).
  `CREATE OR REPLACE FUNCTION app_can_touch_trip(trip_driver UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS
     $$ SELECT current_setting('app.role', true) IS DISTINCT FROM 'driver'
          OR NOT EXISTS (SELECT 1 FROM drivers WHERE user_id = app_user_id())
          OR trip_driver IN (SELECT id FROM drivers WHERE user_id = app_user_id()) $$`,

  `ALTER TABLE users ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS users_self ON users`,
  `CREATE POLICY users_self ON users TO fulmile_app USING (id = app_user_id()) WITH CHECK (id = app_user_id())`,

  `ALTER TABLE trips ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS trips_read ON trips`,
  `DROP POLICY IF EXISTS trips_insert ON trips`,
  `DROP POLICY IF EXISTS trips_update ON trips`,
  `DROP POLICY IF EXISTS trips_delete ON trips`,
  `CREATE POLICY trips_read ON trips FOR SELECT TO fulmile_app USING (true)`,
  `CREATE POLICY trips_insert ON trips FOR INSERT TO fulmile_app WITH CHECK (true)`,
  `CREATE POLICY trips_update ON trips FOR UPDATE TO fulmile_app USING (app_can_touch_trip(driver_id))`,
  `CREATE POLICY trips_delete ON trips FOR DELETE TO fulmile_app USING (app_can_touch_trip(driver_id))`,

  `ALTER TABLE tracking ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS tracking_read ON tracking`,
  `DROP POLICY IF EXISTS tracking_write ON tracking`,
  `CREATE POLICY tracking_read ON tracking FOR SELECT TO fulmile_app USING (true)`,
  `CREATE POLICY tracking_write ON tracking FOR INSERT TO fulmile_app
     WITH CHECK (app_can_touch_trip((SELECT driver_id FROM trips WHERE trips.id = trip_id)))`
];

const run = async () => {
  const transaction = await sequelize.transaction();
  try {
    for (const sql of statements) await sequelize.query(sql, { transaction });
    await transaction.commit();
    console.log('Auth + RLS migration completed.');
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error('Auth + RLS migration failed:', error);
    process.exit(1);
  }
};

run();
