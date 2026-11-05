import { Feedback } from '../models/Feedback.js';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const feedbackPopulation = [
  { path: 'user', select: 'name email' },
  { path: 'event', select: 'title date' },
];

const assertVerifiedCompletedAttendee = async (userId, eventId) => {
  const event = await Event.findById(eventId).select('status title');
  if (!event) {
    const error = new Error('The event for this feedback no longer exists.');
    error.status = 404;
    throw error;
  }
  if (event.status !== 'completed') {
    const error = new Error('Feedback can be submitted only after the event is completed.');
    error.status = 409;
    throw error;
  }
  const registration = await Registration.exists({
    user: userId,
    event: eventId,
    status: 'approved',
    attendanceStatus: 'verified',
  });
  if (!registration) {
    const error = new Error('Only participants with verified attendance can submit feedback.');
    error.status = 403;
    throw error;
  }
};

export const getFeedback = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.event) filter.event = req.query.event;
  const feedback = await Feedback.find(filter)
    .populate(feedbackPopulation)
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
  const { eventId, rating, comment = '' } = req.body || {};
  if (!eventId || !/^[a-f\d]{24}$/i.test(String(eventId))) {
    return res.status(400).json({ message: 'A valid eventId is required to submit feedback.' });
  }
  if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
    return res.status(400).json({ message: 'Rating must be a whole number between 1 and 5.' });
  }
  if (typeof comment !== 'string') {
    return res.status(400).json({ message: 'Feedback comment must be text.' });
  }
  await assertVerifiedCompletedAttendee(req.user._id, eventId);
  if (await Feedback.exists({ user: req.user._id, event: eventId })) {
    return res.status(409).json({ message: 'You have already submitted feedback for this event.' });
  }
  let feedback;
  try {
    feedback = await Feedback.create({
      user: req.user._id,
      event: eventId,
      rating: Number(rating),
      comment: comment.trim(),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'You have already submitted feedback for this event.' });
    }
    throw error;
  }
  res.status(201).json(await Feedback.findById(feedback._id).populate(feedbackPopulation));
});

export const updateFeedback = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body || {};
  if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
    return res.status(400).json({ message: 'Rating must be a whole number between 1 and 5.' });
  }
  if (comment !== undefined && typeof comment !== 'string') {
    return res.status(400).json({ message: 'Feedback comment must be text.' });
  }
  const existing = await Feedback.findOne({ _id: req.params.id, user: req.user._id }).select('event');
  if (!existing) return res.status(404).json({ message: 'Feedback not found for this account.' });
  await assertVerifiedCompletedAttendee(req.user._id, existing.event);
  const feedback = await Feedback.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { rating: Number(rating), comment: comment?.trim() ?? '' },
    { new: true, runValidators: true }
  ).populate(feedbackPopulation);
  if (!feedback) return res.status(404).json({ message: 'Feedback not found for this account.' });
  res.json(feedback);
});

export const deleteFeedback = asyncHandler(async (req, res) => {
  const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user: req.user._id };
  await Feedback.findOneAndDelete(query);
  res.json({ message: 'Feedback deleted' });
});

export const replyFeedback = asyncHandler(async (req, res) => {
  if (typeof req.body?.reply !== 'string' || !req.body.reply.trim()) {
    return res.status(400).json({ message: 'A reply is required.' });
  }
  const feedback = await Feedback.findByIdAndUpdate(req.params.id, { adminReply: req.body.reply }, { new: true })
    .populate(feedbackPopulation);
  if (!feedback) return res.status(404).json({ message: 'Feedback not found.' });
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
