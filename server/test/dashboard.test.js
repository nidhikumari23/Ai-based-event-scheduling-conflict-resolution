import assert from 'node:assert/strict';
import test from 'node:test';
import { selectUpcomingAdminEvents } from '../src/controllers/dashboardController.js';

const event = (id, date, startTime, status = 'scheduled') => ({
  _id: id,
  date: new Date(`${date}T00:00:00.000Z`),
  startTime,
  status,
});

test('selects only upcoming scheduled and published events using the Asia/Kolkata calendar date and time', () => {
  const now = new Date('2026-11-05T10:00:00.000Z');
  const events = [
    event('tomorrow', '2026-11-06', '09:00'),
    event('today-later', '2026-11-05', '15:31'),
    event('today-published', '2026-11-05', '16:30', 'published'),
    event('today-at-now', '2026-11-05', '15:30'),
    event('today-past', '2026-11-05', '15:29'),
    event('draft', '2026-11-07', '10:00', 'draft'),
    event('cancelled', '2026-11-08', '10:00', 'cancelled'),
    event('invalid-date', 'not-a-date', '17:00'),
  ];

  assert.deepEqual(
    selectUpcomingAdminEvents(events, now).map(({ _id }) => _id),
    ['today-at-now', 'today-later', 'today-published', 'tomorrow']
  );
});

test('limits the upcoming list after sorting by date and start time', () => {
  const now = new Date('2026-11-05T06:30:00.000Z');
  const events = [
    event('late', '2026-11-06', '12:00'),
    event('early', '2026-11-06', '09:00'),
    event('tomorrow', '2026-11-07', '08:00'),
  ];
  assert.deepEqual(
    selectUpcomingAdminEvents(events, now, 2).map(({ _id }) => _id),
    ['early', 'late']
  );
});

test('uses the festival local date across the UTC date boundary', () => {
  const now = new Date('2026-11-04T20:00:00.000Z');
  const events = [
    event('festival-today', '2026-11-05', '02:00'),
    event('previous-festival-day', '2026-11-04', '23:00'),
    event('next-festival-day', '2026-11-06', '09:00'),
  ];

  assert.deepEqual(
    selectUpcomingAdminEvents(events, now).map(({ _id }) => _id),
    ['festival-today', 'next-festival-day']
  );
});

test('excludes the saved 04:30 event as past but includes its intended 16:30 local-time counterpart', () => {
  const now = new Date('2026-11-05T10:50:00.000Z');
  const savedEvent = event('techincal', '2026-11-05', '04:30', 'published');
  const intendedEvent = { ...savedEvent, startTime: '16:30' };

  assert.deepEqual(selectUpcomingAdminEvents([savedEvent], now), []);
  assert.deepEqual(
    selectUpcomingAdminEvents([intendedEvent], now).map(({ _id }) => _id),
    ['techincal']
  );
});
