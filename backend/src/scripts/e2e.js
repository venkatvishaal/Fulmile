// End-to-end API test against a running server. Creates its own data and deletes it afterwards.
//   npm run test:e2e                       (server on http://localhost:5000)
//   API_URL=https://… npm run test:e2e     (another environment; needs DB access for cleanup)
// Needs the demo users from `npm run db:seed`.
// Each run makes 2 deliberate failed logins; the login limiter allows 10 per 15 min per IP,
// so a third run in quick succession gets 429s. Restart the server to reset the counters.
require('dotenv').config();
const sequelize = require('../config/database');

const API = (process.env.API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const RUN = Date.now().toString(36);
const created = { users: [], vehicles: [], drivers: [] };
let passed = 0;
const failures = [];

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body)
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, body: json, type: res.headers.get('content-type') || '' };
};

const check = (name, ok, detail) => {
  if (ok) { passed++; console.log(`  ✔ ${name}`); } else { failures.push(name); console.log(`  ✘ ${name}${detail ? `  →  ${JSON.stringify(detail).slice(0, 220)}` : ''}`); }
};
const expect = (name, res, status, extra = () => true) => check(name, res.status === status && extra(res.body), { got: res.status, body: res.body });
const section = (title) => console.log(`\n${title}`);

const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } })).body.token;

async function run() {
  section('Health & routing');
  expect('GET /health', await call('GET', '/health'), 200, (b) => b.ok === true);
  expect('unknown API route → 404 JSON', await call('GET', '/does-not-exist'), 404, (b) => b.success === false);

  section('Demo accounts');
  const tokens = {};
  for (const [role, email] of [['manager', 'manager@fulmile.com'], ['driver', 'alex@fulmile.com'], ['safety', 'safety@fulmile.com'], ['analyst', 'analyst@fulmile.com']]) {
    tokens[role] = await login(email, 'password123');
    check(`${role} can sign in`, !!tokens[role]);
  }
  if (!tokens.manager) throw new Error('Demo manager login failed. Run `npm run db:seed` first.');

  section('Registration & validation');
  const email = `e2e-${RUN}@example.test`;
  created.users.push(email);
  expect('weak password rejected with field error', await call('POST', '/auth/register', { body: { name: 'E2E', email: `weak-${email}`, password: 'short', role: 'driver' } }), 400,
    (b) => b.errors?.some((e) => e.field === 'password'));
  expect('invalid email rejected', await call('POST', '/auth/register', { body: { name: 'E2E', email: 'not-an-email', password: 'Passw0rd1', role: 'driver' } }), 400);
  expect('invalid role rejected', await call('POST', '/auth/register', { body: { name: 'E2E', email: `role-${email}`, password: 'Passw0rd1', role: 'admin' } }), 400);
  expect('register signs in straight away (no email verification)', await call('POST', '/auth/register', { body: { name: 'E2E Tester', email, password: 'Passw0rd1', role: 'driver' } }), 201,
    (b) => !!b.token && b.data.email === email && b.data.role === 'driver');
  expect('duplicate email → 409', await call('POST', '/auth/register', { body: { name: 'E2E Tester', email, password: 'Passw0rd1', role: 'driver' } }), 409);

  expect('verification endpoints are gone', await call('POST', '/auth/verify-email', { body: { token: 'x' } }), 404);

  section('Login, session & logout');
  expect('wrong password → 401', await call('POST', '/auth/login', { body: { email, password: 'Wrong1234' } }), 401);
  let token = await login(email, 'Passw0rd1');
  check('new account can sign in', !!token);
  expect('GET /auth/verify returns profile without secrets', await call('GET', '/auth/verify', { token }), 200,
    (b) => b.data.email === email && !('password_hash' in b.data) && !('token_version' in b.data));
  expect('no token → 401', await call('GET', '/trips'), 401);
  expect('logout', await call('POST', '/auth/logout', { token }), 200);
  expect('token rejected after logout', await call('GET', '/auth/verify', { token }), 401);
  expect('password reset endpoints are gone', await call('POST', '/auth/forgot-password', { body: { email } }), 404);
  token = await login(email, 'Passw0rd1');
  check('sign back in after logout', !!token);


  section('Role-based access');
  expect('driver blocked from maintenance', await call('GET', '/maintenance', { token: tokens.driver }), 403);
  expect('analyst cannot create vehicles', await call('POST', '/vehicles', { token: tokens.analyst, body: {} }), 403);
  expect('safety officer cannot export reports', await call('GET', '/reports/export', { token: tokens.safety }), 403);
  expect('analyst can export reports', await call('GET', '/reports/export', { token: tokens.analyst }), 200);

  section('Vehicles');
  const M = { token: tokens.manager };
  expect('invalid vehicle rejected', await call('POST', '/vehicles', { ...M, body: { registration_number: '', vehicle_type: 'spaceship' } }), 400);
  let r = await call('POST', '/vehicles', { ...M, body: { registration_number: `E2E-${RUN}`, model_name: 'E2E Van', vehicle_type: 'van', max_load_capacity_kg: 1000, acquisition_cost: 500000, odometer: 100, region: 'Test' } });
  expect('create vehicle', r, 201);
  const vehicle = r.body.data;
  created.vehicles.push(vehicle?.id);
  expect('duplicate registration rejected', await call('POST', '/vehicles', { ...M, body: { registration_number: `E2E-${RUN}`, model_name: 'x', vehicle_type: 'van', max_load_capacity_kg: 1, acquisition_cost: 1 } }), 409);
  expect('get vehicle', await call('GET', `/vehicles/${vehicle.id}`, M), 200, (b) => b.data.id === vehicle.id);
  expect('update vehicle', await call('PUT', `/vehicles/${vehicle.id}`, { ...M, body: { region: 'Updated' } }), 200);
  expect('list vehicles filtered', await call('GET', '/vehicles?region=Updated', M), 200, (b) => b.data.some((v) => v.id === vehicle.id));

  section('Drivers');
  r = await call('POST', '/drivers', { ...M, body: { name: `E2E Driver ${RUN}`, license_number: `E2E-DL-${RUN}`, license_category: 'LMV', license_expiry_date: '2030-01-01', contact_number: '9000000000', safety_score: 8 } });
  expect('create driver', r, 201);
  const driver = r.body.data;
  created.drivers.push(driver?.id);
  expect('safety officer can update driver', await call('PUT', `/drivers/${driver.id}`, { token: tokens.safety, body: { safety_score: 9 } }), 200);
  expect('eligible drivers include new driver', await call('GET', '/drivers/eligible-for-dispatch', M), 200, (b) => b.data.some((d) => d.id === driver.id));
  expect('eligible vehicles include new vehicle', await call('GET', '/vehicles/eligible-for-dispatch', M), 200, (b) => b.data.some((v) => v.id === vehicle.id));

  section('Maintenance');
  r = await call('POST', '/maintenance', { ...M, body: { vehicle_id: vehicle.id, type: 'preventive', description: 'E2E service', cost: 1500, scheduled_date: '2026-10-21' } });
  expect('schedule maintenance', r, 201);
  expect('vehicle goes In Shop', await call('GET', `/vehicles/${vehicle.id}`, M), 200, (b) => b.data.status === 'In Shop');
  expect('close maintenance', await call('PUT', `/maintenance/${r.body.data?.id}/close`, { ...M, body: { cost: 1800 } }), 200);
  expect('vehicle back to Available', await call('GET', `/vehicles/${vehicle.id}`, M), 200, (b) => b.data.status === 'Available');

  section('Trips lifecycle');
  const tripBody = { source: 'E2E Depot', destination: 'E2E Store', vehicle_id: vehicle.id, driver_id: driver.id, cargo_weight: 400, planned_distance: 50 };
  expect('overweight cargo rejected', await call('POST', '/trips', { ...M, body: { ...tripBody, cargo_weight: 5000 } }), 400, (b) => b.errors?.[0]?.field === 'cargo_weight');
  r = await call('POST', '/trips', { ...M, body: tripBody });
  expect('create trip (Draft)', r, 201, (b) => b.data.status === 'Draft');
  const trip = r.body.data;
  expect('dispatch trip', await call('POST', `/trips/${trip.id}/dispatch`, M), 200);
  expect('dispatching twice rejected', await call('POST', `/trips/${trip.id}/dispatch`, M), 400);
  expect('vehicle now On Trip', await call('GET', `/vehicles/${vehicle.id}`, M), 200, (b) => b.data.status === 'On Trip');
  expect('busy vehicle cannot take a second trip', await call('POST', '/trips', { ...M, body: tripBody }), 400);

  section('Live tracking');
  expect('manager logs checkpoint', await call('POST', '/tracking', { ...M, body: { trip_id: trip.id, location: 'E2E Midpoint', latitude: 12.97, longitude: 77.59 } }), 201);
  if (tokens.driver) expect('other driver cannot log checkpoint (RLS/ownership)', await call('POST', '/tracking', { token: tokens.driver, body: { trip_id: trip.id, location: 'x', latitude: 1, longitude: 1 } }), 403);
  expect('public tracking history (no login)', await call('GET', `/tracking/${trip.id}`), 200, (b) => JSON.stringify(b).includes('E2E Midpoint'));
  expect('public latest checkpoint', await call('GET', `/tracking/${trip.id}/latest`), 200);

  section('Row-level security');
  if (tokens.driver) {
    expect("other driver can't cancel this trip", await call('POST', `/trips/${trip.id}/cancel`, { token: tokens.driver }), 404);
    expect('drivers can still read trips', await call('GET', '/trips', { token: tokens.driver }), 200, (b) => b.data.some((t) => t.id === trip.id));
  }

  section('Completing & cancelling');
  expect('complete trip', await call('POST', `/trips/${trip.id}/complete`, { ...M, body: { final_odometer: 160, fuel_consumed_liters: 6 } }), 200);
  expect('odometer updated', await call('GET', `/vehicles/${vehicle.id}`, M), 200, (b) => Number(b.data.odometer) === 160 && b.data.status === 'Available');
  expect('fuel log auto-created', await call('GET', `/fuel-logs?trip_id=${trip.id}`, M), 200, (b) => b.data.length === 1);
  r = await call('POST', '/trips', { ...M, body: tripBody });
  expect('cancel a draft trip', await call('POST', `/trips/${r.body.data?.id}/cancel`, M), 200);
  expect('completed trip cannot be cancelled', await call('POST', `/trips/${trip.id}/cancel`, M), 400);

  section('Fuel & expenses');
  expect('invalid fuel log rejected', await call('POST', '/fuel-logs', { ...M, body: { vehicle_id: vehicle.id, liters: -1 } }), 400);
  expect('analyst logs fuel', await call('POST', '/fuel-logs', { token: tokens.analyst, body: { vehicle_id: vehicle.id, liters: 10, cost: 1000, date: '2026-10-21' } }), 201);
  expect('driver logs expense', await call('POST', '/expenses', { token: tokens.driver, body: { vehicle_id: vehicle.id, type: 'tolls', cost: 250, date: '2026-10-21', description: 'E2E toll' } }), 201);
  expect('list expenses for vehicle', await call('GET', `/expenses?vehicle_id=${vehicle.id}`, M), 200, (b) => b.data.length === 1);

  section('Shared fleet');
  r = await call('POST', `/vehicles/${vehicle.id}/publish-route`, { ...M, body: { source: `E2E-A-${RUN}`, destination: `E2E-B-${RUN}`, price_per_kg: 5 } });
  expect('publish route', r, 201);
  expect('search finds the route', await call('GET', `/vehicles/search?pickup=E2E-A-${RUN}&destination=E2E-B-${RUN}&weight=100`, M), 200, (b) => JSON.stringify(b).includes(vehicle.id));
  expect('search without params rejected', await call('GET', '/vehicles/search', M), 400);
  expect('book shared space', await call('POST', '/vehicles/shared-booking', { ...M, body: { route_id: r.body.data?.id, pickup_location: `E2E-A-${RUN}`, delivery_location: `E2E-B-${RUN}`, weight: 100, planned_distance: 20 } }), 201);
  expect('overbooking rejected', await call('POST', '/vehicles/shared-booking', { ...M, body: { route_id: r.body.data?.id, pickup_location: 'a', delivery_location: 'b', weight: 99999, planned_distance: 20 } }), 400);

  section('Several shipments on one truck');
  const sharedDraft = (await call('GET', '/trips', M)).body.data.find((t) => t.vehicle_id === vehicle.id && t.status === 'Draft');
  if (sharedDraft) await call('POST', `/trips/${sharedDraft.id}/cancel`, M); // start from an empty truck
  r = await call('POST', '/drivers', { ...M, body: { name: `E2E Driver2 ${RUN}`, license_number: `E2E-DL2-${RUN}`, license_category: 'LMV', license_expiry_date: '2030-01-01', contact_number: '9000000001' } });
  const driver2 = r.body.data;
  created.drivers.push(driver2?.id);
  const draft = async (body) => (await call('POST', '/trips', { ...M, body: { ...tripBody, ...body } })).body.data;
  const tA = await draft({ cargo_weight: 400 });
  const tB = await draft({ cargo_weight: 300 });
  const tC = await draft({ cargo_weight: 100, driver_id: driver2.id });
  const tD = await draft({ cargo_weight: 500 });
  check('four drafts created on the same truck', tA && tB && tC && tD);
  expect('dispatch first trip', await call('POST', `/trips/${tA.id}/dispatch`, M), 200);
  expect('second trip joins the truck en route (same driver, fits)', await call('POST', `/trips/${tB.id}/dispatch`, M), 200, (b) => /already en route/.test(b.message));
  expect('different driver cannot join a truck that is out', await call('POST', `/trips/${tC.id}/dispatch`, M), 400, (b) => /on the road with/.test(b.message));
  expect('over capacity cannot join (700 of 1000 kg used)', await call('POST', `/trips/${tD.id}/dispatch`, M), 400, (b) => /Only 300\.00 kg free/.test(b.message));
  await call('POST', `/trips/${tC.id}/cancel`, M);
  await call('POST', `/trips/${tD.id}/cancel`, M);
  r = await call('POST', `/vehicles/${vehicle.id}/publish-route`, { ...M, body: { source: `E2E-C-${RUN}`, destination: `E2E-D-${RUN}`, price_per_kg: 3 } });
  r = await call('POST', '/vehicles/shared-booking', { ...M, body: { route_id: r.body.data?.id, pickup_location: `E2E-C-${RUN}`, delivery_location: `E2E-D-${RUN}`, weight: 200, planned_distance: 15 } });
  expect('booking onto a moving truck is accepted straight away', r, 201, (b) => b.data.status === 'Dispatched' && b.data.driver_id === driver.id);
  const tShared = r.body.data;
  const vehicleStatus = async () => (await call('GET', `/vehicles/${vehicle.id}`, M)).body.data.status;
  expect('complete one shipment', await call('POST', `/trips/${tA.id}/complete`, { ...M, body: { final_odometer: 200, fuel_consumed_liters: 3 } }), 200, (b) => /stays On Trip/.test(b.message));
  check('truck stays On Trip while shipments remain', (await vehicleStatus()) === 'On Trip', await vehicleStatus());
  expect('cancel another shipment', await call('POST', `/trips/${tB.id}/cancel`, M), 200);
  check('truck still On Trip (booking on board)', (await vehicleStatus()) === 'On Trip');
  expect('complete the last shipment', await call('POST', `/trips/${tShared.id}/complete`, { ...M, body: { final_odometer: 190, fuel_consumed_liters: 2 } }), 200, (b) => /restored to Available/.test(b.message));
  const vNow = (await call('GET', `/vehicles/${vehicle.id}`, M)).body.data;
  check('truck free after the last shipment, odometer not wound back', vNow.status === 'Available' && Number(vNow.odometer) === 200, vNow);
  expect('driver free again', await call('GET', `/drivers/${driver.id}`, M), 200, (b) => b.data.status === 'Available');

  section('License renewal');
  r = await call('POST', '/drivers', { ...M, body: { name: `E2E Expired ${RUN}`, license_number: `E2E-DL3-${RUN}`, license_category: 'LMV', license_expiry_date: '2024-01-01', contact_number: '9000000002' } });
  const expired = r.body.data;
  created.drivers.push(expired?.id);
  expect('suspend driver with expired license', await call('PUT', `/drivers/${expired.id}`, { ...M, body: { status: 'Suspended' } }), 200);
  expect('cannot make available while license is expired', await call('PUT', `/drivers/${expired.id}`, { ...M, body: { status: 'Available' } }), 400, (b) => /License expired/.test(b.message));
  expect('cannot set On Trip by hand', await call('PUT', `/drivers/${expired.id}`, { ...M, body: { status: 'On Trip' } }), 400);
  expect('invalid expiry date rejected', await call('PUT', `/drivers/${expired.id}`, { ...M, body: { license_expiry_date: 'soon' } }), 400);
  expect('renew license and reactivate', await call('PUT', `/drivers/${expired.id}`, { token: tokens.safety, body: { license_number: `E2E-DL3R-${RUN}`, license_expiry_date: '2031-03-31', status: 'Available' } }), 200,
    (b) => b.data.status === 'Available' && b.data.license_expiry_date === '2031-03-31');
  expect('renewed driver is eligible for dispatch', await call('GET', '/drivers/eligible-for-dispatch', M), 200, (b) => b.data.some((d) => d.id === expired.id));

  section('Reports');
  expect('dashboard KPIs', await call('GET', '/reports/dashboard', M), 200, (b) => b.success === true);
  r = await call('GET', '/reports/export', M);
  expect('CSV export', r, 200, () => r.type.includes('csv') && JSON.stringify(r.body).includes(`E2E-${RUN}`));

  section('Delete account');
  expect('wrong password keeps account', await call('DELETE', '/auth/me', { token, body: { password: 'nope' } }), 400);
  expect('delete account', await call('DELETE', '/auth/me', { token, body: { password: 'Passw0rd1' } }), 200);
  expect('deleted user cannot sign in', await call('POST', '/auth/login', { body: { email, password: 'Passw0rd1' } }), 401);
  expect('deleted user token rejected', await call('GET', '/auth/verify', { token }), 401);
}

// Removes everything this run created, children first (FKs are RESTRICT/CASCADE mixed).
async function cleanup() {
  const v = created.vehicles.filter(Boolean);
  const d = created.drivers.filter(Boolean);
  const q = (sql, replacements) => sequelize.query(sql, { replacements });
  if (v.length || d.length) {
    const trips = `SELECT id FROM trips WHERE vehicle_id IN (:v) OR driver_id IN (:d)`;
    const rep = { v: v.length ? v : [null], d: d.length ? d : [null] };
    await q(`DELETE FROM tracking WHERE trip_id IN (${trips})`, rep);
    await q(`DELETE FROM fuel_logs WHERE vehicle_id IN (:v) OR trip_id IN (${trips})`, rep);
    await q('DELETE FROM expenses WHERE vehicle_id IN (:v)', rep);
    await q('DELETE FROM maintenance_logs WHERE vehicle_id IN (:v)', rep);
    await q(`DELETE FROM trips WHERE id IN (${trips})`, rep);
    await q('DELETE FROM routes WHERE vehicle_id IN (:v)', rep);
    await q('DELETE FROM vehicles WHERE id IN (:v)', rep);
    await q('DELETE FROM drivers WHERE id IN (:d)', rep);
  }
  await q("DELETE FROM users WHERE email LIKE 'e2e-%@example.test' OR email LIKE '%-e2e-%@example.test'");
}

run()
  .catch((err) => { failures.push(`crashed: ${err.message}`); console.error('\n', err); })
  .finally(async () => {
    try { await cleanup(); console.log('\nTest data removed.'); } catch (err) { console.error('Cleanup failed:', err.message); }
    console.log(`\n${passed} passed, ${failures.length} failed`);
    failures.forEach((f) => console.log(`  - ${f}`));
    await sequelize.close();
    process.exit(failures.length ? 1 : 0);
  });
