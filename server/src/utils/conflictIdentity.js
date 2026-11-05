import { createHash } from 'node:crypto';

const idOf = (value) => {
  const id = value?._id ?? value?.id ?? value;
  return id == null ? '' : String(id);
};

export const proposedEventFingerprint = (event) => createHash('sha256')
  .update(JSON.stringify({
    title: event.title || '',
    category: idOf(event.category),
    date: event.date ? new Date(event.date).toISOString().slice(0, 10) : '',
    startTime: event.startTime || '',
    endTime: event.endTime || '',
    venue: idOf(event.venue),
    organizer: idOf(event.organizer),
    staff: (event.staff || []).map(idOf).sort(),
    resources: (event.resources || [])
      .map(({ resource, quantity }) => [idOf(resource), Number(quantity) || 1])
      .sort(([first], [second]) => first.localeCompare(second)),
    expectedAudience: Number(event.expectedAudience) || 0,
    setupMinutes: Number(event.setupMinutes) || 0,
    cleanupMinutes: Number(event.cleanupMinutes) || 0,
    requiredFacilities: [...(event.requiredFacilities || [])].sort(),
  }))
  .digest('hex');

export const conflictFingerprint = (conflict) => createHash('sha256')
  .update([
    conflict.type,
    ...(conflict.events || []).map(idOf).sort(),
    idOf(conflict.venue),
    idOf(conflict.resource),
    idOf(conflict.staff),
    conflict.proposedEvent ? proposedEventFingerprint(conflict.proposedEvent) : '',
  ].join(':'))
  .digest('hex');
