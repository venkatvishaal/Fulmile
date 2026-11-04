const bcrypt = require('bcryptjs');
const { User, Role, Carrier } = require('../models');
const { signSession } = require('../utils/tokens');
const sequelize = require('../config/database');

const authController = {
  register: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const { name, email, password, phone, accountType, role, carrier, shipperType, companyName, gstNumber } = req.body;

      // Check existing user
      const existing = await User.findOne({ where: { email }, transaction: t });
      if (existing) {
        await t.rollback();
        return res.status(409).json({ success: false, message: 'A user with this email already exists' });
      }

      let roleRecord;
      let carrierId = null;

      if (accountType === 'carrier') {
        // ── CARRIER LOGISTICS PATH ──
        const carrierRole = role || 'fleet_manager';
        if (!['fleet_manager', 'driver', 'safety_officer', 'financial_analyst'].includes(carrierRole)) {
          await t.rollback();
          return res.status(400).json({ success: false, message: 'Invalid carrier role' });
        }

        roleRecord = await Role.findOne({ where: { name: carrierRole }, transaction: t });
        if (!roleRecord) {
          [roleRecord] = await Role.findOrCreate({
            where: { name: carrierRole },
            defaults: {
              name: carrierRole,
              description: `${carrierRole.replace('_', ' ')} role`
            },
            transaction: t
          });
        }

        // Create or attach the carrier company
        if (carrier && (carrier.id || carrier.company_name)) {
          let carrierRecord = null;
          if (carrier.id) {
            carrierRecord = await Carrier.findByPk(carrier.id, { transaction: t });
          }
          if (!carrierRecord && carrier.company_name) {
            const trimmedName = carrier.company_name.trim();
            // Case-insensitive search to join the same logistics company
            carrierRecord = await Carrier.findOne({
              where: sequelize.where(
                sequelize.fn('LOWER', sequelize.col('company_name')),
                trimmedName.toLowerCase()
              ),
              transaction: t
            });

            if (!carrierRecord) {
              carrierRecord = await Carrier.create({
                company_name: trimmedName,
                gst_number: carrier.gst_number || null,
                address: carrier.address || null,
                city: carrier.city || null,
                state: carrier.state || null,
                pincode: carrier.pincode || null,
                contact_phone: carrier.contact_phone || null,
                contact_email: carrier.contact_email || null
              }, { transaction: t });
            }
          }

          if (carrierRecord) {
            carrierId = carrierRecord.id;
          } else {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Selected logistics company not found' });
          }
        } else {
          await t.rollback();
          return res.status(400).json({ success: false, message: 'Carrier company details are required' });
        }

      } else if (accountType === 'shipper') {
        // ── SHIPPER PATH ──
        try {
          [roleRecord] = await Role.findOrCreate({
            where: { name: 'shipper' },
            defaults: {
              name: 'shipper',
              description: 'Books freight shipments and tracks cargo deliveries'
            },
            transaction: t
          });
        } catch (roleErr) {
          // If PostgreSQL chk_roles_name constraint blocks 'shipper', drop it within the transaction
          await sequelize.query('ALTER TABLE roles DROP CONSTRAINT IF EXISTS chk_roles_name', { transaction: t });
          [roleRecord] = await Role.findOrCreate({
            where: { name: 'shipper' },
            defaults: {
              name: 'shipper',
              description: 'Books freight shipments and tracks cargo deliveries'
            },
            transaction: t
          });
        }

        if (!shipperType || !['individual', 'company'].includes(shipperType)) {
          await t.rollback();
          return res.status(400).json({ success: false, message: 'Shipper type must be "individual" or "company"' });
        }

      } else {
        // ── BACKWARD COMPATIBLE LEGACY PATH ──
        const legacyRole = role || 'fleet_manager';
        roleRecord = await Role.findOne({ where: { name: legacyRole }, transaction: t });
        if (!roleRecord) {
          [roleRecord] = await Role.findOrCreate({
            where: { name: legacyRole },
            defaults: {
              name: legacyRole,
              description: `${legacyRole.replace('_', ' ')} role`
            },
            transaction: t
          });
        }
      }

      // Create user with zero dummy metadata
      const user = await User.create({
        name,
        email,
        password_hash: password,
        role_id: roleRecord.id,
        phone: phone || null,
        carrier_id: carrierId,
        shipper_type: accountType === 'shipper' ? shipperType : null,
        company_name: (accountType === 'shipper' && shipperType === 'company') ? (companyName || null) : null,
        gst_number: (accountType === 'shipper' && shipperType === 'company') ? (gstNumber || null) : null,
        email_verified: true
      }, { transaction: t });

      await t.commit();

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: roleRecord.name,
          carrierId: carrierId,
          shipperType: user.shipper_type
        },
        token: signSession(user, roleRecord.name)
      });
    } catch (error) {
      await t.rollback();
      console.error('Registration error:', error);
      res.status(500).json({ success: false, message: error?.message || 'Registration failed. Please try again.' });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({
        where: { email },
        include: [{ model: Role, as: 'role', attributes: ['name'] }]
      });

      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      if (!user.is_active) {
        return res.status(403).json({ success: false, message: 'This account has been deactivated.' });
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role.name,
          carrierId: user.carrier_id,
          shipperType: user.shipper_type,
          companyName: user.company_name
        },
        token: signSession(user, user.role.name)
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
    }
  },

  verify: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password_hash', 'token_version'] },
        include: [{ model: Role, as: 'role', attributes: ['name'] }]
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Verification failed' });
    }
  },

  logout: async (req, res) => {
    try {
      await User.increment('token_version', { where: { id: req.user.id } });
      res.json({ success: true, message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ success: false, message: 'Logout failed. Please try again.' });
    }
  },

  deleteAccount: async (req, res) => {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) {
      return res.status(400).json({ success: false, message: 'Password is incorrect.' });
    }
    await user.destroy();
    res.json({ success: true, message: 'Your account has been deleted.' });
  }
};

module.exports = authController;
