import { Event } from '../models/Event.js';
import { Venue } from '../models/Venue.js';
import { Resource } from '../models/Resource.js';
import { User } from '../models/User.js';
import { Registration } from '../models/Registration.js';
import { Conflict } from '../models/Conflict.js';
import { Schedule } from '../models/Schedule.js';
import { Feedback } from '../models/Feedback.js';
import { Notification } from '../models/Notification.js';
import { Settings } from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getAdminDashboard = asyncHandler(async (req, res) => {
  const [events, venues, users, resources, upcoming, conflicts, schedule, registrations] = await Promise.all([
    Event.countDocuments(),
    Venue.countDocuments(),
    User.countDocuments({ role: 'user' }),
    Resource.countDocuments(),
    Event.find({ date: { $gte: new Date() }, status: { $ne: 'cancelled' } })
      .populate(['category', 'venue'])
      .sort({ date: 1 })
      .limit(5),
    Conflict.find({ status: 'open' }).limit(5).populate('events', 'title'),
    Schedule.findOne(),
    Registration.countDocuments({ status: 'approved' }),
  ]);

  const resourceUsage = await Resource.find().select('name quantity available type');

  res.json({
    stats: {
      totalEvents: events,
      totalVenues: venues,
      totalParticipants: users,
      totalResources: resources,
      approvedRegistrations: registrations,
      openConflicts: await Conflict.countDocuments({ status: 'open' }),
    },
    upcomingEvents: upcoming,
    conflictAlerts: conflicts,
    resourceUsage,
    aiScheduleSummary: schedule?.aiSummary || 'No AI schedule generated yet',
  });
});

export const getUserDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [regs, notifications, recommendations, user, settings, feedbackCount, liveEvents] = await Promise.all([
    Registration.find({ user: userId, status: { $in: ['approved', 'pending'] } })
      .populate({ path: 'event', populate: ['venue', 'category'] }),
    Notification.find({ $or: [{ user: userId }, { broadcast: true }] }).sort({ createdAt: -1 }).limit(6),
    Event.find({ status: 'published', isFeatured: true, date: { $gte: new Date() } })
      .populate(['category', 'venue'])
      .limit(4),
    User.findById(userId).populate({ path: 'personalSchedule', populate: ['category', 'venue'] }),
    Settings.findOne(),
    Feedback.countDocuments({ user: userId }),
    Event.find({
      status: 'published',
      date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)), $lt: new Date(new Date().setHours(23, 59, 59, 999)) },
    }).populate(['venue', 'category']).limit(3),
  ]);

  const upcoming = regs
    .map((r) => r.event)
    .filter((e) => e && new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  res.json({
    user: { name: req.user.name, email: req.user.email, interests: req.user.interests },
    festival: {
      name: settings?.festivalName || 'Metro Nexus Festival',
      startDate: settings?.festivalStartDate,
      endDate: settings?.festivalEndDate,
    },
    stats: {
      registeredCount: regs.length,
      approvedCount: regs.filter((r) => r.status === 'approved').length,
      pendingCount: regs.filter((r) => r.status === 'pending').length,
      personalScheduleCount: user?.personalSchedule?.length || 0,
      unreadNotifications: notifications.filter((n) => !n.isRead).length,
      feedbackCount,
    },
    upcomingRegistered: upcoming.slice(0, 5),
    personalSchedule: (user?.personalSchedule || []).slice(0, 5),
    notifications,
    recommendedEvents: recommendations,
    liveEvents,
  });
});
