import express from 'express';
import * as ctrl from '../controllers/scheduleController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.get('/public', ctrl.getPublicSchedule);
router.get('/view/:view', ctrl.getScheduleByView);
router.get('/', protect, adminOnly, ctrl.getSchedule);
router.post('/', protect, adminOnly, ctrl.saveSchedule);
router.post('/generate', protect, adminOnly, ctrl.generateScheduleFromEvents);
router.patch('/lock', protect, adminOnly, ctrl.lockSchedule);
router.patch('/publish', protect, adminOnly, ctrl.publishSchedule);

export default router;
