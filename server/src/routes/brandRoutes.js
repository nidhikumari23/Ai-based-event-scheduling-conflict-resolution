import express from 'express';
import * as ctrl from '../controllers/brandController.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();
router.get('/', ctrl.getBrands);
router.post('/', protect, adminOnly, upload.single('logo'), ctrl.createBrand);
router.put('/:id', protect, adminOnly, upload.single('logo'), ctrl.updateBrand);
router.patch('/:id/toggle', protect, adminOnly, ctrl.toggleBrand);
router.delete('/:id', protect, adminOnly, ctrl.deleteBrand);

export default router;
