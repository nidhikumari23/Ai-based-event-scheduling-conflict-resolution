import { detectAllConflicts, getEventInterval, parseTime } from '../services/schedulingEngine.js';

const sameDay = (first, second) => {
  const firstDate = new Date(first);
  const secondDate = new Date(second);
  return !Number.isNaN(firstDate.getTime()) &&
    !Number.isNaN(secondDate.getTime()) &&
    firstDate.toISOString().slice(0, 10) === secondDate.toISOString().slice(0, 10);
};

const timesOverlap = (startA, endA, startB, endB) => {
  const parseInterval = (start, end) => {
    const startMinute = parseTime(start);
    const endMinute = parseTime(end);
    if (startMinute == null || endMinute == null || startMinute === endMinute) return null;
    return { start: startMinute, end: endMinute <= startMinute ? endMinute + 1440 : endMinute };
  };
  const first = parseInterval(startA, endA);
  const second = parseInterval(startB, endB);
  if (!first || !second) return false;
  return first.start < second.end && second.start < first.end;
};

export { detectAllConflicts, getEventInterval, parseTime, sameDay, timesOverlap };
