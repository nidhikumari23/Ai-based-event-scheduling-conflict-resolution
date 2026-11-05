import { Conflict } from '../models/Conflict.js';
import { Event } from '../models/Event.js';
import { Schedule } from '../models/Schedule.js';
import { Settings } from '../models/Settings.js';
import { Venue } from '../models/Venue.js';
import { Resource } from '../models/Resource.js';
import { Staff } from '../models/Staff.js';
import { detectAllConflicts, parseTime } from '../utils/conflictDetector.js';
import { findFeasibleAlternatives } from '../services/schedulingEngine.js';
import {
  getEventVersionSnapshot,
  loadSchedulingContext,
} from '../services/schedulePersistence.js';
import { explainFeasibleSchedules } from '../utils/aiService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { conflictFingerprint } from '../utils/conflictIdentity.js';

const idOf = (value) => {
  const id = value?._id ?? value?.id ?? value;
  return id == null ? '' : String(id);
};

export const getConflicts = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  const conflicts = await Conflict.find(filter)
    .populate('events', 'title date startTime endTime')
    .populate('venue resource staff')
    .populate('proposedEvent.venue proposedEvent.organizer proposedEvent.staff proposedEvent.resources.resource')
    .sort({ createdAt: -1 });
  res.json(conflicts);
});

export const detectConflicts = asyncHandler(async (req, res) => {
  const [events, settings] = await Promise.all([
    Event.find({ status: { $in: ['scheduled', 'published'] } })
      .populate(['venue', 'resources.resource', 'staff', 'organizer']),
    Settings.findOne(),
  ]);
  const detected = detectAllConflicts(events, { settings });
  const fingerprints = detected.map(conflictFingerprint);
  const existingOpen = await Conflict.find({ status: 'open' });
  const legacyByFingerprint = new Map(
    existingOpen.filter((item) => !item.fingerprint).map((item) => [conflictFingerprint(item), item])
  );
  const saved = [];
  for (let index = 0; index < detected.length; index++) {
    const fingerprint = fingerprints[index];
    const existing = existingOpen.find((item) => item.fingerprint === fingerprint) || legacyByFingerprint.get(fingerprint);
    const query = existing ? { _id: existing._id } : { fingerprint };
    const update = {
      $set: {
        ...detected[index],
        fingerprint,
        status: 'open',
        resolution: '',
        resolvedBy: null,
        resolvedAt: null,
      },
    };
    let item;
    try {
      item = await Conflict.findOneAndUpdate(query, update, {
        upsert: !existing,
        new: true,
        runValidators: true,
      });
    } catch (error) {
      if (error.code !== 11000 || existing) throw error;
      item = await Conflict.findOneAndUpdate(
        { fingerprint },
        update,
        { new: true, runValidators: true }
      );
    }
    saved.push(item);
  }

  const detectedFingerprints = new Set(fingerprints);
  await Promise.all(existingOpen
    .filter((item) => !item.proposedEvent &&
      !detectedFingerprints.has(item.fingerprint || conflictFingerprint(item)))
    .map((item) => Conflict.updateOne(
      { _id: item._id, status: 'open' },
      { $set: { status: 'resolved', resolution: 'No longer detected during the latest conflict scan.', resolvedBy: null, resolvedAt: new Date() } }
    )));

  res.json({ count: saved.length, conflicts: saved });
});

export const resolveConflict = asyncHandler(async (req, res) => {
  const conflict = await Conflict.findById(req.params.id)
    .populate('proposedEvent.venue proposedEvent.organizer proposedEvent.staff proposedEvent.resources.resource');
  if (!conflict) return res.status(404).json({ message: 'Conflict not found' });
  if (req.body.action === 'accept') {
    return res.status(400).json({ message: 'A suggested schedule must be approved and revalidated before the conflict can be resolved.' });
  }
  if (req.body.action !== 'ignore' && req.body.action !== 'resolve') {
    return res.status(400).json({ message: 'Action must be resolve or ignore' });
  }
  if (req.body.action === 'resolve') {
    let remains;
    if (conflict.proposedEvent) {
      const { events, settings } = await loadSchedulingContext();
      const proposal = conflict.proposedEvent.toObject();
      proposal._id = proposal.eventId;
      const candidateId = idOf(proposal);
      const currentEvents = events.filter((event) => idOf(event) !== candidateId);
      remains = detectAllConflicts([...currentEvents, proposal], { settings })
        .some((item) => item.events.includes(candidateId));
    } else {
      const [events, settings] = await Promise.all([
        Event.find({ status: { $in: ['scheduled', 'published'] } })
          .populate(['venue', 'resources.resource', 'staff', 'organizer']),
        Settings.findOne(),
      ]);
      remains = detectAllConflicts(events, { settings }).some((item) =>
        conflictFingerprint(item) === conflict.fingerprint ||
        (item.type === conflict.type &&
          [...item.events].map(String).sort().join(',') === conflict.events.map(String).sort().join(',') &&
          String(item.venue || '') === String(conflict.venue || '') &&
          String(item.resource || '') === String(conflict.resource || '') &&
          String(item.staff || '') === String(conflict.staff || ''))
      );
    }
    if (remains) {
      return res.status(409).json({ message: 'The conflict is still present. Apply a feasible schedule change and run validation before resolving it.' });
    }
  }
  conflict.status = req.body.action === 'ignore' ? 'ignored' : 'resolved';
  conflict.resolution = req.body.resolution || conflict.aiSuggestion;
  conflict.resolvedBy = req.user._id;
  conflict.resolvedAt = new Date();
  await conflict.save();
  res.json(conflict);
});

export const getAISuggestion = asyncHandler(async (req, res) => {
  const conflict = await Conflict.findById(req.params.id).populate({
    path: 'events',
    populate: ['venue', 'resources.resource', 'staff', 'organizer'],
  }).populate('proposedEvent.venue proposedEvent.organizer proposedEvent.staff proposedEvent.resources.resource');
  if (!conflict) return res.status(404).json({ message: 'Conflict not found' });

  const [events, venues, resources, staff, settings, schedule] = await Promise.all([
    Event.find({ status: { $nin: ['cancelled', 'completed'] } })
      .populate(['venue', 'resources.resource', 'staff', 'organizer']),
    Venue.find(),
    Resource.find(),
    Staff.find(),
    Settings.findOne(),
    Schedule.findOne().sort({ updatedAt: -1 }),
  ]);
  const proposedEvent = conflict.proposedEvent?.toObject();
  if (proposedEvent) proposedEvent._id = proposedEvent.eventId;
  const candidates = proposedEvent
    ? [proposedEvent]
    : conflict.events
      .filter(Boolean)
      .sort((a, b) => (Number(a.priority) || 5) - (Number(b.priority) || 5));
  const suggestions = [];

  for (const event of candidates) {
    const alternatives = findFeasibleAlternatives({
      event,
      otherEvents: events,
      venues,
      resources,
      staff,
      settings,
      limit: 3,
      options: {
        startDate: settings?.festivalStartDate,
        endDate: settings?.festivalEndDate,
      },
    });
    for (const alternative of alternatives) {
      const proposed = alternative;
      const proposedVenue = venues.find((venue) => String(venue._id) === String(proposed.venue));
      const assignedStaff = [proposed.organizer, ...(proposed.staff || [])]
        .filter(Boolean)
        .map((id) => staff.find((member) => String(member._id) === String(id)))
        .filter(Boolean);
      const assignedResources = (proposed.resources || []).map((requirement) => {
        const resource = resources.find((item) => String(item._id) === String(requirement.resource));
        return {
          ...requirement,
          type: resource?.type || requirement.type,
          availableQuantity: Number(resource?.available ?? resource?.quantity ?? 0),
          available: Boolean(resource && resource.isAvailable !== false &&
            Number(resource.available ?? resource.quantity ?? 0) >= Number(requirement.quantity)),
        };
      });
      const startMinute = parseTime(proposed.startTime);
      const endMinute = parseTime(proposed.endTime);
      const startAt = Date.parse(`${proposed.date}T00:00:00.000Z`) + startMinute * 60_000;
      const endAt = Date.parse(`${proposed.date}T00:00:00.000Z`) +
        (endMinute <= startMinute ? endMinute + 24 * 60 : endMinute) * 60_000;
      const setupMinutes = Math.max(0, Number(event.setupMinutes) || 0);
      const cleanupMinutes = Math.max(0, Number(event.cleanupMinutes) || 0);
      const facilityRequirements = event.requiredFacilities || [];
      const reasonByType = {
        venue: `Moves the event to ${proposed.venueName}, which is available, has sufficient capacity, and supports all required facilities.`,
        capacity: `Uses ${proposed.venueName}, whose capacity meets the event's expected audience.`,
        staff: 'Assigns available staff with the required roles and no overlapping assignments.',
        resource: 'Uses available resource inventory of the required types and quantities.',
        timing: 'Moves the event to a time slot with no conflicting venue, staff, or resource bookings.',
        buffer: `Keeps the full ${setupMinutes}-minute setup and ${cleanupMinutes}-minute cleanup window clear.`,
      };
      const explanation = reasonByType[conflict.type] ||
        'This option passes the current venue, time, buffer, staff, resource, and capacity checks.';
      suggestions.push({
        eventId: conflict.proposedEvent?.isNewEvent ? null : event._id,
        isNewEvent: Boolean(conflict.proposedEvent?.isNewEvent),
        title: event.title,
        eventPayload: {
          title: event.title,
          description: event.description || '',
          category: idOf(event.category),
          status: event.status || 'scheduled',
          expectedAudience: event.expectedAudience,
          setupMinutes: event.setupMinutes,
          cleanupMinutes: event.cleanupMinutes,
          requiredFacilities: event.requiredFacilities || [],
          date: proposed.date,
          startTime: proposed.startTime,
          endTime: proposed.endTime,
          venue: proposed.venue,
          organizer: proposed.organizer,
          staff: proposed.staff,
          resources: (proposed.resources || []).map(({ resource, quantity }) => ({ resource, quantity })),
        },
        original: {
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
          venue: event.venue?._id || event.venue || null,
          venueName: event.venue?.name || 'Unassigned',
        },
        proposed: {
          ...proposed,
          resources: assignedResources,
        },
        conflictType: conflict.type,
        reason: explanation,
        explanation,
        availability: {
          time: {
            available: true,
            date: proposed.date,
            startTime: proposed.startTime,
            endTime: proposed.endTime,
            setupMinutes,
            cleanupMinutes,
            reservedFrom: new Date(startAt - setupMinutes * 60_000).toISOString(),
            reservedUntil: new Date(endAt + cleanupMinutes * 60_000).toISOString(),
          },
          venue: {
            available: Boolean(proposedVenue && proposedVenue.isAvailable !== false && !proposedVenue.isBlocked),
            name: proposedVenue?.name || proposed.venueName,
            capacity: Number(proposedVenue?.capacity || 0),
            requiredCapacity: Number(event.expectedAudience || 0),
            capacitySufficient: Boolean(proposedVenue && Number(proposedVenue.capacity) >= Number(event.expectedAudience || 0)),
            requiredFacilities: facilityRequirements,
            facilitiesAvailable: facilityRequirements.every((facility) => proposedVenue?.facilities?.includes(facility)),
          },
          staff: assignedStaff.map((member) => ({
            id: String(member._id),
            name: member.name,
            role: member.role,
            available: member.isAvailable !== false,
          })),
          resources: assignedResources.map((requirement) => ({
            id: String(requirement.resource),
            name: requirement.resourceName,
            type: requirement.type,
            quantity: requirement.quantity,
            availableQuantity: requirement.availableQuantity,
            available: requirement.available,
          })),
        },
        impact: 'Only this event is moved; the candidate passed venue, capacity, facility, timing, buffer, staff, and resource checks against the current event data.',
        feasible: true,
        scheduleRevision: schedule?.revision ?? 0,
      });
    }
    if (suggestions.length >= 5) break;
  }

  suggestions.sort((a, b) => b.proposed.score - a.proposed.score);
  const explanation = await explainFeasibleSchedules({
    assignments: suggestions.map((item) => item.proposed),
    criteria: { score: 'Deterministic feasibility checks first; score ranks feasible alternatives by capacity, preference, schedule stability, and staff continuity.' },
    context: `validated alternatives for ${conflict.type} conflict`,
  });
  const suggestion = suggestions.length
    ? `Best validated alternative: move "${suggestions[0].title}" to ${suggestions[0].proposed.date} ${suggestions[0].proposed.startTime}–${suggestions[0].proposed.endTime} at ${suggestions[0].proposed.venueName}.`
    : 'No feasible alternative was found with the current venue, staff, resource, and scheduling constraints.';
  conflict.aiSuggestion = suggestion;
  await conflict.save();
  res.json({
    conflict: {
      id: conflict._id,
      type: conflict.type,
      reason: conflict.description,
      events: conflict.events,
    },
    suggestion,
    steps: suggestions.length
      ? ['Review the original and proposed schedule.', 'Approve a feasible alternative to revalidate and save it.', 'The conflict is marked resolved only after the updated schedule passes validation.']
      : ['Review venue, staff, resource, capacity, and buffer constraints.', 'Change resource/staff availability or the scheduling window, then regenerate suggestions.'],
    suggestions,
    eventVersions: getEventVersionSnapshot(events),
    scheduleRevision: schedule?.revision ?? 0,
    explanation: explanation.explanation,
    aiEnabled: explanation.aiEnabled,
  });
});

export const getConflictsByType = asyncHandler(async (req, res) => {
  const types = ['timing', 'venue', 'resource', 'staff', 'capacity', 'buffer'];
  const result = {};
  for (const type of types) {
    result[type] = await Conflict.countDocuments({ type, status: 'open' });
  }
  const [pendingConflicts, resolvedConflicts, totalConflicts, totalEvents, scheduledEvents] = await Promise.all([
    Conflict.countDocuments({ status: 'open' }),
    Conflict.countDocuments({ status: 'resolved' }),
    Conflict.countDocuments(),
    Event.countDocuments({ status: { $nin: ['cancelled', 'completed'] } }),
    Event.countDocuments({ status: { $in: ['scheduled', 'published'] } }),
  ]);
  result.pending = pendingConflicts;
  result.resolved = resolvedConflicts;
  result.total = totalConflicts;
  result.scheduledEvents = scheduledEvents;
  result.schedulingSuccessRate = totalEvents
    ? Math.round((scheduledEvents / totalEvents) * 100)
    : 0;
  res.json(result);
});
