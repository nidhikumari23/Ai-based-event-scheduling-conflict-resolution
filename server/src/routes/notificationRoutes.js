import express from 'express';
import * as ctrl from '../controllers/notificationController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.get('/', protect, ctrl.getMyNotifications);
router.patch('/read-all', protect, ctrl.markAllRead);
router.patch('/:id/read', protect, ctrl.markRead);
router.post('/send', protect, adminOnly, ctrl.sendNotification);
router.delete('/:id', protect, ctrl.deleteNotification);

export default router;
