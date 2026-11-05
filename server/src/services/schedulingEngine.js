const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SEARCH_DAYS = 7;
const DEFAULT_SLOT_MINUTES = 30;
const DAY_START_MINUTES = 8 * 60;
const DAY_END_MINUTES = 22 * 60;
const scheduleInputError = (message) => Object.assign(new Error(message), {
  status: 400,
  code: 'INVALID_SCHEDULING_WINDOW',
});

const idOf = (value) => {
  const id = value?._id ?? value?.id ?? value;
  return id == null ? '' : String(id);
};

const dateDay = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && date.toISOString().slice(0, 10) !== value) {
    return null;
  }
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

export const parseTime = (value) => {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const dateString = (day) => new Date(day).toISOString().slice(0, 10);
const clockString = (minute) => {
  const normalized = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};

export const getEventInterval = (event, includeBuffers = true) => {
  const day = dateDay(event.date);
  const start = parseTime(event.startTime);
  const end = parseTime(event.endTime);
  if (day == null || start == null || end == null || start === end) return null;

  const startAt = day + start * 60_000;
  const endAt = day + (end <= start ? DAY_MS : 0) + end * 60_000;
  const setup = includeBuffers ? Math.max(0, Number(event.setupMinutes) || 0) : 0;
  const cleanup = includeBuffers ? Math.max(0, Number(event.cleanupMinutes) || 0) : 0;
  return { startAt: startAt - setup * 60_000, eventStartAt: startAt, eventEndAt: endAt, endAt: endAt + cleanup * 60_000 };
};

const overlaps = (a, b) => a.startAt < b.endAt && b.startAt < a.endAt;
const eventOverlaps = (a, b, includeBuffers = true) => {
  const aInterval = getEventInterval(a, includeBuffers);
  const bInterval = getEventInterval(b, includeBuffers);
  return Boolean(aInterval && bInterval && overlaps(aInterval, bInterval));
};

const conflict = (type, severity, events, description, references = {}) => ({
  type,
  code: {
    venue: 'VENUE_CONFLICT',
    timing: 'TIME_CONFLICT',
    buffer: 'BUFFER_CONFLICT',
    staff: 'STAFF_CONFLICT',
    resource: 'RESOURCE_CONFLICT',
    capacity: 'CAPACITY_EXCEEDED',
  }[type] || 'SCHEDULE_CONFLICT',
  severity,
  events: events.map((event) => idOf(event)).filter(Boolean),
  eventDetails: events.map((event) => ({
    id: idOf(event),
    title: event.title || 'Untitled event',
    date: event.date instanceof Date ? event.date.toISOString().slice(0, 10) : String(event.date || '').slice(0, 10),
    startTime: event.startTime || null,
    endTime: event.endTime || null,
    venue: event.venue?.name || null,
  })),
  description,
  ...references,
});

export const detectAllConflicts = (events, { settings = {} } = {}) => {
  settings = settings || {};
  const conflicts = [];
  const activeEvents = events.filter((event) => event && event.status !== 'cancelled' && event.status !== 'completed');
  const resourceBookings = new Map();
  const minGap = Math.max(0, Number(settings.schedulingRules?.minGapMinutes) || 0) * 60_000;

  for (const event of activeEvents) {
    const interval = getEventInterval(event, false);
    if (!interval) {
      conflicts.push(conflict('timing', 'high', [event], `"${event.title || 'Event'}" has an invalid date or time range.`));
      continue;
    }

    const venue = event.venue;
    if (!venue) {
      conflicts.push(conflict('venue', 'high', [event], `"${event.title}" has no venue assigned.`));
    } else {
      const venueId = idOf(venue);
      if (venue.isAvailable === false || venue.isBlocked) {
        conflicts.push(conflict('venue', 'high', [event], `Venue "${venue.name || venueId}" is unavailable.`, { venue: venueId }));
      }
      const missingFacilities = (event.requiredFacilities || [])
        .filter((facility) => !venue.facilities?.includes(facility));
      if (missingFacilities.length) {
        conflicts.push(conflict('venue', 'high', [event], `Venue "${venue.name || venueId}" does not provide required facilities: ${missingFacilities.join(', ')}.`, { venue: venueId }));
      }
      if (Number.isFinite(venue.capacity) && Number(event.expectedAudience) > venue.capacity) {
        conflicts.push(conflict('capacity', 'medium', [event], `"${event.title}" expected audience (${event.expectedAudience}) exceeds venue capacity (${venue.capacity}).`, { venue: venueId }));
      }
      if (venueId) {
        const prior = activeEvents.slice(0, activeEvents.indexOf(event));
        for (const other of prior) {
          if (idOf(other.venue) !== venueId) continue;
          const currentInterval = getEventInterval(event, true);
          const otherInterval = getEventInterval(other, true);
          const venueGapConflict = currentInterval && otherInterval && (
            currentInterval.startAt < otherInterval.endAt + minGap &&
            otherInterval.startAt < currentInterval.endAt + minGap
          );
          if (!eventOverlaps(event, other, false) && venueGapConflict) {
            conflicts.push(conflict('buffer', 'medium', [other, event], `Setup or cleanup time is insufficient between "${other.title}" and "${event.title}" at "${venue.name}".`, { venue: venueId }));
          } else if (eventOverlaps(event, other, false)) {
            conflicts.push(conflict('venue', 'critical', [other, event], `Venue "${venue.name}" is double-booked by "${other.title}" and "${event.title}".`, { venue: venueId }));
            conflicts.push(conflict('timing', 'high', [other, event], `Events "${other.title}" and "${event.title}" overlap in time at "${venue.name}".`, { venue: venueId }));
          }
        }
      }
    }

    for (const member of [event.organizer, ...(event.staff || [])].filter(Boolean)) {
      if (member.isAvailable === false) {
        conflicts.push(conflict('staff', 'high', [event], `Staff member "${member.name || idOf(member)}" is unavailable for "${event.title}".`, { staff: idOf(member) }));
      }
      for (const other of activeEvents.slice(0, activeEvents.indexOf(event))) {
        const otherStaff = [other.organizer, ...(other.staff || [])].filter(Boolean);
        if (otherStaff.some((assigned) => idOf(assigned) === idOf(member)) && eventOverlaps(event, other, false)) {
          conflicts.push(conflict('staff', 'medium', [other, event], `Staff member "${member.name || idOf(member)}" is assigned to overlapping events.`, { staff: idOf(member) }));
        }
      }
    }

    for (const requirement of event.resources || []) {
      const resource = requirement.resource;
      const resourceId = idOf(resource);
      if (!resourceId) {
        conflicts.push(conflict('resource', 'high', [event], `"${event.title}" references a resource that is unavailable or no longer exists.`));
        continue;
      }
      const quantity = Number(requirement.quantity) || 1;
      if (resource.isAvailable === false || quantity > Number(resource.available ?? resource.quantity ?? 0)) {
        conflicts.push(conflict('resource', 'high', [event], `Resource "${resource.name || resourceId}" is unavailable or has insufficient quantity for "${event.title}".`, { resource: resourceId }));
      }
      if (!resourceBookings.has(resourceId)) resourceBookings.set(resourceId, []);
      resourceBookings.get(resourceId).push({ event, resource, quantity, interval });
    }

    if ((event.staff || []).some((member) => !member)) {
      conflicts.push(conflict('staff', 'high', [event], `"${event.title}" has an assigned staff member that is unavailable or no longer exists.`));
    }
  }

  for (const bookings of resourceBookings.values()) {
    const grouped = [...bookings.reduce((byEvent, booking) => {
      const eventId = idOf(booking.event);
      const existing = byEvent.get(eventId);
      if (existing) existing.quantity += booking.quantity;
      else byEvent.set(eventId, { ...booking });
      return byEvent;
    }, new Map()).values()];
    const capacity = Number(grouped[0].resource.available ?? grouped[0].resource.quantity ?? 0);
    for (const booking of grouped) {
      const simultaneous = grouped.filter((other) => overlaps(booking.interval, other.interval));
      const total = simultaneous.reduce((sum, other) => sum + other.quantity, 0);
      if (total > capacity) {
        conflicts.push(conflict(
          'resource',
          'high',
          simultaneous.map((item) => item.event),
          `Resource "${booking.resource.name || idOf(booking.resource)}" demand (${total}) exceeds available quantity (${capacity}).`,
          { resource: idOf(booking.resource) }
        ));
        break;
      }
    }
  }

  const unique = new Map();
  for (const item of conflicts) {
    const key = `${item.type}:${[...item.events].sort().join(',')}:${idOf(item.venue)}:${idOf(item.resource)}:${idOf(item.staff)}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()];
};

const staffOptionsFor = (event, staff, candidateInterval, scheduled) => {
  const required = [event.organizer, ...(event.staff || [])].filter(Boolean);
  const requiredIds = [...new Set(required.map(idOf).filter(Boolean))];
  if (!requiredIds.length) return [[]];

  let alternatives = [[]];
  for (const memberId of requiredIds) {
    const preferred = staff.find((member) => idOf(member) === memberId) || required.find((member) => idOf(member) === memberId);
    const role = preferred?.role;
    const eligible = staff.filter((member) =>
      member.isAvailable !== false &&
      (!role || member.role === role) &&
      !scheduled.some((assignment) => assignment.staffIds.includes(idOf(member)) && overlaps(candidateInterval, assignment.eventInterval))
    );
    const choices = eligible.some((member) => idOf(member) === memberId)
      ? eligible.filter((member) => idOf(member) === memberId)
      : eligible;
    if (!choices.length) return [];
    alternatives = alternatives.flatMap((assigned) =>
      choices.filter((member) => !assigned.some((other) => idOf(other) === idOf(member)))
        .map((member) => [...assigned, member])
    ).slice(0, 12);
  }
  return alternatives.map((members) => members.map(idOf));
};

const resourceFits = (event, interval, resources, scheduled) => {
  const demands = makeResourceDemand(event);
  for (const [resourceId, quantity] of demands) {
    const requirement = (event.resources || []).find((item) => idOf(item.resource) === resourceId);
    const resource = resources.find((item) => idOf(item) === resourceId) || requirement?.resource;
    if (!resourceId || !resource || resource.isAvailable === false) return false;
    const capacity = Number(resource.available ?? resource.quantity ?? 0);
    if (!Number.isFinite(capacity) || quantity > capacity) return false;
    const simultaneous = scheduled
      .filter((assignment) => overlaps(interval, assignment.eventInterval))
      .reduce((sum, assignment) => sum + (assignment.resourceDemand.get(resourceId) || 0), quantity);
    if (simultaneous > capacity) return false;
  }
  return true;
};

const resourceOptionsFor = (event, interval, resources, scheduled) => {
  const requirements = event.resources || [];
  if (!requirements.length) return [[]];

  let options = [[]];
  for (const requirement of requirements) {
    const original = requirement.resource;
    const quantity = Number(requirement.quantity) || 1;
    if (!original?.type) return [];
    const eligible = resources.filter((resource) =>
      resource.type === original.type &&
      resource.isAvailable !== false &&
      Number.isFinite(Number(resource.available ?? resource.quantity)) &&
      Number(resource.available ?? resource.quantity) >= quantity
    );
    if (!eligible.length) return [];
    options = options.flatMap((assigned) =>
      eligible.map((resource) => [...assigned, { resource, quantity }])
    ).slice(0, 12);
  }

  return options.filter((selected) => resourceFits({
    ...event,
    resources: selected,
  }, interval, resources, scheduled));
};

const dateWindow = (events, settings, options) => {
  if (options.startDate && dateDay(options.startDate) == null) throw scheduleInputError('Scheduling startDate must be a valid YYYY-MM-DD date');
  if (options.endDate && dateDay(options.endDate) == null) throw scheduleInputError('Scheduling endDate must be a valid YYYY-MM-DD date');
  const start = dateDay(options.startDate || settings?.festivalStartDate);
  const end = dateDay(options.endDate || settings?.festivalEndDate);
  if (start != null && end != null) return { start, end };

  const eventDays = events.map((event) => dateDay(event.date)).filter((day) => day != null);
  const today = dateDay(options.today || new Date());
  const earliest = eventDays.length ? Math.min(...eventDays) : today;
  const windowStart = start ?? Math.max(today, earliest);
  return { start: windowStart, end: end ?? windowStart + (DEFAULT_SEARCH_DAYS - 1) * DAY_MS };
};

const candidateStartTimes = (event) => {
  const times = new Set([event.startTime]);
  for (const preference of event.preferredTimeSlots || []) {
    const time = typeof preference === 'string' ? preference : preference.startTime || preference.start;
    if (parseTime(time) != null) times.add(time);
  }
  for (let minute = DAY_START_MINUTES; minute <= DAY_END_MINUTES; minute += DEFAULT_SLOT_MINUTES) {
    times.add(clockString(minute));
  }
  return [...times].map((time) => ({ time, minute: parseTime(time) })).filter(({ minute }) => minute != null);
};

const slotPreference = (event, start, end) => {
  const preferences = event.preferredTimeSlots || [];
  if (!preferences.length) return 1;
  return preferences.some((preference) => {
    const preferredStart = typeof preference === 'string' ? parseTime(preference) : parseTime(preference.startTime || preference.start);
    const rawEnd = typeof preference === 'object' ? parseTime(preference.endTime || preference.end) : preferredStart;
    if (preferredStart == null || rawEnd == null) return false;
    const preferredEnd = rawEnd <= preferredStart ? rawEnd + 1440 : rawEnd;
    const overnightPreference = rawEnd < preferredStart;
    const normalizedStart = overnightPreference && start < preferredStart ? start + 1440 : start;
    const normalizedEnd = (end <= start || (overnightPreference && start < preferredStart)) ? end + 1440 : end;
    return normalizedStart >= preferredStart && normalizedEnd <= preferredEnd;
  }) ? 1 : 0;
};

const scoreCandidate = (event, venue, start, end, staffIds, existingVenue) => {
  const audience = Math.max(0, Number(event.expectedAudience) || 0);
  const capacityFit = venue.capacity > 0 ? Math.max(0, 1 - (venue.capacity - audience) / venue.capacity) : 0;
  const preferred = slotPreference(event, start.minute, end);
  const unchanged = dateString(dateDay(event.date)) === start.date &&
    event.startTime === start.time &&
    idOf(event.venue) === idOf(venue);
  const timeUnchanged = dateString(dateDay(event.date)) === start.date && event.startTime === start.time;
  const venueContinuity = existingVenue && idOf(existingVenue) === idOf(venue) ? 1 : 0;
  const staffContinuity = [event.organizer, ...(event.staff || [])]
    .map(idOf)
    .filter(Boolean)
    .filter((id) => staffIds.includes(id)).length;
  const staffTotal = [event.organizer, ...(event.staff || [])].map(idOf).filter(Boolean).length;
  const criteria = {
    capacityFit: Math.round(capacityFit * 20),
    preferredTime: preferred ? 25 : 0,
    minimalChanges: unchanged ? 30 : timeUnchanged ? 25 : venueContinuity ? 15 : 0,
    staffAvailability: staffTotal ? Math.round((staffContinuity / staffTotal) * 15) : 15,
    resourceAvailability: 10,
  };
  return { score: Object.values(criteria).reduce((sum, value) => sum + value, 0), criteria };
};

const assignmentFor = (event, venue, day, startTime, duration, staffIds, score, resources = event.resources || []) => {
  const startMinute = parseTime(startTime);
  const endTotal = startMinute + duration;
  const endTime = clockString(endTotal);
  const hasOrganizer = Boolean(event.organizer);
  const originalDay = dateDay(event.date);
  return {
    eventId: idOf(event),
    title: event.title,
    date: dateString(day),
    startTime,
    endTime,
    venue: idOf(venue),
    venueName: venue.name,
    original: {
      date: originalDay == null ? null : dateString(originalDay),
      startTime: event.startTime,
      endTime: event.endTime,
      venue: idOf(event.venue) || null,
      venueName: event.venue?.name || 'Unassigned',
    },
    organizer: hasOrganizer ? staffIds[0] : null,
    staff: hasOrganizer ? staffIds.slice(1) : staffIds,
    resources: resources.map((requirement) => ({
      resource: idOf(requirement.resource),
      resourceName: requirement.resource?.name || 'Unknown resource',
      type: requirement.resource?.type || '',
      quantity: Number(requirement.quantity) || 1,
    })),
    score: score.score,
    scoreCriteria: score.criteria,
    reason: `Feasible venue fit; ${score.criteria.preferredTime ? 'matches a preferred time; ' : ''}${score.criteria.minimalChanges ? 'preserves existing schedule choices where possible; ' : ''}uses available staff and resources.`,
  };
};

const makeResourceDemand = (event) => {
  const demand = new Map();
  for (const requirement of event.resources || []) {
    const resourceId = idOf(requirement.resource);
    if (resourceId) demand.set(resourceId, (demand.get(resourceId) || 0) + (Number(requirement.quantity) || 1));
  }
  return demand;
};

const capacityOfVenuePerDay = (assignments, venueId, day) => assignments.filter((assignment) =>
  assignment.venueId === venueId && dateDay(assignment.assignment.date) === day
).length;

export const findFeasibleAlternatives = ({
  event,
  otherEvents,
  venues,
  resources,
  staff = [],
  settings = {},
  limit = 5,
  options = {},
}) => {
  settings = settings || {};
  const interval = getEventInterval(event, false);
  if (!interval) return [];
  const duration = Math.round((interval.eventEndAt - interval.eventStartAt) / 60_000);
  const scheduled = otherEvents.filter((other) => other._id && idOf(other) !== idOf(event) && other.status !== 'cancelled' && other.status !== 'completed')
    .map((other) => ({
      event: other,
      interval: getEventInterval(other),
      eventInterval: getEventInterval(other, false),
      venueId: idOf(other.venue),
      staffIds: [other.organizer, ...(other.staff || [])].map(idOf).filter(Boolean),
      resourceDemand: makeResourceDemand(other),
    })).filter((assignment) => assignment.interval);
  const minGap = Math.max(0, Number(settings.schedulingRules?.minGapMinutes) || 0);
  const candidates = [];
  const window = dateWindow([event], settings, {
    ...options,
    startDate: options.startDate || settings?.festivalStartDate || event.date,
    endDate: options.endDate || settings?.festivalEndDate,
  });
  const maxPerVenue = Math.max(1, Number(settings.schedulingRules?.maxEventsPerVenuePerDay) || Number.MAX_SAFE_INTEGER);

  for (let day = window.start; day <= window.end; day += DAY_MS) {
    for (const start of candidateStartTimes(event)) {
    for (const venue of venues) {
      const venueCapacity = Number(venue.capacity);
      if (venue.isAvailable === false || venue.isBlocked ||
        !Number.isFinite(venueCapacity) || venueCapacity < Number(event.expectedAudience || 0)) continue;
      if (event.requiredFacilities?.length && !event.requiredFacilities.every((facility) => venue.facilities?.includes(facility))) continue;
      if (capacityOfVenuePerDay(scheduled.map((assignment) => ({
        venueId: assignment.venueId,
        assignment: { date: dateString(dateDay(assignment.event.date)) },
      })), idOf(venue), day) >= maxPerVenue) continue;
      const startAt = day + start.minute * 60_000;
      const endAt = startAt + duration * 60_000;
      const bufferedInterval = {
        startAt: startAt - Math.max(0, Number(event.setupMinutes) || 0) * 60_000,
        endAt: endAt + Math.max(0, Number(event.cleanupMinutes) || 0) * 60_000,
      };
      const venueCheckInterval = {
        startAt: bufferedInterval.startAt - minGap * 60_000,
        endAt: bufferedInterval.endAt + minGap * 60_000,
      };
      if (scheduled.some((assignment) =>
        assignment.venueId === idOf(venue) && overlaps(venueCheckInterval, assignment.interval)
      )) continue;
      const eventInterval = { startAt, endAt };
      const staffOptions = staffOptionsFor(event, staff, eventInterval, scheduled);
      if (!staffOptions.length) continue;
      const resourceOptions = resourceOptionsFor(event, eventInterval, resources, scheduled);
      if (!resourceOptions.length) continue;
      const date = dateString(day);
      const actualEnd = start.minute + duration;
      for (const staffIds of staffOptions) {
        for (const resourceRequirements of resourceOptions) {
          const score = scoreCandidate(event, venue, { ...start, date }, actualEnd, staffIds, event.venue);
          candidates.push({
            assignment: assignmentFor(event, venue, day, start.time, duration, staffIds, score, resourceRequirements),
            score: score.score,
            interval: bufferedInterval,
            venueId: idOf(venue),
          });
        }
      }
    }
    }
  }

  const ranked = candidates.sort((a, b) =>
    b.score - a.score ||
    a.assignment.date.localeCompare(b.assignment.date) ||
    a.assignment.startTime.localeCompare(b.assignment.startTime) ||
    a.assignment.venueName.localeCompare(b.assignment.venueName)
  );
  const selected = [];
  const selectedCandidates = new Set();
  const addDistinct = (keyFor) => {
    const seen = new Set();
    for (const candidate of ranked) {
      if (selectedCandidates.has(candidate)) continue;
      const key = keyFor(candidate.assignment);
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(candidate);
      selectedCandidates.add(candidate);
      if (selected.length >= limit) return;
    }
  };

  addDistinct((assignment) => assignment.venue);
  if (selected.length < limit) {
    addDistinct((assignment) => [
      assignment.venue,
      assignment.date,
      assignment.startTime,
      assignment.staff.join(','),
      assignment.resources.map((item) => `${item.resource}:${item.quantity}`).join(','),
    ].join('|'));
  }
  for (const candidate of ranked) {
    if (selected.length >= limit) break;
    if (!selectedCandidates.has(candidate)) selected.push(candidate);
  }
  return selected.map(({ assignment }, index) => ({ ...assignment, rank: index + 1 }));
};

export const generateOptimalSchedule = ({ events, venues, resources, staff = [], settings = {}, options = {} }) => {
  settings = settings || {};
  const active = events.filter((event) => event.status !== 'cancelled' && event.status !== 'completed');
  const window = dateWindow(active, settings, options);
  if (window.end < window.start) throw scheduleInputError('Scheduling endDate must be on or after startDate');
  if ((window.end - window.start) / DAY_MS > 30) throw scheduleInputError('Scheduling window cannot exceed 31 days');

  const sorted = [...active].sort((a, b) =>
    (Number(b.priority) || 5) - (Number(a.priority) || 5) ||
    (Number(b.expectedAudience) || 0) - (Number(a.expectedAudience) || 0) ||
    (b.resources?.length || 0) - (a.resources?.length || 0)
  );
  const schedule = [];
  const unscheduled = [];
  const minGap = Math.max(0, Number(settings.schedulingRules?.minGapMinutes) || 0);
  const maxPerVenue = Math.max(1, Number(settings.schedulingRules?.maxEventsPerVenuePerDay) || Number.MAX_SAFE_INTEGER);

  for (const event of sorted) {
    const original = getEventInterval(event, false);
    if (!original) {
      unscheduled.push({ eventId: idOf(event), title: event.title, reason: 'Event has an invalid date or time range.' });
      continue;
    }
    const duration = Math.round((original.eventEndAt - original.eventStartAt) / 60_000);
    const alternatives = [];
    for (let day = window.start; day <= window.end; day += DAY_MS) {
      for (const start of candidateStartTimes(event)) {
        for (const venue of venues) {
          if (venue.isAvailable === false || venue.isBlocked) continue;
          if (!Number.isFinite(Number(venue.capacity)) || Number(venue.capacity) < Number(event.expectedAudience || 0)) continue;
          if (event.requiredFacilities?.length && !event.requiredFacilities.every((facility) => venue.facilities?.includes(facility))) continue;
          if (capacityOfVenuePerDay(schedule, idOf(venue), day) >= maxPerVenue) continue;

          const startAt = day + start.minute * 60_000;
          const endAt = startAt + duration * 60_000;
          const interval = {
            startAt: startAt - Math.max(0, Number(event.setupMinutes) || 0) * 60_000,
            endAt: endAt + Math.max(0, Number(event.cleanupMinutes) || 0) * 60_000,
          };
          const venueCheckInterval = {
            startAt: interval.startAt - minGap * 60_000,
            endAt: interval.endAt + minGap * 60_000,
          };
          if (schedule.some((assignment) => overlaps(venueCheckInterval, assignment.interval))) continue;
          if (!resourceFits(event, interval, resources, schedule)) continue;
          const staffOptions = staffOptionsFor(event, staff, interval, schedule);
          if (!staffOptions.length) continue;

          const date = dateString(day);
          for (const staffIds of staffOptions) {
            const score = scoreCandidate(event, venue, { ...start, date }, start.minute + duration, staffIds, event.venue);
            alternatives.push({
              assignment: assignmentFor(event, venue, day, start.time, duration, staffIds, score),
              score: score.score,
              interval,
              venueId: idOf(venue),
              staffIds,
              resourceDemand: makeResourceDemand(event),
            });
          }
        }
      }
    }

    alternatives.sort((a, b) => b.score - a.score ||
      a.assignment.date.localeCompare(b.assignment.date) ||
      a.assignment.startTime.localeCompare(b.assignment.startTime) ||
      a.assignment.venueName.localeCompare(b.assignment.venueName));
    const selected = alternatives[0];
    if (!selected) {
      const reasons = [];
      if (!venues.some((venue) => venue.isAvailable !== false && !venue.isBlocked && Number(venue.capacity) >= Number(event.expectedAudience || 0))) {
        reasons.push('No available venue has sufficient capacity.');
      }
      if ((event.resources || []).some((requirement) => Number(requirement.quantity) > Number(requirement.resource?.available ?? requirement.resource?.quantity ?? 0))) {
        reasons.push('One or more required resources have insufficient quantity.');
      }
      if ([event.organizer, ...(event.staff || [])].some((member) => member && member.isAvailable === false)) {
        reasons.push('One or more assigned staff members are unavailable.');
      }
      unscheduled.push({ eventId: idOf(event), title: event.title, reason: reasons.join(' ') || 'No feasible date, time, venue, staff, and resource combination exists in the search window.' });
      continue;
    }
    schedule.push(selected);
  }

  return {
    assignments: schedule.map(({ assignment }) => assignment),
    unscheduled,
    score: schedule.length
      ? Math.round(schedule.reduce((sum, assignment) => sum + assignment.score, 0) / schedule.length)
      : 0,
    scoreCriteria: {
      capacityFit: '20 points: prefer a venue that fits the audience without excessive unused capacity.',
      preferredTime: '25 points: honor an event preferred time slot when configured.',
      minimalChanges: '30 points: preserve existing date, time, and venue; 15 for preserving venue only.',
      staffAvailability: '15 points: retain assigned staff when available; alternatives must have the same staff role.',
      resourceAvailability: '10 points: reserved for feasible use of requested resource inventory.',
      feasibility: 'Hard constraints: event duration, date window, available venue/capacity/facilities, staff, resources, buffers, venue gap, and daily venue limit.',
    },
    searchWindow: { startDate: dateString(window.start), endDate: dateString(window.end) },
  };
};
