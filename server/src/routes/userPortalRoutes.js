import express from 'express';
import * as ctrl from '../controllers/userPortalController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/stats', ctrl.getUserStats);
router.get('/personal-schedule', ctrl.getPersonalSchedule);
router.post('/personal-schedule/:eventId', ctrl.addToPersonalSchedule);
router.delete('/personal-schedule/:eventId', ctrl.removeFromPersonalSchedule);

export default router;
