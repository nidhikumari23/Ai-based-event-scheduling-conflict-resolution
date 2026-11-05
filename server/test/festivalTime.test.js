import assert from 'node:assert/strict';
import test from 'node:test';
import { getFestivalEventEnd, hasEventEnded } from '../src/utils/festivalTime.js';

test('converts an event local end time in Asia/Kolkata to its UTC instant', () => {
  const end = getFestivalEventEnd({
    date: new Date('2026-11-05T00:00:00.000Z'),
    startTime: '16:30',
    endTime: '17:00',
  });
  assert.equal(end.toISOString(), '2026-11-05T11:30:00.000Z');
  assert.equal(hasEventEnded({
    date: new Date('2026-11-05T00:00:00.000Z'),
    startTime: '16:30',
    endTime: '17:00',
  }, new Date('2026-11-05T11:29:59.999Z')), false);
  assert.equal(hasEventEnded({
    date: new Date('2026-11-05T00:00:00.000Z'),
    startTime: '16:30',
    endTime: '17:00',
  }, new Date('2026-11-05T11:30:00.000Z')), true);
});

test('handles events that end after midnight and invalid schedule values', () => {
  const overnight = getFestivalEventEnd({
    date: new Date('2026-11-05T00:00:00.000Z'),
    startTime: '23:30',
    endTime: '00:30',
  });
  assert.equal(overnight.toISOString(), '2026-11-05T19:00:00.000Z');
  assert.equal(getFestivalEventEnd({ date: 'not-a-date', startTime: '10:00', endTime: '11:00' }), null);
});
