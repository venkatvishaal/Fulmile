const Role = require('./Role');
const User = require('./User');
const Vehicle = require('./Vehicle');
const Driver = require('./Driver');
const Trip = require('./Trip');
const MaintenanceLog = require('./MaintenanceLog');
const FuelLog = require('./FuelLog');
const Expense = require('./Expense');
const Route = require('./Route');
const Tracking = require('./Tracking');
const Carrier = require('./Carrier');
const FreightBooking = require('./FreightBooking');

// ── Carrier ↔ Users ────────────────────────────────────
Carrier.hasMany(User, { foreignKey: 'carrier_id', as: 'members' });
User.belongsTo(Carrier, { foreignKey: 'carrier_id', as: 'carrier' });

// ── Carrier ↔ Vehicles ─────────────────────────────────
Carrier.hasMany(Vehicle, { foreignKey: 'carrier_id', as: 'vehicles' });
Vehicle.belongsTo(Carrier, { foreignKey: 'carrier_id', as: 'carrier' });

// ── Carrier ↔ Drivers ──────────────────────────────────
Carrier.hasMany(Driver, { foreignKey: 'carrier_id', as: 'drivers' });
Driver.belongsTo(Carrier, { foreignKey: 'carrier_id', as: 'carrier' });

// ── Carrier ↔ Trips ────────────────────────────────────
Carrier.hasMany(Trip, { foreignKey: 'carrier_id', as: 'trips' });
Trip.belongsTo(Carrier, { foreignKey: 'carrier_id', as: 'carrier' });

// ── User ↔ Role ────────────────────────────────────────
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

// ── Driver ↔ User (optional link) ──────────────────────
User.hasOne(Driver, { foreignKey: 'user_id', as: 'driver_profile' });
Driver.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ── Vehicle → Trips, Maintenance, FuelLogs, Expenses ───
Vehicle.hasMany(Trip, { foreignKey: 'vehicle_id', as: 'trips' });
Vehicle.hasMany(MaintenanceLog, { foreignKey: 'vehicle_id', as: 'maintenance_logs' });
Vehicle.hasMany(FuelLog, { foreignKey: 'vehicle_id', as: 'fuel_logs' });
Vehicle.hasMany(Expense, { foreignKey: 'vehicle_id', as: 'expenses' });

// ── Vehicle ↔ Routes ───────────────────────────────────
Vehicle.hasMany(Route, { foreignKey: 'vehicle_id', as: 'routes' });
Route.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });

// ── Route ↔ Trips ──────────────────────────────────────
Route.hasMany(Trip, { foreignKey: 'route_id', as: 'trips' });
Trip.belongsTo(Route, { foreignKey: 'route_id', as: 'route' });

// ── Trip ↔ Tracking Checkpoints ────────────────────────
Trip.hasMany(Tracking, { foreignKey: 'trip_id', as: 'tracking_checkpoints' });
Tracking.belongsTo(Trip, { foreignKey: 'trip_id', as: 'trip' });

// ── Driver → Trips ─────────────────────────────────────
Driver.hasMany(Trip, { foreignKey: 'driver_id', as: 'trips' });

// ── Trip → Vehicle, Driver ──────────────────────────────
Trip.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });
Trip.belongsTo(Driver, { foreignKey: 'driver_id', as: 'driver' });

// ── Trip → FuelLogs ─────────────────────────────────────
Trip.hasMany(FuelLog, { foreignKey: 'trip_id', as: 'fuel_logs' });
FuelLog.belongsTo(Trip, { foreignKey: 'trip_id', as: 'trip' });

// ── FuelLog/Expense → Vehicle ───────────────────────────
FuelLog.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });
Expense.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });
MaintenanceLog.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });

// ── FreightBooking ↔ Shipper (User) ────────────────────
User.hasMany(FreightBooking, { foreignKey: 'shipper_id', as: 'freight_bookings' });
FreightBooking.belongsTo(User, { foreignKey: 'shipper_id', as: 'shipper' });

// ── FreightBooking ↔ Carrier ───────────────────────────
Carrier.hasMany(FreightBooking, { foreignKey: 'carrier_id', as: 'freight_bookings' });
FreightBooking.belongsTo(Carrier, { foreignKey: 'carrier_id', as: 'carrier' });

// ── FreightBooking ↔ Trip (one trip can carry many bookings for shared cargo) ──
Trip.hasMany(FreightBooking, { foreignKey: 'trip_id', as: 'freight_bookings' });
FreightBooking.belongsTo(Trip, { foreignKey: 'trip_id', as: 'trip' });

module.exports = {
  Role,
  User,
  Vehicle,
  Driver,
  Trip,
  MaintenanceLog,
  FuelLog,
  Expense,
  Route,
  Tracking,
  Carrier,
  FreightBooking
};
