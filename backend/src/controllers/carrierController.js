const { Carrier, User, Role } = require('../models');

const carrierController = {
  // GET /api/carriers/:id — Get carrier company profile
  getCarrier: async (req, res, next) => {
    try {
      const carrier = await Carrier.findByPk(req.params.id);
      if (!carrier) {
        return res.status(404).json({ success: false, message: 'Carrier company not found' });
      }
      res.json({ success: true, data: carrier });
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/carriers/:id — Update carrier company info (fleet_manager only)
  updateCarrier: async (req, res, next) => {
    try {
      const carrier = await Carrier.findByPk(req.params.id);
      if (!carrier) {
        return res.status(404).json({ success: false, message: 'Carrier company not found' });
      }
      // Only fleet managers of this carrier can update
      if (req.user.carrierId !== carrier.id) {
        return res.status(403).json({ success: false, message: 'You can only update your own company' });
      }

      const { company_name, gst_number, address, city, state, pincode, contact_phone, contact_email } = req.body;
      await carrier.update({
        ...(company_name && { company_name }),
        ...(gst_number !== undefined && { gst_number }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(pincode !== undefined && { pincode }),
        ...(contact_phone !== undefined && { contact_phone }),
        ...(contact_email !== undefined && { contact_email })
      });

      res.json({ success: true, message: 'Carrier updated successfully', data: carrier });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/carriers/:id/members — List all users in a carrier company
  getMembers: async (req, res, next) => {
    try {
      if (req.user.carrierId !== req.params.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      const members = await User.findAll({
        where: { carrier_id: req.params.id },
        attributes: { exclude: ['password_hash', 'token_version'] },
        include: [{ model: Role, as: 'role', attributes: ['name'] }]
      });
      res.json({ success: true, data: members });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/carriers — List all active carriers (for shippers to browse)
  listCarriers: async (req, res, next) => {
    try {
      const carriers = await Carrier.findAll({
        where: { is_active: true },
        attributes: ['id', 'company_name', 'city', 'state', 'contact_email', 'contact_phone'],
        order: [['company_name', 'ASC']]
      });
      res.json({ success: true, data: carriers });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = carrierController;

