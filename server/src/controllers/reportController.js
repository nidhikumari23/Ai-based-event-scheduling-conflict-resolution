import * as XLSX from 'xlsx';
import { Event } from '../models/Event.js';
import { Venue } from '../models/Venue.js';
import { Resource } from '../models/Resource.js';
import { Registration } from '../models/Registration.js';
import { Conflict } from '../models/Conflict.js';
import { Feedback } from '../models/Feedback.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getParticipationReport = asyncHandler(async (req, res) => {
  const events = await Event.find().populate('category venue');
  const report = events.map((e) => ({
    title: e.title,
    category: e.category?.name,
    venue: e.venue?.name,
    date: e.date,
    expected: e.expectedAudience,
    registered: e.registrationCount,
    fillRate: e.venue ? `${Math.round((e.registrationCount / e.venue.capacity) * 100)}%` : 'N/A',
  }));
  res.json(report);
});

export const getVenueUtilization = asyncHandler(async (req, res) => {
  const venues = await Venue.find();
  const report = await Promise.all(
    venues.map(async (v) => {
      const events = await Event.countDocuments({ venue: v._id, status: { $ne: 'cancelled' } });
      return { venue: v.name, capacity: v.capacity, eventsBooked: events, utilization: `${Math.min(events * 20, 100)}%` };
    })
  );
  res.json(report);
});

export const getResourceUtilization = asyncHandler(async (req, res) => {
  const resources = await Resource.find();
  res.json(
    resources.map((r) => ({
      name: r.name,
      type: r.type,
      total: r.quantity,
      available: r.available,
      used: r.quantity - r.available,
      utilization: r.quantity ? `${Math.round(((r.quantity - r.available) / r.quantity) * 100)}%` : '0%',
    }))
  );
});

export const getConflictReport = asyncHandler(async (req, res) => {
  const conflicts = await Conflict.find().populate('events', 'title');
  res.json(conflicts);
});

export const getRegistrationReport = asyncHandler(async (req, res) => {
  const stats = await Registration.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  res.json(stats);
});

export const getCancelledEventsReport = asyncHandler(async (req, res) => {
  const events = await Event.find({ status: 'cancelled' }).populate(['category', 'venue']);
  res.json(events);
});

export const getAIScheduleReport = asyncHandler(async (req, res) => {
  const { Schedule } = await import('../models/Schedule.js');
  const schedule = await Schedule.findOne();
  res.json({
    generatedBy: schedule?.generatedBy,
    summary: schedule?.aiSummary,
    isPublished: schedule?.isPublished,
    entryCount: schedule?.entries?.length || 0,
  });
});

export const exportReport = asyncHandler(async (req, res) => {
  const { type } = req.params;
  let data = [];

  if (type === 'participation') {
    const events = await Event.find().populate('category venue');
    data = events.map((e) => ({
      Title: e.title,
      Category: e.category?.name,
      Venue: e.venue?.name,
      Date: e.date,
      Registered: e.registrationCount,
    }));
  } else if (type === 'registrations') {
    const regs = await Registration.find().populate('user event');
    data = regs.map((r) => ({
      User: r.user?.name,
      Event: r.event?.title,
      Status: r.status,
    }));
  } else {
    data = [{ Message: 'Report type not found' }];
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, type);
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', `attachment; filename=${type}-report.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});
