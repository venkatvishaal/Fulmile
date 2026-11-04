const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');

const FreightBooking = sequelize.define('FreightBooking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  shipment_id: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true
  },
  shipper_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  carrier_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'carriers', key: 'id' }
  },
  trip_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'trips', key: 'id' }
  },
  pickup_address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  delivery_address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  cargo_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'General Goods'
  },
  cargo_description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cargo_weight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { min: 0.01 }
  },
  estimated_distance_km: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  estimated_fuel_liters: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true
  },
  preferred_pickup_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  preferred_delivery_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'Pending',
    validate: {
      isIn: [['Pending', 'Quoted', 'Accepted', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled']]
    }
  },
  price_quote: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_shared: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  }
}, {
  tableName: 'freight_bookings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['shipper_id'] },
    { fields: ['carrier_id'] },
    { fields: ['trip_id'] },
    { fields: ['status'] },
    { fields: ['shipment_id'], unique: true }
  ]
});

// Auto-generate shipment ID before validation
FreightBooking.beforeValidate(async (booking) => {
  if (!booking.shipment_id) {
    const num = crypto.randomInt(100000, 999999);
    booking.shipment_id = `SHP-${new Date().getFullYear()}-${num}`;
  }
});

module.exports = FreightBooking;
