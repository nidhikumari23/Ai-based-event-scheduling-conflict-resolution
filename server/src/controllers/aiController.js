import { Event } from '../models/Event.js';
import { Venue } from '../models/Venue.js';
import { Resource } from '../models/Resource.js';
import { Settings } from '../models/Settings.js';
import { Schedule } from '../models/Schedule.js';
import { Registration } from '../models/Registration.js';
import {
  generateAISchedule,
  generateAIRecommendations,
  generatePersonalPlan,
} from '../utils/aiService.js';
import { detectAllConflicts } from '../utils/conflictDetector.js';
import { Conflict } from '../models/Conflict.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const generateSchedule = asyncHandler(async (req, res) => {
  const events = await Event.find({ status: { $ne: 'cancelled' } }).populate(['venue', 'category']);
  const venues = await Venue.find();
  const resources = await Resource.find();
  const settings = await Settings.findOne();

  const result = await generateAISchedule({ events, venues, resources, settings });

  let schedule = await Schedule.findOne();
  if (!schedule) schedule = new Schedule();
  schedule.aiSummary = result.summary;
  schedule.generatedBy = 'ai';
  await schedule.save();

  res.json(result);
});

export const getRecommendations = asyncHandler(async (req, res) => {
  const events = await Event.find({
    status: { $in: ['scheduled', 'published'] },
    date: { $gte: new Date() },
  }).populate('category venue');

  const result = await generateAIRecommendations(req.user, events);
  res.json(result);
});

export const getPersonalPlan = asyncHandler(async (req, res) => {
  const regs = await Registration.find({ user: req.user._id, status: 'approved' }).populate({
    path: 'event',
    populate: ['venue', 'category'],
  });
  const registeredEvents = regs.map((r) => r.event);
  const allEvents = await Event.find({ status: 'published', date: { $gte: new Date() } }).populate('category');

  const plan = await generatePersonalPlan(req.user, registeredEvents, allEvents);
  res.json(plan);
});

export const checkUserOverlaps = asyncHandler(async (req, res) => {
  const eventIds = req.body.eventIds || [];
  const events = await Event.find({ _id: { $in: eventIds } });
  const overlaps = detectAllConflicts(events).filter((c) => c.type === 'timing');
  res.json({ overlaps, hasConflict: overlaps.length > 0 });
});

export const regenerateAfterChanges = asyncHandler(async (req, res) => {
  const events = await Event.find({ status: { $ne: 'cancelled' } }).populate(['venue', 'resources.resource', 'staff']);
  const detected = detectAllConflicts(events);
  await Conflict.deleteMany({ status: 'open' });
  const saved = await Conflict.insertMany(detected.map((c) => ({ ...c, status: 'open' })));

  const aiResult = await generateAISchedule({
    events,
    venues: await Venue.find(),
    resources: await Resource.find(),
    settings: await Settings.findOne(),
  });

  res.json({ conflicts: saved, schedule: aiResult });
});
