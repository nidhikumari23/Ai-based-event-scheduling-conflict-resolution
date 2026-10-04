import express from 'express';
import * as ctrl from '../controllers/conflictController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, adminOnly);
router.get('/', ctrl.getConflicts);
router.get('/summary', ctrl.getConflictsByType);
router.post('/detect', ctrl.detectConflicts);
router.get('/:id/ai-suggestion', ctrl.getAISuggestion);
router.patch('/:id/resolve', ctrl.resolveConflict);

export default router;
