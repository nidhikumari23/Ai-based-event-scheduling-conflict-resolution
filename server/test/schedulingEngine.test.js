import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectAllConflicts,
  findFeasibleAlternatives,
  generateOptimalSchedule,
  getEventInterval,
} from '../src/services/schedulingEngine.js';

const venue = (id = 'venue-a', capacity = 500, properties = {}) => ({
  _id: id,
  name: id,
  capacity,
  facilities: [],
  isAvailable: true,
  ...properties,
});

const event = (id, properties = {}) => ({
  _id: id,
  title: id,
  date: '2027-06-01T00:00:00.000Z',
  startTime: '10:00',
  endTime: '11:00',
  status: 'scheduled',
  expectedAudience: 50,
  priority: 5,
  venue: venue(),
  staff: [],
  resources: [],
  ...properties,
});

test('detects equal-start and partial overlaps at the same venue, but allows adjacent intervals', () => {
  const first = event('first');
  const equalStart = event('equal-start');
  const partial = event('partial', { startTime: '10:30', endTime: '11:30', venue: first.venue });
  const adjacent = event('adjacent', { startTime: '11:00', endTime: '12:00', venue: venue('venue-c') });
  const parallelVenue = event('parallel-venue', {
    startTime: '10:30',
    endTime: '11:30',
    venue: venue('venue-b'),
  });

  const conflicts = detectAllConflicts([first, equalStart, partial, adjacent]);
  assert.ok(conflicts.some((item) => item.type === 'timing' && item.events.includes('first') && item.events.includes('equal-start')));
  assert.ok(conflicts.some((item) => item.type === 'timing' && item.events.includes('first') && item.events.includes('partial')));
  assert.ok(!conflicts.some((item) => item.type === 'timing' && item.events.includes('first') && item.events.includes('adjacent')));
  assert.ok(!detectAllConflicts([first, parallelVenue]).some((item) => item.type === 'timing'));
});

test('models overnight events on an absolute timeline', () => {
  const overnight = event('overnight', { startTime: '23:30', endTime: '00:30' });
  const nextDay = event('next-day', {
    date: '2027-06-02T00:00:00.000Z',
    startTime: '00:00',
    endTime: '01:00',
    venue: overnight.venue,
  });
  assert.equal(getEventInterval(overnight).eventEndAt - getEventInterval(overnight).eventStartAt, 60 * 60 * 1000);
  assert.ok(detectAllConflicts([overnight, nextDay]).some((item) => item.type === 'timing'));
});

test('detects venue double booking and cleanup-buffer conflicts', () => {
  const first = event('first', { cleanupMinutes: 20 });
  const overlap = event('overlap', { startTime: '10:30', venue: first.venue });
  const insufficientGap = event('buffered', { startTime: '11:10', endTime: '12:00', venue: first.venue });
  const overlapConflicts = detectAllConflicts([first, overlap]);
  assert.ok(overlapConflicts.some((item) => item.type === 'venue'));
  const bufferConflicts = detectAllConflicts([first, insufficientGap]);
  assert.ok(bufferConflicts.some((item) => item.type === 'buffer'));
});

test('detects staff overlaps and unavailable assigned staff', () => {
  const staff = { _id: 'staff-a', name: 'Technician', role: 'technician', isAvailable: true };
  const first = event('first', { staff: [staff] });
  const second = event('second', { staff: [staff], venue: venue('venue-b') });
  assert.ok(detectAllConflicts([first, second]).some((item) => item.type === 'staff'));
  assert.ok(detectAllConflicts([event('unavailable', {
    staff: [{ ...staff, isAvailable: false }],
  })]).some((item) => item.type === 'staff' && item.events.length === 1));
});

test('detects aggregate concurrent resource over-allocation', () => {
  const resource = { _id: 'projector', name: 'Projector', quantity: 3, available: 3, isAvailable: true };
  const first = event('first', { resources: [{ resource, quantity: 2 }] });
  const second = event('second', { resources: [{ resource, quantity: 2 }], venue: venue('venue-b') });
  assert.ok(detectAllConflicts([first, second]).some((item) => item.type === 'resource'));
});

test('aggregates repeated resource requirements within one event', () => {
  const resource = { _id: 'camera', name: 'Camera', quantity: 3, available: 3, isAvailable: true };
  const item = event('one-event', {
    resources: [
      { resource, quantity: 2 },
      { resource, quantity: 2 },
    ],
  });
  assert.ok(detectAllConflicts([item]).some((conflict) => conflict.type === 'resource'));
  const plan = generateOptimalSchedule({
    events: [item],
    venues: [venue()],
    resources: [resource],
    settings: {},
    options: { startDate: '2027-06-01', endDate: '2027-06-01' },
  });
  assert.equal(plan.assignments.length, 0);
  assert.equal(plan.unscheduled.length, 1);
});

test('detects venue capacity and availability violations', () => {
  const capacityConflict = event('capacity', { venue: venue('small', 20), expectedAudience: 21 });
  const unavailableVenue = event('closed', { venue: venue('closed', 200, { isAvailable: false }) });
  const conflicts = detectAllConflicts([capacityConflict, unavailableVenue]);
  assert.ok(conflicts.some((item) => item.type === 'capacity'));
  assert.ok(conflicts.some((item) => item.type === 'venue' && item.events.includes('closed')));
});

test('detects unavailable resources and event setup requirements', () => {
  const unavailableResource = { _id: 'camera', name: 'Camera', quantity: 2, available: 2, isAvailable: false };
  const item = event('needs-camera', {
    resources: [{ resource: unavailableResource, quantity: 1 }],
    requiredFacilities: ['Projector'],
    venue: venue('no-projector', 500, { facilities: [] }),
  });
  const conflicts = detectAllConflicts([item]);
  assert.ok(conflicts.some((conflict) => conflict.type === 'resource'));
  assert.ok(conflicts.some((conflict) => conflict.type === 'venue'));
});

test('honors configured venue turnaround gaps', () => {
  const first = event('first');
  const next = event('next', { startTime: '11:20', endTime: '12:00', venue: first.venue });
  assert.ok(!detectAllConflicts([first, next]).some((item) => item.type === 'buffer'));
  assert.ok(detectAllConflicts([first, next], { settings: { schedulingRules: { minGapMinutes: 30 } } })
    .some((item) => item.type === 'buffer'));
});

test('ranks feasible recommendations and explains score criteria', () => {
  const item = event('candidate', { venue: venue('venue-a', 500) });
  const alternatives = findFeasibleAlternatives({
    event: item,
    otherEvents: [],
    venues: [venue('venue-a', 500), venue('venue-b', 100)],
    resources: [],
    staff: [],
    limit: 5,
  });
  assert.ok(alternatives.length > 1);
  assert.equal(alternatives[0].rank, 1);
  assert.ok(alternatives[0].score >= alternatives.at(-1).score);
  assert.ok(alternatives[0].reason);
});

test('ranks preferred time slots above otherwise suitable alternatives', () => {
  const item = event('preference', {
    preferredTimeSlots: [{ startTime: '14:00', endTime: '15:00' }],
  });
  const alternatives = findFeasibleAlternatives({
    event: item,
    otherEvents: [],
    venues: [venue()],
    resources: [],
    staff: [],
    limit: 10,
  });
  assert.equal(alternatives[0].startTime, '14:00');
  assert.ok(alternatives[0].score > alternatives.find((candidate) => candidate.startTime === '10:00').score);
});

test('chooses same-role available staff and excludes unavailable staff', () => {
  const unavailable = { _id: 'staff-a', name: 'Unavailable', role: 'technician', isAvailable: false };
  const replacement = { _id: 'staff-b', name: 'Available', role: 'technician', isAvailable: true };
  const item = event('staffed', { staff: [unavailable] });
  const plan = generateOptimalSchedule({
    events: [item],
    venues: [venue()],
    resources: [],
    staff: [unavailable, replacement],
    settings: {},
    options: { startDate: '2027-06-01', endDate: '2027-06-01' },
  });
  assert.equal(plan.assignments.length, 1);
  assert.deepEqual(plan.assignments[0].staff, ['staff-b']);
});

test('reports unscheduled events when there is no venue with sufficient capacity', () => {
  const item = event('oversized', { expectedAudience: 300, venue: null });
  const plan = generateOptimalSchedule({
    events: [item],
    venues: [venue('small', 100)],
    resources: [],
    settings: {},
    options: { startDate: '2027-06-01', endDate: '2027-06-01' },
  });
  assert.equal(plan.assignments.length, 0);
  assert.match(plan.unscheduled[0].reason, /No available venue/);
});

test('rejects invalid custom date windows rather than silently ignoring them', () => {
  assert.throws(() => generateOptimalSchedule({
    events: [event('invalid-window')],
    venues: [venue()],
    resources: [],
    settings: {},
    options: { startDate: '2027-02-31', endDate: '2027-03-01' },
  }), (error) => error.status === 400 && /valid YYYY-MM-DD date/.test(error.message));
});

test('treats a missing settings document as default scheduling rules', () => {
  const proposal = generateOptimalSchedule({
    events: [event('without-settings')],
    venues: [venue()],
    resources: [],
    settings: null,
    options: { startDate: '2027-06-01', endDate: '2027-06-01' },
  });
  assert.equal(proposal.assignments.length, 1);
  assert.equal(proposal.unscheduled.length, 0);
  assert.doesNotThrow(() => detectAllConflicts([event('without-settings')], { settings: null }));
});

test('returns a feasible replacement slot without proposing a current collision', () => {
  const other = event('other', { venue: venue('venue-a') });
  const item = event('target', { venue: venue('venue-a') });
  const suggestions = findFeasibleAlternatives({
    event: item,
    otherEvents: [other],
    venues: [venue('venue-a')],
    resources: [],
    staff: [],
    limit: 5,
  });
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((suggestion) => suggestion.startTime !== '10:00'));
});

test('allows an alternate venue during an event that blocks the original venue', () => {
  const blocker = event('blocker', { venue: venue('venue-a') });
  const target = event('target', { venue: venue('venue-a') });
  const suggestions = findFeasibleAlternatives({
    event: target,
    otherEvents: [blocker],
    venues: [venue('venue-a'), venue('venue-b')],
    resources: [],
    staff: [],
    limit: 30,
  });

  assert.ok(suggestions.some((suggestion) =>
    suggestion.date === '2027-06-01' &&
    suggestion.startTime === '10:00' &&
    suggestion.venue === 'venue-b'
  ));
});

test('replaces unavailable resources only with available sufficient same-type inventory', () => {
  const unavailable = { _id: 'resource-a', name: 'Unavailable camera', type: 'camera', available: 5, isAvailable: false };
  const sufficient = { _id: 'resource-b', name: 'Available camera', type: 'camera', available: 3, isAvailable: true };
  const insufficient = { _id: 'resource-c', name: 'Insufficient camera', type: 'camera', available: 1, isAvailable: true };
  const target = event('target', { resources: [{ resource: unavailable, quantity: 2 }] });
  const suggestions = findFeasibleAlternatives({
    event: target,
    otherEvents: [],
    venues: [venue()],
    resources: [unavailable, sufficient, insufficient],
    staff: [],
    limit: 30,
  });

  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((suggestion) =>
    suggestion.resources.length === 1 &&
    suggestion.resources[0].resource === 'resource-b' &&
    suggestion.resources[0].quantity === 2
  ));
});

test('replaces overlapping staff only with available staff in the same role', () => {
  const assigned = { _id: 'staff-a', name: 'Busy technician', role: 'technician', isAvailable: true };
  const replacement = { _id: 'staff-b', name: 'Available technician', role: 'technician', isAvailable: true };
  const unavailable = { _id: 'staff-c', name: 'Unavailable technician', role: 'technician', isAvailable: false };
  const blocker = event('blocker', { venue: venue('venue-b'), staff: [assigned] });
  const target = event('target', { staff: [assigned] });
  const suggestions = findFeasibleAlternatives({
    event: target,
    otherEvents: [blocker],
    venues: [venue()],
    resources: [],
    staff: [assigned, replacement, unavailable],
    limit: 30,
  });

  assert.ok(suggestions.length > 0);
  const overlappingAlternatives = suggestions.filter((suggestion) => suggestion.startTime === '10:00');
  assert.ok(overlappingAlternatives.length > 0);
  assert.ok(overlappingAlternatives.every((suggestion) => suggestion.staff.includes('staff-b')));
  assert.ok(suggestions.every((suggestion) => !suggestion.staff.includes('staff-c')));
});

test('checks staff availability for event duration without extending staff bookings into venue buffers', () => {
  const assigned = { _id: 'staff-a', name: 'Technician', role: 'technician', isAvailable: true };
  const blocker = event('blocker', {
    startTime: '09:00',
    endTime: '10:00',
    venue: venue('venue-b'),
    staff: [assigned],
  });
  const target = event('target', {
    setupMinutes: 30,
    cleanupMinutes: 30,
    staff: [assigned],
  });
  const suggestions = findFeasibleAlternatives({
    event: target,
    otherEvents: [blocker],
    venues: [venue()],
    resources: [],
    staff: [assigned],
    limit: 30,
  });

  assert.ok(suggestions.some((suggestion) => suggestion.startTime === '10:00' && suggestion.staff.includes('staff-a')));
});
