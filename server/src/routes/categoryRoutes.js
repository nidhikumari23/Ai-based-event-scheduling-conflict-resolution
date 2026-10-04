import express from 'express';
import * as ctrl from '../controllers/categoryController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.get('/', ctrl.getCategories);
router.post('/', protect, adminOnly, ctrl.createCategory);
router.put('/:id', protect, adminOnly, ctrl.updateCategory);
router.patch('/:id/toggle', protect, adminOnly, ctrl.toggleCategory);
router.delete('/:id', protect, adminOnly, ctrl.deleteCategory);

export default router;
