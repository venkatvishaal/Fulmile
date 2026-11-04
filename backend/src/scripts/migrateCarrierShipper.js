const sequelize = require('../config/database');
const { Role, Carrier, User, Vehicle, Driver, Trip, FreightBooking } = require('../models');

async function migrate() {
  console.log('--- Starting Targeted Carrier & Shipper Schema Migration ---');
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. Create carriers table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS carriers (
        id UUID PRIMARY KEY,
        company_name VARCHAR(150) NOT NULL,
        gst_number VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        pincode VARCHAR(20),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(150),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('carriers table verified.');

    // 2. Add columns to users table
    await sequelize.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES carriers(id) ON DELETE SET NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS shipper_type VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(150);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50);
    `);
    console.log('users columns verified.');

    // 3. Add columns to vehicles and drivers
    await sequelize.query(`
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES carriers(id) ON DELETE SET NULL;
      ALTER TABLE drivers ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES carriers(id) ON DELETE SET NULL;
    `);
    console.log('vehicles and drivers columns verified.');

    // 4. Add columns to trips
    await sequelize.query(`
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS tracking_id VARCHAR(30);
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS estimated_fuel_liters DECIMAL(8, 2);
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES carriers(id) ON DELETE SET NULL;
    `);
    console.log('trips columns verified.');

    // 5. Create freight_bookings table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS freight_bookings (
        id UUID PRIMARY KEY,
        shipment_id VARCHAR(30) UNIQUE NOT NULL,
        shipper_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        carrier_id UUID REFERENCES carriers(id) ON DELETE SET NULL,
        trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
        pickup_address TEXT NOT NULL,
        delivery_address TEXT NOT NULL,
        cargo_type VARCHAR(100) NOT NULL DEFAULT 'General Goods',
        cargo_description TEXT,
        cargo_weight DECIMAL(10, 2) NOT NULL,
        estimated_distance_km DECIMAL(10, 2),
        estimated_fuel_liters DECIMAL(8, 2),
        preferred_pickup_date DATE,
        preferred_delivery_date DATE,
        status VARCHAR(30) NOT NULL DEFAULT 'Pending',
        price_quote DECIMAL(12, 2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fb_shipper_id ON freight_bookings(shipper_id);
      CREATE INDEX IF NOT EXISTS idx_fb_carrier_id ON freight_bookings(carrier_id);
      CREATE INDEX IF NOT EXISTS idx_fb_trip_id ON freight_bookings(trip_id);
      CREATE INDEX IF NOT EXISTS idx_fb_status ON freight_bookings(status);
    `);
    console.log('freight_bookings table verified.');

    // 6. Ensure 'shipper' role exists
    const [shipperRole] = await Role.findOrCreate({
      where: { name: 'shipper' },
      defaults: {
        name: 'shipper',
        description: 'Books freight shipments and tracks cargo deliveries'
      }
    });
    console.log('Shipper role verified:', shipperRole.id);

    // 7. Ensure Default Carrier exists for legacy data
    const [defaultCarrier] = await Carrier.findOrCreate({
      where: { company_name: 'TransitOps Logistics Corp' },
      defaults: {
        company_name: 'TransitOps Logistics Corp',
        gst_number: '29AADCT1234F1ZH',
        address: '123 Fleet Street',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        contact_phone: '9876500000',
        contact_email: 'ops@transitops.com'
      }
    });
    console.log('Default carrier company verified:', defaultCarrier.company_name);

    // 8. Associate legacy records with default carrier
    await sequelize.query(`
      UPDATE users SET carrier_id = '${defaultCarrier.id}' WHERE carrier_id IS NULL AND shipper_type IS NULL;
      UPDATE vehicles SET carrier_id = '${defaultCarrier.id}' WHERE carrier_id IS NULL;
      UPDATE drivers SET carrier_id = '${defaultCarrier.id}' WHERE carrier_id IS NULL;
      UPDATE trips SET carrier_id = '${defaultCarrier.id}' WHERE carrier_id IS NULL;
    `);
    console.log('Associated legacy fleet data with default carrier.');

    console.log('--- Migration completed successfully! ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
