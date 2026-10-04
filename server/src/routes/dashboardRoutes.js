import express from 'express';
import * as ctrl from '../controllers/dashboardController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.get('/admin', protect, adminOnly, ctrl.getAdminDashboard);
router.get('/user', protect, ctrl.getUserDashboard);

export default router;
