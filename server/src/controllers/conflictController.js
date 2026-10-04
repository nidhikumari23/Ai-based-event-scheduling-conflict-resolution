import { Conflict } from '../models/Conflict.js';
import { Event } from '../models/Event.js';
import { detectAllConflicts } from '../utils/conflictDetector.js';
import { resolveConflictWithAI } from '../utils/aiService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getConflicts = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  const conflicts = await Conflict.find(filter)
    .populate('events', 'title date startTime endTime')
    .populate('venue resource staff')
    .sort({ createdAt: -1 });
  res.json(conflicts);
});

export const detectConflicts = asyncHandler(async (req, res) => {
  const events = await Event.find({ status: { $ne: 'cancelled' } })
    .populate(['venue', 'resources.resource', 'staff']);

  const detected = detectAllConflicts(events);
  await Conflict.deleteMany({ status: 'open' });

  const saved = await Conflict.insertMany(
    detected.map((c) => ({ ...c, status: 'open' }))
  );

  res.json({ count: saved.length, conflicts: saved });
});

export const resolveConflict = asyncHandler(async (req, res) => {
  const conflict = await Conflict.findById(req.params.id);
  conflict.status = req.body.action === 'ignore' ? 'ignored' : req.body.action === 'accept' ? 'accepted' : 'resolved';
  conflict.resolution = req.body.resolution || conflict.aiSuggestion;
  conflict.resolvedBy = req.user._id;
  conflict.resolvedAt = new Date();
  await conflict.save();
  res.json(conflict);
});

export const getAISuggestion = asyncHandler(async (req, res) => {
  const conflict = await Conflict.findById(req.params.id).populate('events');
  const events = await Event.find({ _id: { $in: conflict.events } }).populate('venue');
  const suggestion = await resolveConflictWithAI(conflict, events);
  conflict.aiSuggestion = suggestion.suggestion;
  await conflict.save();
  res.json(suggestion);
});

export const getConflictsByType = asyncHandler(async (req, res) => {
  const types = ['timing', 'venue', 'resource', 'staff', 'capacity'];
  const result = {};
  for (const type of types) {
    result[type] = await Conflict.countDocuments({ type, status: 'open' });
  }
  res.json(result);
});
