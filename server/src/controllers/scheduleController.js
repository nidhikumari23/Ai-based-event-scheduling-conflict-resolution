import { Schedule } from '../models/Schedule.js';
import { Event } from '../models/Event.js';
import { detectAllConflicts } from '../utils/conflictDetector.js';
import {
  applyScheduleProposal,
  getEventVersionSnapshot,
  httpError,
  loadSchedulingContext,
  runScheduleTransaction,
  validateScheduleProposal,
} from '../services/schedulePersistence.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getSchedule = asyncHandler(async (req, res) => {
  let schedule = await Schedule.findOne({ singletonKey: 'festival' }).select('+singletonKey').populate([
    { path: 'entries.event', populate: ['category', 'venue', 'brands'] },
    { path: 'lockedBy', select: 'name' },
  ]);
  if (!schedule) {
    schedule = await Schedule.findOne().select('+singletonKey').populate({ path: 'lockedBy', select: 'name' });
  }
  if (!schedule) {
    try {
      schedule = await Schedule.create({ singletonKey: 'festival', entries: [] });
    } catch (error) {
      if (error.code !== 11000) throw error;
      schedule = await Schedule.findOne({ singletonKey: 'festival' }).populate([
        { path: 'entries.event', populate: ['category', 'venue', 'brands'] },
        { path: 'lockedBy', select: 'name' },
      ]);
    }
  }
  res.json(schedule);
});

export const getPublicSchedule = asyncHandler(async (req, res) => {
  const schedule = await Schedule.findOne({ isPublished: true }).populate({
    path: 'entries.event',
    populate: ['category', 'venue'],
  });
  if (!schedule) {
    const events = await Event.find({ status: 'published' })
      .populate(['category', 'venue'])
      .sort({ date: 1, startTime: 1 });
    return res.json({ isPublished: false, entries: events.map((e) => ({ event: e, date: e.date, startTime: e.startTime, endTime: e.endTime, venue: e.venue })) });
  }
  res.json(schedule);
});

export const saveSchedule = asyncHandler(async (req, res) => {
  const schedule = await Schedule.findOne({ singletonKey: 'festival' }).select('+singletonKey');
  const currentSchedule = schedule || await Schedule.findOne();
  if (currentSchedule?.isLocked) return res.status(409).json({ message: 'Schedule is locked' });
  if (!Array.isArray(req.body.entries)) return res.status(400).json({ message: 'Schedule entries must be an array' });

  const { events } = await loadSchedulingContext();
  const eventsById = new Map(events.map((event) => [String(event._id), event]));
  const assignments = req.body.entries.map((entry) => {
    const eventId = String(entry.event?._id || entry.event || '');
    const event = eventsById.get(eventId);
    if (!event) throw httpError(400, `Schedule entry references unknown event ${eventId}.`);
    return {
      eventId,
      date: entry.date instanceof Date ? entry.date.toISOString().slice(0, 10) : String(entry.date).slice(0, 10),
      startTime: entry.startTime,
      endTime: entry.endTime,
      venue: String(entry.venue?._id || entry.venue || event.venue?._id || event.venue || ''),
      organizer: event.organizer?._id || event.organizer || null,
      staff: (event.staff || []).map((member) => String(member._id || member)),
    };
  });
  const eventVersions = getEventVersionSnapshot(events);
  const result = await applyScheduleProposal({
    assignments,
    eventVersions,
    scheduleRevision: currentSchedule?.revision ?? 0,
    summary: req.body.aiSummary,
    userId: req.user._id,
  });
  res.json(await Schedule.findById(result.schedule._id).populate({ path: 'entries.event', populate: ['category', 'venue'] }));
});

export const generateScheduleFromEvents = asyncHandler(async (req, res) => {
  const result = await runScheduleTransaction(async ({ session, schedule }) => {
    if (schedule.isLocked) throw httpError(409, 'Schedule is locked');
    const { events, settings } = await loadSchedulingContext(session);
    const conflicts = detectAllConflicts(events.filter((event) => ['scheduled', 'published'].includes(event.status)), { settings });
    if (conflicts.length) {
      throw httpError(409, 'Cannot sync a schedule that contains conflicts. Generate and approve a feasible proposal first.', { conflicts });
    }
    schedule.entries = events
      .filter((event) => ['scheduled', 'published'].includes(event.status))
      .map((event) => ({
        event: event._id,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        venue: event.venue?._id || event.venue,
      }));
    schedule.generatedBy = ['manual', 'ai', 'hybrid'].includes(req.body.generatedBy) ? req.body.generatedBy : 'manual';
    schedule.aiSummary = typeof req.body.aiSummary === 'string' ? req.body.aiSummary.slice(0, 1000) : schedule.aiSummary;
    await schedule.save({ session });
    return schedule;
  });
  res.json(await Schedule.findById(result._id).populate({ path: 'entries.event', populate: ['category', 'venue'] }));
});

export const lockSchedule = asyncHandler(async (req, res) => {
  const reason = typeof req.body?.reason === 'string'
    ? req.body.reason.trim().slice(0, 500)
    : '';
  const schedule = await runScheduleTransaction(async ({ session, schedule }) => {
    schedule.isLocked = true;
    schedule.lockReason = reason || 'Locked by an administrator to prevent schedule changes.';
    schedule.lockedAt = new Date();
    schedule.lockedBy = req.user._id;
    await schedule.save({ session });
    return schedule;
  });
  res.json(schedule);
});

export const unlockSchedule = asyncHandler(async (_req, res) => {
  const schedule = await runScheduleTransaction(async ({ session, schedule }) => {
    schedule.isLocked = false;
    schedule.lockReason = '';
    schedule.lockedAt = null;
    schedule.lockedBy = null;
    await schedule.save({ session });
    return schedule;
  });
  res.json(schedule);
});

export const publishSchedule = asyncHandler(async (req, res) => {
  const schedule = await runScheduleTransaction(async ({ session, schedule }) => {
    const publish = req.body.publish !== false;
    if (publish) {
      const { events, settings } = await loadSchedulingContext(session);
      const conflicts = detectAllConflicts(events.filter((event) => ['scheduled', 'published'].includes(event.status)), { settings });
      if (conflicts.length) throw httpError(409, 'Cannot publish a schedule with unresolved conflicts.', { conflicts });
    }
    schedule.isPublished = publish;
    await schedule.save({ session });
    return schedule;
  });
  res.json(schedule);
});

export const validateSchedule = asyncHandler(async (req, res) => {
  const result = await validateScheduleProposal(req.body);
  res.json({
    valid: true,
    assignments: result.updatedEvents.length,
    conflicts: [],
    score: Math.round(result.updatedEvents.reduce((sum, item) => sum + (Number(item.assignment.score) || 0), 0) / result.updatedEvents.length),
  });
});

export const approveSchedule = asyncHandler(async (req, res) => {
  const result = await applyScheduleProposal({
    ...req.body,
    userId: req.user._id,
  });
  const schedule = await Schedule.findById(result.schedule._id)
    .populate({ path: 'entries.event', populate: ['category', 'venue', 'staff', 'organizer'] });
  res.json({ message: 'Schedule saved and revalidated without conflicts.', schedule, ...result });
});

export const getScheduleByView = asyncHandler(async (req, res) => {
  const { view } = req.params;
  const events = await Event.find({ status: { $in: ['scheduled', 'published'] } })
    .populate(['category', 'venue'])
    .sort({ date: 1, startTime: 1 });

  if (view === 'day') {
    const grouped = {};
    events.forEach((e) => {
      const key = new Date(e.date).toDateString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    });
    return res.json(grouped);
  }
  if (view === 'venue') {
    const grouped = {};
    events.forEach((e) => {
      const key = e.venue?.name || 'Unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    });
    return res.json(grouped);
  }
  if (view === 'category') {
    const grouped = {};
    events.forEach((e) => {
      const key = e.category?.name || 'Uncategorized';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    });
    return res.json(grouped);
  }
  res.json(events);
});
