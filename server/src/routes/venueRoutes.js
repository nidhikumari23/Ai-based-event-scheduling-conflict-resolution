import express from 'express';
import * as ctrl from '../controllers/venueController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.get('/', ctrl.getVenues);
router.get('/:id/bookings', protect, adminOnly, ctrl.getVenueBookingStatus);
router.post('/', protect, adminOnly, ctrl.createVenue);
router.put('/:id', protect, adminOnly, ctrl.updateVenue);
router.patch('/:id/block', protect, adminOnly, ctrl.blockVenue);
router.delete('/:id', protect, adminOnly, ctrl.deleteVenue);

export default router;
