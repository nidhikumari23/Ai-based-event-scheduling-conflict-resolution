import { Event } from '../models/Event.js';
import { Venue } from '../models/Venue.js';
import { Resource } from '../models/Resource.js';
import { Settings } from '../models/Settings.js';
import { Schedule } from '../models/Schedule.js';
import { Registration } from '../models/Registration.js';
import { Feedback } from '../models/Feedback.js';
import {
  explainFeasibleSchedules,
} from '../utils/aiService.js';
import { detectAllConflicts } from '../utils/conflictDetector.js';
import { Staff } from '../models/Staff.js';
import { generateOptimalSchedule } from '../services/schedulingEngine.js';
import { answerEventQuestion, buildEventRecommendations } from '../services/recommendationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const buildScheduleProposal = async (options = {}) => {
  const [events, venues, resources, staff, settings, schedule] = await Promise.all([
    Event.find({ status: { $nin: ['cancelled', 'completed'] } })
      .populate(['venue', 'category', 'resources.resource', 'staff', 'organizer']),
    Venue.find(),
    Resource.find(),
    Staff.find(),
    Settings.findOne(),
    Schedule.findOne().sort({ updatedAt: -1 }),
  ]);
  const plan = generateOptimalSchedule({ events, venues, resources, staff, settings: settings || {}, options });
  const explanation = await explainFeasibleSchedules({
    assignments: plan.assignments.slice(0, 10),
    criteria: plan.scoreCriteria,
    context: 'administrator schedule proposal',
  });
  return {
    ...plan,
    summary: explanation.explanation,
    aiEnabled: explanation.aiEnabled,
    eventVersions: Object.fromEntries(events.map((event) => [String(event._id), event.updatedAt?.toISOString() || null])),
    scheduleRevision: schedule?.revision ?? 0,
    generatedAt: new Date().toISOString(),
  };
};

const getUpcomingFestivalEvents = async (now) => {
  const startOfToday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  const events = await Event.find({
    status: { $in: ['scheduled', 'published'] },
    date: { $gte: startOfToday },
  }).populate('category venue').lean();
  if (!events.length) return events;

  const registrationCounts = await Registration.aggregate([
    { $match: { event: { $in: events.map((event) => event._id) }, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$event', count: { $sum: 1 } } },
  ]);
  const countsByEvent = new Map(registrationCounts.map((entry) => [String(entry._id), entry.count]));
  return events.map((event) => ({
    ...event,
    registrationCount: Math.max(
      Number(event.registrationCount || 0),
      countsByEvent.get(String(event._id)) || 0
    ),
  }));
};

export const generateSchedule = asyncHandler(async (req, res, next) => {
  const options = req.body ?? {};
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return res.status(400).json({
      code: 'INVALID_SCHEDULE_REQUEST',
      message: 'Schedule generation options must be a JSON object.',
      details: { field: 'body' },
    });
  }
  for (const field of ['startDate', 'endDate']) {
    if (options[field] !== undefined &&
      (typeof options[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(options[field]))) {
      return res.status(400).json({
        code: 'INVALID_SCHEDULE_REQUEST',
        message: `${field} must be a valid YYYY-MM-DD date.`,
        details: { field },
      });
    }
  }
  try {
    const proposal = await buildScheduleProposal(options);
    return res.json(proposal);
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({
        code: error.code || 'INVALID_SCHEDULE_REQUEST',
        message: error.message,
        ...(error.details && { details: error.details }),
      });
    }
    return next(error);
  }
});

export const getRecommendations = asyncHandler(async (req, res) => {
  const now = new Date();
  const [events, registrations, feedback] = await Promise.all([
    getUpcomingFestivalEvents(now),
    Registration.find({ user: req.user._id })
      .populate({ path: 'event', populate: { path: 'category' } })
      .lean(),
    Feedback.find({ user: req.user._id })
      .populate({ path: 'event', populate: { path: 'category' } })
      .lean(),
  ]);
  const recommendations = buildEventRecommendations({
    events,
    registrations,
    feedback,
    interests: req.user.interests || [],
    skills: req.user.skills || [],
    now,
  });
  res.json({
    summary: 'Ranked from your saved interests and skills, registration history, and feedback. Availability and schedule conflicts use current festival data.',
    preferences: {
      interests: req.user.interests || [],
      skills: req.user.skills || [],
    },
    recommendations,
  });
});

export const answerEventAssistant = asyncHandler(async (req, res) => {
  const question = req.body?.question;
  if (typeof question !== 'string' || question.trim().length < 3 || question.trim().length > 500) {
    return res.status(400).json({
      message: 'Ask a question between 3 and 500 characters.',
    });
  }
  const now = new Date();
  const events = await getUpcomingFestivalEvents(now);
  res.json(answerEventQuestion(question.trim(), events, now));
});

export const getPersonalPlan = asyncHandler(async (req, res) => {
  const registrations = await Registration.find({ user: req.user._id, status: 'approved' })
    .populate({ path: 'event', populate: ['venue', 'category'] });
  const registeredEvents = registrations.map((registration) => registration.event).filter(Boolean);
  const conflicts = detectAllConflicts(registeredEvents).filter((conflict) => conflict.type === 'timing');
  const plan = registeredEvents
    .sort((left, right) =>
      new Date(left.date) - new Date(right.date) ||
      left.startTime.localeCompare(right.startTime)
    )
    .map((event) => ({
      time: `${event.date.toISOString().slice(0, 10)} ${event.startTime}–${event.endTime}`,
      event: event.title,
      venue: event.venue?.name || 'TBD',
    }));
  res.json({
    plan,
    warnings: conflicts.map((conflict) => conflict.description),
    summary: plan.length
      ? 'Your plan lists events with approved registrations, ordered by date and start time.'
      : 'Your approved event registrations will appear here.',
  });
});

export const checkUserOverlaps = asyncHandler(async (req, res) => {
  const eventIds = req.body.eventIds || [];
  const events = await Event.find({ _id: { $in: eventIds } });
  const overlaps = detectAllConflicts(events).filter((c) => c.type === 'timing');
  res.json({ overlaps, hasConflict: overlaps.length > 0 });
});

export const regenerateAfterChanges = asyncHandler(async (req, res) => {
  const [events, proposal] = await Promise.all([
    Event.find({ status: { $in: ['scheduled', 'published'] } })
      .populate(['venue', 'resources.resource', 'staff', 'organizer']),
    buildScheduleProposal(req.body || {}),
  ]);
  res.json({ conflicts: detectAllConflicts(events), schedule: proposal });
});
