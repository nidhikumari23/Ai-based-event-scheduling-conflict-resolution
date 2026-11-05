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

const FESTIVAL_TIME_ZONE = 'Asia/Kolkata';

const getFestivalClock = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FESTIVAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    minuteOfDay: Number(values.hour) * 60 + Number(values.minute),
  };
};

export const selectUpcomingAdminEvents = (events, now = new Date(), limit = 5) => {
  const { dateKey: today, minuteOfDay: currentMinute } = getFestivalClock(now);
  return events
    .filter((event) => {
      if (!['scheduled', 'published'].includes(event.status)) return false;
      const eventDate = event.date instanceof Date ? event.date : new Date(event.date);
      if (Number.isNaN(eventDate.getTime())) return false;
      const eventDay = eventDate.toISOString().slice(0, 10);
      if (eventDay > today) return true;
      if (eventDay < today || typeof event.startTime !== 'string') return false;
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(event.startTime);
      return Boolean(match && Number(match[1]) * 60 + Number(match[2]) >= currentMinute);
    })
    .sort((first, second) =>
      new Date(first.date).getTime() - new Date(second.date).getTime() ||
      String(first.startTime || '').localeCompare(String(second.startTime || ''))
    )
    .slice(0, limit);
};

export const getAdminDashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const { dateKey: festivalToday } = getFestivalClock(now);
  const todayStart = new Date(`${festivalToday}T00:00:00.000Z`);
  const [
    events,
    venues,
    users,
    resources,
    upcoming,
    conflicts,
    schedule,
    totalRegistrations,
    approvedRegistrations,
    scheduledEvents,
    openConflicts,
    resolvedConflicts,
    resourceUsage,
  ] = await Promise.all([
    Event.countDocuments(),
    Venue.countDocuments(),
    User.countDocuments({ role: 'user' }),
    Resource.countDocuments(),
    Event.find({
      date: { $gte: todayStart },
      status: { $in: ['scheduled', 'published'] },
    })
      .populate(['category', 'venue'])
      .sort({ date: 1, startTime: 1 }),
    Conflict.find({ status: 'open' }).limit(5).populate('events', 'title'),
    Schedule.findOne().sort({ updatedAt: -1 }),
    Registration.countDocuments(),
    Registration.countDocuments({ status: 'approved' }),
    Event.countDocuments({ status: { $in: ['scheduled', 'published'] } }),
    Conflict.countDocuments({ status: 'open' }),
    Conflict.countDocuments({ status: 'resolved' }),
    Resource.find().select('name quantity available type'),
  ]);
  const upcomingEvents = selectUpcomingAdminEvents(upcoming, now);

  res.json({
    stats: {
      totalEvents: events,
      totalVenues: venues,
      totalParticipants: users,
      totalResources: resources,
      totalRegistrations,
      approvedRegistrations,
      scheduledEvents,
      openConflicts,
      resolvedConflicts,
    },
    upcomingEvents,
    conflictAlerts: conflicts,
    resourceUsage,
    aiScheduleSummary: schedule?.aiSummary || 'No AI schedule generated yet',
    schedulePublished: schedule?.isPublished || false,
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
