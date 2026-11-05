import { Event } from '../models/Event.js';
import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  assertEventScheduleIsFeasible,
  httpError,
  loadSchedulingContext,
  persistValidationConflicts,
  reconcileOpenConflicts,
  resolveMatchingProposedConflicts,
  resolveProposedConflict,
  runScheduleTransaction,
} from '../services/schedulePersistence.js';
import { Schedule } from '../models/Schedule.js';
import { findFeasibleAlternatives, detectAllConflicts, getEventInterval } from '../services/schedulingEngine.js';
import { hasEventEnded } from '../utils/festivalTime.js';

const populateEvent = [
  { path: 'category' },
  { path: 'venue' },
  { path: 'organizer' },
  { path: 'brands' },
  { path: 'resources.resource' },
  { path: 'staff' },
];

const syncScheduleEntry = (schedule, event) => {
  const index = schedule.entries.findIndex((entry) => String(entry.event) === String(event._id));
  if (!['scheduled', 'published'].includes(event.status)) {
    if (index >= 0) schedule.entries.splice(index, 1);
    return;
  }
  const entry = {
    event: event._id,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    venue: event.venue?._id || event.venue,
  };
  if (index >= 0) schedule.entries[index] = entry;
  else schedule.entries.push(entry);
};

const revalidateAndReconcile = async ({ session, userId }) => {
  const { events, settings } = await loadSchedulingContext(session);
  return reconcileOpenConflicts({
    events: events.filter((event) => ['scheduled', 'published'].includes(event.status)),
    settings,
    userId,
    session,
  });
};

export const getEvents = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.venue) filter.venue = req.query.venue;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.featured === 'true') filter.isFeatured = true;
  if (req.query.search) filter.title = { $regex: req.query.search, $options: 'i' };
  if (req.query.date) {
    const d = new Date(req.query.date);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    filter.date = { $gte: d, $lt: next };
  }
  if (req.query.upcoming === 'true') {
    filter.date = { $gte: new Date() };
    filter.status = { $in: ['scheduled', 'published'] };
  }

  const events = await Event.find(filter).populate(populateEvent).sort({ date: 1, startTime: 1 });
  res.json(events);
});

export const getEventById = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id).populate(populateEvent);
  if (!event) return res.status(404).json({ message: 'Event not found' });
  res.json(event);
});

export const createEvent = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  const resolutionConflictId = data.resolutionConflictId;
  delete data.resolutionConflictId;
  if (data.status === 'completed') {
    throw httpError(400, 'Events can be marked completed only through the completion action after their scheduled end time.');
  }
  if (typeof data.category !== 'string' || !mongoose.isValidObjectId(data.category)) {
    throw httpError(400, 'A valid event category is required.');
  }
  if (!(await Category.exists({ _id: data.category }))) {
    throw httpError(400, 'The selected event category does not exist. Select an existing category.');
  }
  if (req.file) data.poster = `/uploads/${req.file.filename}`;
  if (!data.venue) delete data.venue;
  if (!data.organizer) delete data.organizer;
  let event;
  if (['scheduled', 'published'].includes(data.status)) {
    const candidate = new Event(data);
    try {
      event = await runScheduleTransaction(async ({ session, schedule }) => {
        if (schedule.isLocked) {
          const reason = schedule.lockReason ? ` Reason: ${schedule.lockReason}` : '';
          throw httpError(409, `Schedule is locked. An admin must unlock it before scheduling this event.${reason}`);
        }
        await assertEventScheduleIsFeasible(candidate, { session });
        await candidate.save({ session });
        syncScheduleEntry(schedule, candidate);
        await revalidateAndReconcile({ session, userId: req.user._id });
        if (resolutionConflictId) {
          await resolveProposedConflict(resolutionConflictId, {
            candidate,
            session,
            userId: req.user._id,
          });
        } else {
          await resolveMatchingProposedConflicts(candidate, { session, userId: req.user._id });
        }
        return candidate;
      });
    } catch (error) {
      if (error.status === 409 && error.details?.conflicts?.length) {
        await persistValidationConflicts({
          candidate,
          conflicts: error.details.conflicts,
          userId: req.user._id,
        });
      }
      throw error;
    }
  } else {
    event = await Event.create(data);
  }
  res.status(201).json(await Event.findById(event._id).populate(populateEvent));
});

export const suggestEventAlternatives = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (typeof data.category !== 'string' || !mongoose.isValidObjectId(data.category) ||
    !(await Category.exists({ _id: data.category }))) {
    throw httpError(400, 'A valid event category is required before alternatives can be suggested.');
  }

  const candidate = new Event(data);
  const candidateId = String(candidate._id);
  const context = await loadSchedulingContext();
  const venueById = new Map(context.venues.map((venue) => [String(venue._id), venue]));
  const staffById = new Map(context.staff.map((member) => [String(member._id), member]));
  const resourceById = new Map(context.resources.map((resource) => [String(resource._id), resource]));
  const event = candidate.toObject();
  event.venue = event.venue ? venueById.get(String(event.venue)) || event.venue : null;
  event.organizer = event.organizer ? staffById.get(String(event.organizer)) || event.organizer : null;
  event.staff = (event.staff || []).map((member) => staffById.get(String(member)) || member);
  event.resources = (event.resources || []).map((requirement) => ({
    ...requirement,
    resource: resourceById.get(String(requirement.resource)) || requirement.resource,
  }));
  const activeEvents = context.events.filter((item) => !['cancelled', 'completed'].includes(item.status));
  const conflicts = detectAllConflicts([...activeEvents, event], { settings: context.settings })
    .filter((item) => item.events.includes(candidateId));
  if (!conflicts.length) {
    return res.json({ conflicts: [], alternatives: [], message: 'No schedule conflicts were detected for this event.' });
  }

  const proposals = findFeasibleAlternatives({
    event,
    otherEvents: activeEvents,
    venues: context.venues,
    resources: context.resources,
    staff: context.staff,
    settings: context.settings,
    limit: Math.max(8, context.venues.length),
    options: {
      startDate: context.settings?.festivalStartDate || event.date,
      endDate: context.settings?.festivalEndDate || event.date,
    },
  });
  const alternatives = [];
  for (const proposal of proposals) {
    const proposedEvent = new Event({
      ...candidate.toObject(),
      date: new Date(`${proposal.date}T00:00:00.000Z`),
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      venue: proposal.venue,
      organizer: proposal.organizer,
      staff: proposal.staff,
      resources: proposal.resources.map(({ resource, quantity }) => ({ resource, quantity })),
    });
    try {
      await assertEventScheduleIsFeasible(proposedEvent);
    } catch (error) {
      if (error.status === 409) continue;
      throw error;
    }

    const proposedVenue = venueById.get(String(proposal.venue));
    const proposedStaff = [proposal.organizer, ...(proposal.staff || [])]
      .filter(Boolean)
      .map((id) => staffById.get(String(id)));
    const proposedResources = proposal.resources.map((requirement) => {
      const resource = resourceById.get(String(requirement.resource));
      return {
        ...requirement,
        type: resource?.type || requirement.type,
        availableQuantity: Number(resource?.available ?? resource?.quantity ?? 0),
        available: Boolean(resource && resource.isAvailable !== false &&
          Number(resource.available ?? resource.quantity ?? 0) >= Number(requirement.quantity)),
      };
    });
    const interval = getEventInterval(proposedEvent);
    const timeAvailability = interval ? {
      available: true,
      date: proposal.date,
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      setupMinutes: Math.max(0, Number(event.setupMinutes) || 0),
      cleanupMinutes: Math.max(0, Number(event.cleanupMinutes) || 0),
      reservedFrom: new Date(interval.startAt).toISOString(),
      reservedUntil: new Date(interval.endAt).toISOString(),
    } : { available: false };
    alternatives.push({
      ...proposal,
      explanation: `Passes live venue, capacity, required-facility, time, setup/cleanup buffer, staff-role, and resource quantity checks.`,
      availability: {
        time: timeAvailability,
        venue: {
          available: Boolean(proposedVenue && proposedVenue.isAvailable !== false && !proposedVenue.isBlocked),
          name: proposedVenue?.name || proposal.venueName,
          capacity: Number(proposedVenue?.capacity || 0),
          requiredCapacity: Number(event.expectedAudience || 0),
          capacitySufficient: Boolean(proposedVenue && Number(proposedVenue.capacity) >= Number(event.expectedAudience || 0)),
          requiredFacilities: event.requiredFacilities || [],
          facilitiesAvailable: Boolean(proposedVenue && (event.requiredFacilities || []).every((facility) => proposedVenue.facilities?.includes(facility))),
        },
        staff: proposedStaff.map((member) => ({
          id: String(member._id),
          name: member.name,
          role: member.role,
          available: member.isAvailable !== false,
        })),
        resources: proposedResources.map((resource) => ({
          id: String(resource.resource),
          name: resource.resourceName,
          type: resource.type,
          quantity: resource.quantity,
          availableQuantity: resource.availableQuantity,
          available: resource.available,
        })),
      },
    });
  }

  res.json({
    conflicts: conflicts.map((item) => ({
      type: item.type,
      code: item.code,
      reason: item.description,
      alternatives: alternatives.map((alternative) => ({
        ...alternative,
        explanation: `${alternative.explanation} Addresses this ${item.code} conflict.`,
      })),
    })),
    alternatives,
  });
});

export const updateEvent = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  const resolutionConflictId = data.resolutionConflictId;
  delete data.resolutionConflictId;
  if (req.file) data.poster = `/uploads/${req.file.filename}`;
  if (data.venue === '') data.venue = null;
  if (data.organizer === '') data.organizer = null;
  const scheduleFields = ['date', 'startTime', 'endTime', 'venue', 'organizer', 'staff', 'resources', 'status', 'expectedAudience', 'setupMinutes', 'cleanupMinutes', 'requiredFacilities'];
  const schedulingChange = scheduleFields.some((field) => Object.hasOwn(data, field));
  let event;
  if (schedulingChange) {
    let attemptedEvent;
    try {
      event = await runScheduleTransaction(async ({ session, schedule }) => {
        if (schedule.isLocked) throw httpError(409, 'Schedule is locked and cannot be changed.');
        const current = await Event.findById(req.params.id).session(session);
        if (!current) throw httpError(404, 'Event not found');
        if (data.status === 'completed' && current.status !== 'completed') {
          throw httpError(400, 'Use the event completion action after the scheduled end time.');
        }
        if (current.status === 'completed' && data.status && data.status !== 'completed') {
          throw httpError(409, 'Completed events cannot be reopened through event editing.');
        }
        Object.assign(current, data);
        attemptedEvent = current;
        if (['scheduled', 'published'].includes(current.status)) {
          await assertEventScheduleIsFeasible(current, { session, excludeId: current._id });
        }
        await current.save({ session });
        syncScheduleEntry(schedule, current);
        await revalidateAndReconcile({ session, userId: req.user._id });
        if (resolutionConflictId) {
          await resolveProposedConflict(resolutionConflictId, {
            candidate: current,
            session,
            userId: req.user._id,
          });
        } else if (['scheduled', 'published'].includes(current.status)) {
          await resolveMatchingProposedConflicts(current, { session, userId: req.user._id });
        }
        return current;
      });
    } catch (error) {
      if (error.status === 409 && error.details?.conflicts?.length && attemptedEvent) {
        await persistValidationConflicts({
          candidate: attemptedEvent,
          conflicts: error.details.conflicts,
          userId: req.user._id,
          isNewEvent: false,
        });
      }
      throw error;
    }
  } else {
    event = await Event.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  }
  if (!event) return res.status(404).json({ message: 'Event not found' });
  await event.populate(populateEvent);
  res.json(event);
});

export const completeEvent = asyncHandler(async (req, res) => {
  const completed = await runScheduleTransaction(async ({ session, schedule }) => {
    const event = await Event.findById(req.params.id).session(session);
    if (!event) throw httpError(404, 'Event not found.');
    if (event.status === 'completed') return event;
    if (!['scheduled', 'published'].includes(event.status)) {
      throw httpError(409, 'Only scheduled or published events can be marked completed.');
    }
    if (!hasEventEnded(event)) {
      throw httpError(409, 'An event can be marked completed only after its scheduled end time in Asia/Kolkata.');
    }
    event.status = 'completed';
    await event.save({ session });
    schedule.entries = schedule.entries.filter((entry) => String(entry.event) !== String(event._id));
    await schedule.save({ session });
    return event;
  });
  await completed.populate(populateEvent);
  res.json(completed);
});

export const deleteEvent = asyncHandler(async (req, res) => {
  await runScheduleTransaction(async ({ session, schedule }) => {
    if (schedule.isLocked) throw httpError(409, 'Schedule is locked and cannot be changed.');
    const event = await Event.findByIdAndDelete(req.params.id, { session });
    if (!event) throw httpError(404, 'Event not found');
    schedule.entries = schedule.entries.filter((entry) => String(entry.event) !== String(event._id));
    await schedule.save({ session });
    await revalidateAndReconcile({ session, userId: req.user._id });
  });
  res.json({ message: 'Event deleted' });
});

export const cancelEvent = asyncHandler(async (req, res) => {
  const event = await runScheduleTransaction(async ({ session, schedule }) => {
    if (schedule.isLocked) throw httpError(409, 'Schedule is locked and cannot be changed.');
    const current = await Event.findById(req.params.id).session(session);
    if (!current) throw httpError(404, 'Event not found');
    current.status = 'cancelled';
    await current.save({ session });
    schedule.entries = schedule.entries.filter((entry) => String(entry.event) !== String(current._id));
    await schedule.save({ session });
    await revalidateAndReconcile({ session, userId: req.user._id });
    return current;
  });
  await event.populate(populateEvent);
  res.json(event);
});

export const rescheduleEvent = asyncHandler(async (req, res) => {
  const { date, startTime, endTime, venue } = req.body;
  const event = await runScheduleTransaction(async ({ session, schedule }) => {
    if (schedule.isLocked) throw httpError(409, 'Schedule is locked and cannot be changed.');
    const current = await Event.findById(req.params.id).session(session);
    if (!current) throw httpError(404, 'Event not found');
    current.date = date;
    current.startTime = startTime;
    current.endTime = endTime;
    current.venue = venue || null;
    current.status = 'scheduled';
    await assertEventScheduleIsFeasible(current, { session, excludeId: current._id });
    await current.save({ session });
    syncScheduleEntry(schedule, current);
    await schedule.save({ session });
    await revalidateAndReconcile({ session, userId: req.user._id });
    return current;
  });
  await event.populate(populateEvent);
  res.json(event);
});

export const toggleFeatured = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  event.isFeatured = !event.isFeatured;
  await event.save();
  res.json(await Event.findById(event._id).populate(populateEvent));
});

export const getLiveEvents = asyncHandler(async (req, res) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const events = await Event.find({
    status: 'published',
    date: { $gte: new Date(today), $lt: new Date(new Date(today).getTime() + 86400000) },
  }).populate(populateEvent);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const live = events.filter((e) => {
    const [sh, sm] = e.startTime.split(':').map(Number);
    const [eh, em] = e.endTime.split(':').map(Number);
    return currentMinutes >= sh * 60 + sm && currentMinutes <= eh * 60 + em;
  });
  res.json(live);
});
