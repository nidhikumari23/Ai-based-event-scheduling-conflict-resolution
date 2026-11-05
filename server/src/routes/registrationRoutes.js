import express from 'express';
import * as ctrl from '../controllers/registrationController.js';
import { protect, adminOnly, adminOrOrganizer } from '../middleware/auth.js';

const router = express.Router();
router.post('/', protect, ctrl.registerForEvent);
router.get('/attendance/events', protect, adminOrOrganizer, ctrl.getAttendanceEvents);
router.get('/attendance/events/:id', protect, adminOrOrganizer, ctrl.getEventAttendance);
router.get('/my/events', protect, ctrl.getMyEvents);
router.get('/my', protect, ctrl.getMyRegistrations);
router.patch('/:id/attendance', protect, adminOrOrganizer, ctrl.verifyAttendance);
router.delete('/:eventId', protect, ctrl.cancelRegistration);
router.get('/', protect, adminOnly, ctrl.getAllRegistrations);
router.get('/export', protect, adminOnly, ctrl.exportParticipants);
router.patch('/:id/status', protect, adminOnly, ctrl.updateRegistrationStatus);
router.delete('/admin/:id', protect, adminOnly, ctrl.removeParticipant);

export default router;
