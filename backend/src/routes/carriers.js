const express = require('express');
const router = express.Router();
const carrierController = require('../controllers/carrierController');
const { authMiddleware, authorize } = require('../middleware/auth');

// Public: list carriers for registration or shippers to browse
router.get('/public-list', carrierController.listCarriers);
router.get('/', carrierController.listCarriers);

// Authenticated carrier routes
router.use(authMiddleware);

// Get carrier profile (any authenticated carrier member)
router.get('/:id', carrierController.getCarrier);

// Update carrier info (fleet_manager only)
router.put('/:id', authorize('fleet_manager'), carrierController.updateCarrier);

// List members of a carrier company (fleet_manager only)
router.get('/:id/members', authorize('fleet_manager'), carrierController.getMembers);

module.exports = router;

