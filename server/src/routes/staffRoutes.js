import express from 'express';
import * as ctrl from '../controllers/staffController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.get('/', protect, adminOnly, ctrl.getStaff);
router.post('/', protect, adminOnly, ctrl.createStaff);
router.put('/:id', protect, adminOnly, ctrl.updateStaff);
router.patch('/:id/assign', protect, adminOnly, ctrl.assignStaffToEvent);
router.patch('/:id/availability', protect, adminOnly, ctrl.toggleStaffAvailability);
router.delete('/:id', protect, adminOnly, ctrl.deleteStaff);

export default router;
