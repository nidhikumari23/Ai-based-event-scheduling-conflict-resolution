import { User } from '../models/User.js';
import { Registration } from '../models/Registration.js';
import { Feedback } from '../models/Feedback.js';
import { Notification } from '../models/Notification.js';
import { Event } from '../models/Event.js';
import { Settings } from '../models/Settings.js';
import { detectAllConflicts } from '../utils/conflictDetector.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getPersonalSchedule = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'personalSchedule',
    populate: ['category', 'venue', 'brands'],
  });
  res.json(user.personalSchedule || []);
});

export const addToPersonalSchedule = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ message: 'Event not found' });

  const user = await User.findById(req.user._id);
  if (!user.personalSchedule.some((id) => String(id) === String(event._id))) {
    user.personalSchedule.push(event._id);
    await user.save();
  }

  const populated = await User.findById(user._id).populate({
    path: 'personalSchedule',
    populate: ['category', 'venue'],
  });
  res.json(populated.personalSchedule);
});

export const removeFromPersonalSchedule = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.personalSchedule = user.personalSchedule.filter((id) => String(id) !== String(req.params.eventId));
  await user.save();
  res.json({ message: 'Removed from personal schedule' });
});

export const getUserStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [regs, feedbackCount, unreadNotifications, user, settings] = await Promise.all([
    Registration.find({ user: userId }).populate({ path: 'event', populate: ['venue', 'category'] }),
    Feedback.countDocuments({ user: userId }),
    Notification.countDocuments({ user: userId, isRead: false }),
    User.findById(userId).populate({ path: 'personalSchedule', populate: ['category', 'venue'] }),
    Settings.findOne(),
  ]);

  const approved = regs.filter((r) => r.status === 'approved');
  const pending = regs.filter((r) => r.status === 'pending');
  const upcoming = approved
    .map((r) => r.event)
    .filter((e) => e && new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const personalEvents = user.personalSchedule || [];
  const overlapEvents = personalEvents.length > 1 ? personalEvents : upcoming;
  const overlaps = overlapEvents.length > 1 ? detectAllConflicts(overlapEvents).filter((c) => c.type === 'timing') : [];

  res.json({
    registrations: {
      total: regs.length,
      approved: approved.length,
      pending: pending.length,
      cancelled: regs.filter((r) => r.status === 'cancelled').length,
    },
    feedbackCount,
    unreadNotifications,
    personalScheduleCount: personalEvents.length,
    upcomingRegistered: upcoming.slice(0, 6),
    personalSchedule: personalEvents.slice(0, 6),
    scheduleOverlaps: overlaps,
    festival: {
      name: settings?.festivalName || 'Metro Nexus Festival',
      startDate: settings?.festivalStartDate,
      endDate: settings?.festivalEndDate,
    },
  });
});
