const FESTIVAL_OFFSET_MINUTES = 5 * 60 + 30;

export const getFestivalEventEnd = (event) => {
  const date = event?.date instanceof Date ? event.date : new Date(event?.date);
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(event?.endTime || '');
  if (!event?.date || Number.isNaN(date.getTime()) || !match) return null;

  const [year, month, day] = date.toISOString().slice(0, 10).split('-').map(Number);
  const endMinute = Number(match[1]) * 60 + Number(match[2]);
  const startMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(event.startTime || '');
  const startMinute = startMatch ? Number(startMatch[1]) * 60 + Number(startMatch[2]) : null;
  const endDayOffset = startMinute !== null && endMinute <= startMinute ? 1 : 0;
  return new Date(
    Date.UTC(year, month - 1, day + endDayOffset, Number(match[1]), Number(match[2])) -
      FESTIVAL_OFFSET_MINUTES * 60_000
  );
};

export const hasEventEnded = (event, now = new Date()) => {
  const end = getFestivalEventEnd(event);
  return Boolean(end && now.getTime() >= end.getTime());
};
