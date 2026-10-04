import { Feedback } from '../models/Feedback.js';
import { Event } from '../models/Event.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getFeedback = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.event) filter.event = req.query.event;
  const feedback = await Feedback.find(filter)
    .populate('user', 'name email')
    .populate('event', 'title')
    .sort({ createdAt: -1 });
  res.json(feedback);
});

export const getMyFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.find({ user: req.user._id })
    .populate('event', 'title date')
    .sort({ createdAt: -1 });
  res.json(feedback);
});

export const createFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.create({
    user: req.user._id,
    event: req.body.eventId,
    rating: req.body.rating,
    comment: req.body.comment || '',
  });
  res.status(201).json(await Feedback.findById(feedback._id).populate('event', 'title'));
});

export const updateFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { rating: req.body.rating, comment: req.body.comment },
    { new: true }
  );
  res.json(feedback);
});

export const deleteFeedback = asyncHandler(async (req, res) => {
  const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user: req.user._id };
  await Feedback.findOneAndDelete(query);
  res.json({ message: 'Feedback deleted' });
});

export const replyFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findByIdAndUpdate(req.params.id, { adminReply: req.body.reply }, { new: true })
    .populate('user', 'name')
    .populate('event', 'title');
  res.json(feedback);
});

export const getPopularEvents = asyncHandler(async (req, res) => {
  const popular = await Feedback.aggregate([
    { $group: { _id: '$event', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    { $sort: { avgRating: -1, count: -1 } },
    { $limit: 10 },
  ]);

  const events = await Event.populate(popular, { path: '_id', model: 'Event', select: 'title date category' });
  res.json(events);
});

export const getEventRatings = asyncHandler(async (req, res) => {
  const ratings = await Feedback.find({ event: req.params.eventId });
  const avg = ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;
  res.json({ average: avg, count: ratings.length, ratings });
});
