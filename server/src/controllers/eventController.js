import { Event } from '../models/Event.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const populateEvent = [
  { path: 'category' },
  { path: 'venue' },
  { path: 'organizer' },
  { path: 'brands' },
  { path: 'resources.resource' },
  { path: 'staff' },
];

export const getEvents = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.venue) filter.venue = req.query.venue;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.featured === 'true') filter.isFeatured = true;
  if (req.query.search) filter.title = { $regex: req.query.search, $options: 'i' };
  if (req.query.date) {
    const d = new Date(req.query.date);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    filter.date = { $gte: d, $lt: next };
  }
  if (req.query.upcoming === 'true') {
    filter.date = { $gte: new Date() };
    filter.status = { $in: ['scheduled', 'published'] };
  }

  const events = await Event.find(filter).populate(populateEvent).sort({ date: 1, startTime: 1 });
  res.json(events);
});

export const getEventById = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id).populate(populateEvent);
  if (!event) return res.status(404).json({ message: 'Event not found' });
  res.json(event);
});

export const createEvent = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.poster = `/uploads/${req.file.filename}`;
  const event = await Event.create(data);
  res.status(201).json(await Event.findById(event._id).populate(populateEvent));
});

export const updateEvent = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.poster = `/uploads/${req.file.filename}`;
  const event = await Event.findByIdAndUpdate(req.params.id, data, { new: true }).populate(populateEvent);
  res.json(event);
});

export const deleteEvent = asyncHandler(async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);
  res.json({ message: 'Event deleted' });
});

export const cancelEvent = asyncHandler(async (req, res) => {
  const event = await Event.findByIdAndUpdate(req.params.id, { status: 'cancelled' }, { new: true }).populate(populateEvent);
  res.json(event);
});

export const rescheduleEvent = asyncHandler(async (req, res) => {
  const { date, startTime, endTime, venue } = req.body;
  const event = await Event.findByIdAndUpdate(
    req.params.id,
    { date, startTime, endTime, venue, status: 'scheduled' },
    { new: true }
  ).populate(populateEvent);
  res.json(event);
});

export const toggleFeatured = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  event.isFeatured = !event.isFeatured;
  await event.save();
  res.json(await Event.findById(event._id).populate(populateEvent));
});

export const getLiveEvents = asyncHandler(async (req, res) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const events = await Event.find({
    status: 'published',
    date: { $gte: new Date(today), $lt: new Date(new Date(today).getTime() + 86400000) },
  }).populate(populateEvent);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const live = events.filter((e) => {
    const [sh, sm] = e.startTime.split(':').map(Number);
    const [eh, em] = e.endTime.split(':').map(Number);
    return currentMinutes >= sh * 60 + sm && currentMinutes <= eh * 60 + em;
  });
  res.json(live);
});
