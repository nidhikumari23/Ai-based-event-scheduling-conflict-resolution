import express from 'express';
import * as ctrl from '../controllers/eventController.js';
import { protect, adminOnly, optionalAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import * as registrationCtrl from '../controllers/registrationController.js';

const router = express.Router();
router.get('/live', ctrl.getLiveEvents);
router.patch('/:id/complete', protect, adminOnly, ctrl.completeEvent);
router.get('/', optionalAuth, ctrl.getEvents);
router.post('/alternatives', protect, adminOnly, ctrl.suggestEventAlternatives);
router.get('/:id', ctrl.getEventById);
router.post('/', protect, adminOnly, upload.single('poster'), ctrl.createEvent);
router.put('/:id', protect, adminOnly, upload.single('poster'), ctrl.updateEvent);
router.patch('/:id/cancel', protect, adminOnly, ctrl.cancelEvent);
router.patch('/:id/reschedule', protect, adminOnly, ctrl.rescheduleEvent);
router.patch('/:id/featured', protect, adminOnly, ctrl.toggleFeatured);
router.delete('/:id', protect, adminOnly, ctrl.deleteEvent);

export default router;
