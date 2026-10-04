import express from 'express';
import * as ctrl from '../controllers/userController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, adminOnly);
router.get('/', ctrl.getUsers);
router.get('/preferences', ctrl.getParticipantPreferences);
router.get('/:id', ctrl.getUserById);
router.get('/:id/registrations', ctrl.getUserRegistrations);
router.put('/:id', ctrl.updateUser);
router.patch('/:id/toggle', ctrl.toggleUserStatus);
router.delete('/:id', ctrl.deleteUser);

export default router;
