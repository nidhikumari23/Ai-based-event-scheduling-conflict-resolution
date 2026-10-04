import express from 'express';
import * as ctrl from '../controllers/settingsController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.get('/public', ctrl.getPublicSettings);
router.get('/', protect, adminOnly, ctrl.getSettings);
router.put('/', protect, adminOnly, ctrl.updateSettings);

export default router;
