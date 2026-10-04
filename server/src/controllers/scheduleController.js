import { Schedule } from '../models/Schedule.js';
import { Event } from '../models/Event.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getSchedule = asyncHandler(async (req, res) => {
  let schedule = await Schedule.findOne().populate({
    path: 'entries.event',
    populate: ['category', 'venue', 'brands'],
  });
  if (!schedule) {
    schedule = await Schedule.create({ entries: [] });
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
  let schedule = await Schedule.findOne();
  if (!schedule) schedule = new Schedule();
  if (schedule.isLocked) return res.status(400).json({ message: 'Schedule is locked' });

  Object.assign(schedule, req.body);
  await schedule.save();
  res.json(await Schedule.findById(schedule._id).populate({ path: 'entries.event', populate: ['category', 'venue'] }));
});

export const generateScheduleFromEvents = asyncHandler(async (req, res) => {
  const events = await Event.find({ status: { $in: ['scheduled', 'published'] } }).populate('venue');
  let schedule = await Schedule.findOne();
  if (!schedule) schedule = new Schedule();

  schedule.entries = events.map((e) => ({
    event: e._id,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    venue: e.venue?._id,
  }));
  schedule.generatedBy = req.body.generatedBy || 'manual';
  schedule.aiSummary = req.body.aiSummary || '';
  await schedule.save();

  res.json(await Schedule.findById(schedule._id).populate({ path: 'entries.event', populate: ['category', 'venue'] }));
});

export const lockSchedule = asyncHandler(async (req, res) => {
  const schedule = await Schedule.findOne();
  schedule.isLocked = true;
  await schedule.save();
  res.json(schedule);
});

export const publishSchedule = asyncHandler(async (req, res) => {
  const schedule = await Schedule.findOne();
  schedule.isPublished = req.body.publish !== false;
  await schedule.save();
  res.json(schedule);
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
