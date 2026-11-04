const express = require('express');
const router = express.Router();
const freightBookingController = require('../controllers/freightBookingController');
const { authMiddleware, authorize } = require('../middleware/auth');

// Public tracking lookup (no auth needed)
router.get('/track/:code', freightBookingController.trackByCode);

// Shipper creates booking
router.post('/', authMiddleware, authorize('shipper'), freightBookingController.create);

// List bookings (role-aware: shipper sees own, carrier sees carrier's)
router.get('/', authMiddleware, freightBookingController.list);

// Fleet manager: browse available / unassigned bookings
router.get('/available', authMiddleware, authorize('fleet_manager'), freightBookingController.listAvailable);

// Fleet manager: accepted bookings ready for dispatch
router.get('/accepted-for-dispatch', authMiddleware, authorize('fleet_manager'), freightBookingController.listAcceptedForDispatch);

// Shipper: accept carrier price quote
router.put('/:id/accept-quote', authMiddleware, authorize('shipper'), freightBookingController.acceptQuote);

// Get single booking
router.get('/:id', authMiddleware, freightBookingController.getById);

// Fleet manager: set price quote
router.put('/:id/quote', authMiddleware, authorize('fleet_manager'), freightBookingController.setQuote);

// Fleet manager: accept booking (optional merge into active trip)
router.put('/:id/accept', authMiddleware, authorize('fleet_manager'), freightBookingController.accept);

// Cancel booking
router.put('/:id/cancel', authMiddleware, freightBookingController.cancel);

module.exports = router;

