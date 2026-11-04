const sequelize = require('../config/database');
const { Role, User, Vehicle, Driver, Trip, MaintenanceLog, FuelLog, Expense, Carrier } = require('../models');

const seedDatabase = async () => {
  const t = await sequelize.transaction();
  try {
    console.log('Seeding roles...');
    const roles = [
      { name: 'fleet_manager', description: 'Manages fleet assets, maintenance, and operations' },
      { name: 'driver', description: 'Creates and executes trip dispatches' },
      { name: 'safety_officer', description: 'Monitors driver compliance and safety scores' },
      { name: 'financial_analyst', description: 'Tracks costs, fuel economy, and ROI' },
      { name: 'shipper', description: 'Books freight shipments and tracks cargo deliveries' }
    ];
    const roleRecords = {};
    for (const role of roles) {
      const [r] = await Role.findOrCreate({
        where: { name: role.name },
        defaults: role,
        transaction: t
      });
      roleRecords[role.name] = r;
    }

    console.log('Seeding demo users...');
    const users = [
      { name: 'Fleet Manager User', email: 'manager@fulmile.com', password_hash: 'password123', role_id: roleRecords['fleet_manager'].id },
      { name: 'Alex Driver', email: 'alex@fulmile.com', password_hash: 'password123', role_id: roleRecords['driver'].id },
      { name: 'Safety Officer User', email: 'safety@fulmile.com', password_hash: 'password123', role_id: roleRecords['safety_officer'].id },
      { name: 'Financial Analyst User', email: 'analyst@fulmile.com', password_hash: 'password123', role_id: roleRecords['financial_analyst'].id }
    ];

    for (const u of users) {
      await User.findOrCreate({
        where: { email: u.email },
        defaults: { ...u, email_verified: true },
        transaction: t
      });
    }

    // Create default carrier for existing seed data
    console.log('Seeding default carrier company...');
    const [defaultCarrier] = await Carrier.findOrCreate({
      where: { company_name: 'Fulmile Logistics Corp' },
      defaults: {
        company_name: 'Fulmile Logistics Corp',
        gst_number: '29AADCT1234F1ZH',
        address: '123 Fleet Street',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        contact_phone: '9876500000',
        contact_email: 'ops@fulmile.com'
      },
      transaction: t
    });

    // Link seed users to the default carrier
    await User.update(
      { carrier_id: defaultCarrier.id },
      { where: { carrier_id: null, email: { [require('sequelize').Op.ne]: null } }, transaction: t }
    );

    console.log('Seeding vehicles...');
    const vehicles = [
      { registration_number: 'KA-01-VAN-05', model_name: 'Van-05', vehicle_type: 'van', max_load_capacity_kg: 500, odometer: 12000, acquisition_cost: 800000, region: 'South', status: 'Available' },
      { registration_number: 'KA-02-TRK-01', model_name: 'Truck-01', vehicle_type: 'truck', max_load_capacity_kg: 5000, odometer: 45000, acquisition_cost: 3500000, region: 'North', status: 'Available' },
      { registration_number: 'KA-03-MIN-01', model_name: 'Mini-01', vehicle_type: 'mini_truck', max_load_capacity_kg: 2000, odometer: 8000, acquisition_cost: 1200000, region: 'East', status: 'Available' },
      { registration_number: 'KA-04-VAN-02', model_name: 'Van-02', vehicle_type: 'van', max_load_capacity_kg: 500, odometer: 9000, acquisition_cost: 750000, region: 'West', status: 'Available' }
    ];

    const vehicleRecords = [];
    for (const v of vehicles) {
      const [rec] = await Vehicle.findOrCreate({
        where: { registration_number: v.registration_number },
        defaults: v,
        transaction: t
      });
      vehicleRecords.push(rec);
    }

    console.log('Seeding drivers...');
    const drivers = [
      { name: 'Alex', license_number: 'KA-DL-2028-001', license_category: 'LMV', license_expiry_date: '2028-12-31', contact_number: '9876543210', safety_score: 8.5, status: 'Available' },
      { name: 'Ravi', license_number: 'KA-DL-2027-002', license_category: 'HMV', license_expiry_date: '2027-06-30', contact_number: '9876543211', safety_score: 7.2, status: 'Available' },
      { name: 'Meera', license_number: 'KA-DL-2027-003', license_category: 'LMV', license_expiry_date: '2027-03-15', contact_number: '9876543212', safety_score: 9.0, status: 'Available' },
      { name: 'Suresh', license_number: 'KA-DL-2024-004', license_category: 'LMV', license_expiry_date: '2024-01-01', contact_number: '9876543213', safety_score: 3.0, status: 'Suspended' }
    ];

    // Link driver Alex to the alex@ login so row-level security shows Alex their own trips.
    const alexUser = await User.findOne({ where: { email: 'alex@fulmile.com' }, transaction: t });
    for (const d of drivers) {
      await Driver.findOrCreate({
        where: { license_number: d.license_number },
        defaults: d.name === 'Alex' ? { ...d, user_id: alexUser?.id } : d,
        transaction: t
      });
    }

    console.log('Seeding completed trips & logs to generate initial dashboard data...');
    // Find Van-05 and Alex to populate completed logs
    const van05 = vehicleRecords.find(v => v.model_name === 'Van-05');
    const alex = await Driver.findOne({ where: { name: 'Alex' }, transaction: t });

    if (van05 && alex) {
      // Completed Trip
      const completedTrip = await Trip.create({
        vehicle_id: van05.id,
        driver_id: alex.id,
        source: 'Warehouse A',
        destination: 'Retail Depot B',
        cargo_weight: 350.00,
        planned_distance: 120.00,
        status: 'Completed',
        final_odometer: 12120.00,
        fuel_consumed_liters: 15.00,
        dispatched_at: new Date(Date.now() - 3 * 3600000),
        completed_at: new Date(Date.now() - 1 * 3600000)
      }, { transaction: t });

      // Fuel log
      await FuelLog.create({
        vehicle_id: van05.id,
        trip_id: completedTrip.id,
        liters: 15.00,
        cost: 1500.00,
        date: new Date().toISOString().split('T')[0]
      }, { transaction: t });

      // Toll expense
      await Expense.create({
        vehicle_id: van05.id,
        type: 'tolls',
        cost: 200.00,
        date: new Date().toISOString().split('T')[0],
        description: 'NH4 Highway tolls'
      }, { transaction: t });

      // Maintenance log (closed)
      await MaintenanceLog.create({
        vehicle_id: van05.id,
        type: 'preventive',
        description: 'Regular 10k service and oil change',
        cost: 4500.00,
        scheduled_date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
        completed_date: new Date(Date.now() - 9 * 86400000).toISOString().split('T')[0],
        status: 'closed'
      }, { transaction: t });
    }

    await t.commit();
    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    await t.rollback();
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
