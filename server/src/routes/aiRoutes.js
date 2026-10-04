import express from 'express';
import * as ctrl from '../controllers/aiController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.post('/schedule/generate', protect, adminOnly, ctrl.generateSchedule);
router.post('/schedule/regenerate', protect, adminOnly, ctrl.regenerateAfterChanges);
router.get('/recommendations', protect, ctrl.getRecommendations);
router.get('/personal-plan', protect, ctrl.getPersonalPlan);
router.post('/check-overlaps', protect, ctrl.checkUserOverlaps);

export default router;
