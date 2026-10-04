import express from 'express';
import * as ctrl from '../controllers/feedbackController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();
router.get('/popular', ctrl.getPopularEvents);
router.get('/my', protect, ctrl.getMyFeedback);
router.get('/event/:eventId', ctrl.getEventRatings);
router.get('/', protect, adminOnly, ctrl.getFeedback);
router.post('/', protect, ctrl.createFeedback);
router.put('/:id', protect, ctrl.updateFeedback);
router.patch('/:id/reply', protect, adminOnly, ctrl.replyFeedback);
router.delete('/:id', protect, ctrl.deleteFeedback);

export default router;
