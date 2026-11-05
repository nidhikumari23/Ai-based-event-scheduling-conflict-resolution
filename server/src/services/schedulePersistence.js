import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { Schedule } from '../models/Schedule.js';
import { Venue } from '../models/Venue.js';
import { Resource } from '../models/Resource.js';
import { Staff } from '../models/Staff.js';
import { Conflict } from '../models/Conflict.js';
import { Settings } from '../models/Settings.js';
import { detectAllConflicts, parseTime } from '../utils/conflictDetector.js';
import { conflictFingerprint, proposedEventFingerprint } from '../utils/conflictIdentity.js';

const activeEventFilter = { status: { $nin: ['cancelled', 'completed'] } };
const eventPopulation = ['venue', 'resources.resource', 'staff', 'organizer'];
const idOf = (value) => {
  const id = value?._id ?? value?.id ?? value;
  return id == null ? '' : String(id);
};

export const httpError = (status, message, details) => Object.assign(new Error(message), { status, details });

export const runScheduleTransaction = async (operation) => {
  await Schedule.init();
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      let schedule = await Schedule.findOne({ singletonKey: 'festival' })
        .select('+singletonKey')
        .session(session);
      if (!schedule) {
        schedule = await Schedule.findOne().select('+singletonKey').session(session);
      }
      if (!schedule) {
        schedule = new Schedule({ singletonKey: 'festival', entries: [] });
        await schedule.save({ session });
      } else if (schedule.singletonKey !== 'festival') {
        schedule.singletonKey = 'festival';
        await schedule.save({ session });
      }

      result = await operation({ session, schedule });
      schedule.revision = (Number(schedule.revision) || 0) + 1;
      await schedule.save({ session });
    });
    return result;
  } catch (error) {
    if (error?.code === 11000) {
      throw httpError(409, 'Another schedule update is in progress. Reload the schedule and retry.');
    }
    if (error?.codeName === 'IllegalOperation' || /Transaction numbers are only allowed/i.test(error?.message || '')) {
      throw httpError(503, 'Schedule changes require MongoDB transaction support. Configure the database as a replica set or use MongoDB Atlas.');
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

export const loadSchedulingContext = async (session) => {
  let eventsQuery = Event.find(activeEventFilter).populate(eventPopulation);
  let venuesQuery = Venue.find();
  let resourcesQuery = Resource.find();
  let staffQuery = Staff.find();
  let settingsQuery = Settings.findOne();
  if (session) {
    eventsQuery = eventsQuery.session(session);
    venuesQuery = venuesQuery.session(session);
    resourcesQuery = resourcesQuery.session(session);
    staffQuery = staffQuery.session(session);
    settingsQuery = settingsQuery.session(session);
  }
  const [events, venues, resources, staff, settings] = await Promise.all([
    eventsQuery,
    venuesQuery,
    resourcesQuery,
    staffQuery,
    settingsQuery,
  ]);
  return { events, venues, resources, staff, settings };
};

export const assertEventScheduleIsFeasible = async (candidate, { session, excludeId } = {}) => {
  const context = await loadSchedulingContext(session);
  const { events, venues, resources, staff, settings } = context;
  const eventById = new Map(events
    .filter((event) => ['scheduled', 'published'].includes(event.status))
    .map((event) => [String(event._id), event]));
  const venueById = new Map(venues.map((venue) => [String(venue._id), venue]));
  const resourceById = new Map(resources.map((resource) => [String(resource._id), resource]));
  const staffById = new Map(staff.map((member) => [String(member._id), member]));
  const candidateData = candidate.toObject ? candidate.toObject() : { ...candidate };
  const candidateId = String(candidateData._id || '');
  if (excludeId || candidateId) eventById.delete(String(excludeId || candidateId));

  candidateData.venue = candidateData.venue ? venueById.get(String(candidateData.venue._id || candidateData.venue)) || candidateData.venue : null;
  candidateData.organizer = candidateData.organizer
    ? staffById.get(String(candidateData.organizer._id || candidateData.organizer)) || candidateData.organizer
    : null;
  candidateData.staff = (candidateData.staff || []).map((member) =>
    staffById.get(String(member._id || member)) || member
  );
  candidateData.resources = (candidateData.resources || []).map((requirement) => ({
    ...requirement,
    resource: resourceById.get(String(requirement.resource?._id || requirement.resource)) || requirement.resource,
  }));
  const conflicts = detectAllConflicts([...eventById.values(), candidateData], { settings })
    .filter((conflict) => conflict.events.includes(candidateId));
  if (conflicts.length) {
    throw httpError(409, 'The proposed event schedule conflicts with current venue, timing, buffer, staff, resource, or capacity constraints.', { conflicts });
  }
  return context;
};

export const persistValidationConflicts = async ({ candidate, conflicts, userId, isNewEvent = true }) => {
  const event = candidate.toObject ? candidate.toObject({ depopulate: true }) : { ...candidate };
  const proposalFingerprint = proposedEventFingerprint(event);
  const proposedEvent = {
    eventId: event._id,
    isNewEvent,
    title: event.title,
    description: event.description,
    category: event.category,
    venue: event.venue,
    organizer: event.organizer,
    staff: event.staff || [],
    resources: (event.resources || []).map(({ resource, quantity }) => ({ resource, quantity })),
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    expectedAudience: event.expectedAudience,
    setupMinutes: event.setupMinutes,
    cleanupMinutes: event.cleanupMinutes,
    requiredFacilities: event.requiredFacilities || [],
    status: event.status,
  };

  for (const detected of conflicts) {
    const persistedEvents = (detected.events || [])
      .map(idOf)
      .filter((id) => !isNewEvent || id !== idOf(event._id))
      .filter(mongoose.isValidObjectId);
    const record = {
      ...detected,
      events: persistedEvents,
      proposedEvent,
      proposalFingerprint,
      detectedAt: new Date(),
      detectedBy: userId,
      status: 'open',
      resolution: '',
      resolvedBy: null,
      resolvedAt: null,
    };
    record.fingerprint = conflictFingerprint(record);
    try {
      await Conflict.findOneAndUpdate(
        { fingerprint: record.fingerprint },
        { $set: record },
        { upsert: true, new: true, runValidators: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      await Conflict.findOneAndUpdate(
        { fingerprint: record.fingerprint },
        { $set: record },
        { new: true, runValidators: true }
      );
    }
  }
};

export const resolveProposedConflict = async (conflictId, { candidate, session, userId, resolution }) => {
  if (!mongoose.isValidObjectId(conflictId)) {
    throw httpError(400, 'A valid conflict record is required to resolve a suggested alternative.');
  }
  let findQuery = Conflict.findOne(
    { _id: conflictId, status: 'open', proposedEvent: { $exists: true } },
  );
  if (session) findQuery = findQuery.session(session);
  const conflict = await findQuery;
  if (!conflict) {
    throw httpError(409, 'The validation conflict is no longer open or has no proposed event to resolve.');
  }
  const candidateData = candidate.toObject ? candidate.toObject({ depopulate: true }) : candidate;
  const proposal = conflict.proposedEvent;
  if (candidateData.title !== proposal.title ||
    idOf(candidateData.category) !== idOf(proposal.category)) {
    throw httpError(409, 'The scheduled event does not match the proposal linked to this conflict.');
  }
  const update = {
    $set: {
      status: 'resolved',
      resolution: resolution || 'A selected alternative was saved after backend schedule revalidation.',
      resolvedBy: userId,
      resolvedAt: new Date(),
    },
  };
  let updateQuery = Conflict.updateMany(
    conflict.proposalFingerprint
      ? { proposalFingerprint: conflict.proposalFingerprint, status: 'open' }
      : { _id: conflict._id, status: 'open' },
    update
  );
  if (session) updateQuery = updateQuery.session(session);
  await updateQuery;
  return conflict;
};

export const resolveMatchingProposedConflicts = async (candidate, { session, userId } = {}) => {
  const event = candidate.toObject ? candidate.toObject({ depopulate: true }) : candidate;
  const filter = { proposalFingerprint: proposedEventFingerprint(event), status: 'open' };
  const update = {
    $set: {
      status: 'resolved',
      resolution: 'The proposed event was saved after backend schedule revalidation.',
      resolvedBy: userId || null,
      resolvedAt: new Date(),
    },
  };
  let query = Conflict.updateMany(filter, update);
  if (session) query = query.session(session);
  await query;
};

export const reconcileOpenConflicts = async ({ events, settings, userId, session }) => {
  const detected = detectAllConflicts(events, { settings });
  const activeFingerprints = new Set(detected.map(conflictFingerprint));
  let openQuery = Conflict.find({ status: 'open' });
  if (session) openQuery = openQuery.session(session);
  const open = await openQuery;
  for (const conflict of open.filter((item) => !item.proposedEvent)) {
    const fingerprint = conflict.fingerprint || conflictFingerprint(conflict);
    if (!activeFingerprints.has(fingerprint)) {
      conflict.status = 'resolved';
      conflict.resolution = 'No longer detected after a saved schedule change and revalidation.';
      conflict.resolvedBy = userId || null;
      conflict.resolvedAt = new Date();
      await conflict.save({ session });
    }
  }
  return detected;
};

const validatePlanShape = (assignments) => {
  if (!Array.isArray(assignments) || !assignments.length) {
    throw httpError(400, 'A non-empty assignments array is required.');
  }
  const ids = assignments.map((item) => String(item?.eventId || ''));
  if (ids.some((id) => !mongoose.isValidObjectId(id)) || new Set(ids).size !== ids.length) {
    throw httpError(400, 'Each schedule assignment must contain a unique valid eventId.');
  }
  for (const assignment of assignments) {
    if (typeof assignment.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(assignment.date) ||
      Number.isNaN(Date.parse(`${assignment.date}T00:00:00.000Z`)) ||
      parseTime(assignment.startTime) == null ||
      parseTime(assignment.endTime) == null ||
      assignment.startTime === assignment.endTime ||
      !mongoose.isValidObjectId(String(assignment.venue || '')) ||
      !Array.isArray(assignment.staff) ||
      (assignment.organizer != null && !mongoose.isValidObjectId(String(assignment.organizer)))) {
      throw httpError(400, `Schedule assignment for event ${assignment.eventId} is invalid.`);
    }
    if (assignment.staff.some((id) => !mongoose.isValidObjectId(String(id)))) {
      throw httpError(400, `Schedule assignment for event ${assignment.eventId} contains an invalid staff id.`);
    }
  }
};

export const validateScheduleProposal = async ({ assignments, eventVersions, scheduleRevision, session, schedule }) => {
  validatePlanShape(assignments);
  if (!eventVersions || typeof eventVersions !== 'object' || Array.isArray(eventVersions)) {
    throw httpError(400, 'The schedule proposal is missing its event version snapshot.');
  }
  const context = await loadSchedulingContext(session);
  const { events, venues, resources, staff, settings } = context;
  let scheduleQuery = Schedule.findOne().sort({ updatedAt: -1 });
  if (session) scheduleQuery = scheduleQuery.session(session);
  const currentSchedule = schedule || await scheduleQuery;
  if (Number(scheduleRevision) !== (Number(currentSchedule?.revision) || 0)) {
    throw httpError(409, 'The schedule changed after this proposal was generated. Generate a fresh proposal.');
  }
  const incomingIds = assignments.map((item) => String(item.eventId));
  const currentIds = events.map((event) => String(event._id));
  if (incomingIds.length !== currentIds.length || currentIds.some((id) => !incomingIds.includes(id))) {
    throw httpError(409, 'The event list changed after this proposal was generated. Generate a fresh proposal.');
  }
  for (const event of events) {
    const expected = eventVersions[String(event._id)];
    const actual = event.updatedAt?.toISOString();
    if (!expected || expected !== actual) {
      throw httpError(409, `Event "${event.title}" changed after this proposal was generated. Generate a fresh proposal.`);
    }
  }

  const venueById = new Map(venues.map((venue) => [String(venue._id), venue]));
  const resourceById = new Map(resources.map((resource) => [String(resource._id), resource]));
  const staffById = new Map(staff.map((member) => [String(member._id), member]));
  const eventById = new Map(events.map((event) => [String(event._id), event]));
  const updatedEvents = assignments.map((assignment) => {
    const event = eventById.get(String(assignment.eventId));
    const venue = venueById.get(String(assignment.venue));
    if (!event || !venue) throw httpError(409, 'An assigned event or venue no longer exists. Generate a fresh proposal.');
    const assignedStaff = assignment.staff.map((id) => staffById.get(String(id)));
    const assignedOrganizer = assignment.organizer
      ? staffById.get(String(assignment.organizer))
      : event.organizer;
    if (assignedStaff.some((member) => !member) || (assignment.organizer && !assignedOrganizer)) {
      throw httpError(409, 'An assigned staff member no longer exists. Generate a fresh proposal.');
    }

    const updated = event.toObject();
    updated.date = new Date(`${assignment.date}T00:00:00.000Z`);
    updated.startTime = assignment.startTime;
    updated.endTime = assignment.endTime;
    updated.venue = venue;
    updated.staff = assignedStaff;
    updated.organizer = assignedOrganizer;
    updated.resources = (updated.resources || []).map((requirement) => ({
      ...requirement,
      resource: resourceById.get(String(requirement.resource?._id || requirement.resource)) || requirement.resource,
    }));
    updated.status = event.status === 'published' ? 'published' : 'scheduled';
    return { event, updated, assignment };
  });
  const proposedConflicts = detectAllConflicts(
    events.map((event) => updatedEvents.find((item) => String(item.event._id) === String(event._id))?.updated || event),
    { settings }
  );
  if (proposedConflicts.length) {
    throw httpError(409, 'The proposed schedule failed live validation. No changes were saved.', { conflicts: proposedConflicts });
  }
  return { ...context, updatedEvents, currentSchedule };
};

export const getEventVersionSnapshot = (events) => Object.fromEntries(
  events.map((event) => [String(event._id), event.updatedAt?.toISOString() || null])
);

export const applyScheduleProposal = async ({ assignments, eventVersions, scheduleRevision, summary, userId }) => {
  return runScheduleTransaction(async ({ session, schedule }) => {
    if (schedule.isLocked) throw httpError(409, 'Schedule is locked and cannot be changed.');
    const { events, settings, updatedEvents } = await validateScheduleProposal({
      assignments,
      eventVersions,
      scheduleRevision,
      session,
      schedule,
    });

    for (const { event, updated } of updatedEvents) {
      event.date = updated.date;
      event.startTime = updated.startTime;
      event.endTime = updated.endTime;
      event.venue = updated.venue._id;
      event.staff = updated.staff.map((member) => member._id);
      event.organizer = updated.organizer?._id || updated.organizer || null;
      event.status = updated.status;
      await event.save({ session });
    }

    const reloaded = await Event.find(activeEventFilter).populate(eventPopulation).session(session);
    const remaining = await reconcileOpenConflicts({ events: reloaded, settings, userId, session });
    if (remaining.length) {
      throw httpError(409, 'Schedule revalidation found conflicts after applying the proposal. The transaction was rolled back.', { conflicts: remaining });
    }

    schedule.entries = updatedEvents.map(({ event, assignment }) => ({
      event: event._id,
      date: new Date(`${assignment.date}T00:00:00.000Z`),
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      venue: assignment.venue,
    }));
    schedule.generatedBy = 'ai';
    schedule.aiSummary = typeof summary === 'string' ? summary.slice(0, 1000) : 'Approved conflict-validated schedule.';
    schedule.isPublished = false;
    await schedule.save({ session });

    return { schedule, updatedEvents: updatedEvents.length, conflicts: remaining.length };
  });
};
