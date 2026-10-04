import express from 'express';
import * as ctrl from '../controllers/resourceController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.get('/', ctrl.getResources);
router.get('/overbooking', protect, adminOnly, ctrl.checkOverbooking);
router.post('/', protect, adminOnly, ctrl.createResource);
router.put('/:id', protect, adminOnly, ctrl.updateResource);
router.patch('/:id/toggle', protect, adminOnly, ctrl.toggleResourceAvailability);
router.delete('/:id', protect, adminOnly, ctrl.deleteResource);

export default router;
