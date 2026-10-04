import express from 'express';
import * as ctrl from '../controllers/registrationController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.post('/', protect, ctrl.registerForEvent);
router.get('/my', protect, ctrl.getMyRegistrations);
router.delete('/:eventId', protect, ctrl.cancelRegistration);
router.get('/', protect, adminOnly, ctrl.getAllRegistrations);
router.get('/export', protect, adminOnly, ctrl.exportParticipants);
router.patch('/:id/status', protect, adminOnly, ctrl.updateRegistrationStatus);
router.delete('/admin/:id', protect, adminOnly, ctrl.removeParticipant);

export default router;
