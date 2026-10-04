import express from 'express';
import * as ctrl from '../controllers/reportController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, adminOnly);
router.get('/participation', ctrl.getParticipationReport);
router.get('/venues', ctrl.getVenueUtilization);
router.get('/resources', ctrl.getResourceUtilization);
router.get('/conflicts', ctrl.getConflictReport);
router.get('/registrations', ctrl.getRegistrationReport);
router.get('/cancelled', ctrl.getCancelledEventsReport);
router.get('/ai-schedule', ctrl.getAIScheduleReport);
router.get('/export/:type', ctrl.exportReport);

export default router;
