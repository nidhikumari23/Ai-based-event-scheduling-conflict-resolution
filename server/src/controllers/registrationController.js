import { Registration } from '../models/Registration.js';
import { Event } from '../models/Event.js';
import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const registerForEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.body.eventId).populate('venue');
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (event.status === 'cancelled') return res.status(400).json({ message: 'Event cancelled' });

  const existing = await Registration.findOne({ user: req.user._id, event: event._id });
  if (existing) return res.status(400).json({ message: 'Already registered' });

  if (event.venue && event.registrationCount >= event.venue.capacity) {
    return res.status(400).json({ message: 'Event is full' });
  }

  const reg = await Registration.create({
    user: req.user._id,
    event: event._id,
    status: 'pending',
  });

  event.registrationCount += 1;
  await event.save();

  await Notification.create({
    user: req.user._id,
    title: 'Registration Submitted',
    message: `Your registration for "${event.title}" is pending approval.`,
    type: 'registration',
    link: `/user/registrations`,
  });

  res.status(201).json(reg);
});

export const getMyRegistrations = asyncHandler(async (req, res) => {
  const regs = await Registration.find({ user: req.user._id })
    .populate({ path: 'event', populate: ['category', 'venue', 'brands'] })
    .sort({ createdAt: -1 });
  res.json(regs);
});

export const getAllRegistrations = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.event) filter.event = req.query.event;
  if (req.query.status) filter.status = req.query.status;
  const regs = await Registration.find(filter)
    .populate('user', 'name email phone')
    .populate({ path: 'event', populate: ['venue', 'category'] })
    .sort({ createdAt: -1 });
  res.json(regs);
});

export const updateRegistrationStatus = asyncHandler(async (req, res) => {
  const reg = await Registration.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true })
    .populate('user', 'name email')
    .populate('event', 'title');

  await Notification.create({
    user: reg.user._id,
    title: 'Registration Update',
    message: `Your registration for "${reg.event.title}" is ${req.body.status}.`,
    type: 'registration',
  });

  res.json(reg);
});

export const cancelRegistration = asyncHandler(async (req, res) => {
  const reg = await Registration.findOne({ user: req.user._id, event: req.params.eventId });
  if (!reg) return res.status(404).json({ message: 'Registration not found' });

  reg.status = 'cancelled';
  await reg.save();

  const event = await Event.findById(req.params.eventId);
  if (event && event.registrationCount > 0) event.registrationCount -= 1;
  await event?.save();

  res.json({ message: 'Registration cancelled' });
});

export const removeParticipant = asyncHandler(async (req, res) => {
  await Registration.findByIdAndDelete(req.params.id);
  res.json({ message: 'Participant removed' });
});

export const exportParticipants = asyncHandler(async (req, res) => {
  const filter = req.query.event ? { event: req.query.event } : {};
  const regs = await Registration.find(filter)
    .populate('user', 'name email phone')
    .populate('event', 'title date');
  res.json(regs.map((r) => ({
    name: r.user.name,
    email: r.user.email,
    phone: r.user.phone,
    event: r.event.title,
    date: r.event.date,
    status: r.status,
  })));
});
