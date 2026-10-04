const parseTime = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
};

const timesOverlap = (s1, e1, s2, e2) => {
  const start1 = parseTime(s1);
  const end1 = parseTime(e1);
  const start2 = parseTime(s2);
  const end2 = parseTime(e2);
  return start1 < end2 && start2 < end1;
};

const sameDay = (d1, d2) => {
  const a = new Date(d1);
  const b = new Date(d2);
  return a.toDateString() === b.toDateString();
};

export const detectAllConflicts = (events) => {
  const conflicts = [];

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (!sameDay(a.date, b.date)) continue;

      if (timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
        conflicts.push({
          type: 'timing',
          severity: 'high',
          events: [a._id, b._id],
          description: `Time clash: "${a.title}" and "${b.title}" overlap on ${new Date(a.date).toDateString()}`,
          aiSuggestion: `Reschedule "${a.priority < b.priority ? a.title : b.title}" to an alternative slot or adjust start/end times.`,
        });
      }

      if (
        a.venue &&
        b.venue &&
        String(a.venue._id || a.venue) === String(b.venue._id || b.venue) &&
        timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)
      ) {
        conflicts.push({
          type: 'venue',
          severity: 'critical',
          events: [a._id, b._id],
          venue: a.venue._id || a.venue,
          description: `Venue conflict at "${a.venue?.name || 'venue'}" for "${a.title}" and "${b.title}"`,
          aiSuggestion: 'Move one event to an available venue with sufficient capacity.',
        });
      }

      if (a.staff?.length && b.staff?.length) {
        const aStaff = a.staff.map((s) => String(s._id || s));
        const bStaff = b.staff.map((s) => String(s._id || s));
        const shared = aStaff.filter((id) => bStaff.includes(id));
        if (shared.length && timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
          conflicts.push({
            type: 'staff',
            severity: 'medium',
            events: [a._id, b._id],
            staff: shared[0],
            description: `Staff member assigned to both "${a.title}" and "${b.title}" at overlapping times`,
            aiSuggestion: 'Reassign staff or adjust event timing.',
          });
        }
      }
    }
  }

  const resourceMap = {};
  events.forEach((ev) => {
    if (!ev.resources?.length) return;
    ev.resources.forEach(({ resource, quantity }) => {
      const rid = String(resource._id || resource);
      if (!resourceMap[rid]) resourceMap[rid] = { resource, bookings: [] };
      resourceMap[rid].bookings.push({ event: ev, quantity: quantity || 1 });
    });
  });

  Object.values(resourceMap).forEach(({ resource, bookings }) => {
    for (let i = 0; i < bookings.length; i++) {
      for (let j = i + 1; j < bookings.length; j++) {
        const a = bookings[i].event;
        const b = bookings[j].event;
        if (!sameDay(a.date, b.date)) continue;
        if (!timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) continue;
        const totalQty = bookings[i].quantity + bookings[j].quantity;
        const available = resource.available ?? resource.quantity ?? 0;
        if (totalQty > available) {
          conflicts.push({
            type: 'resource',
            severity: 'high',
            events: [a._id, b._id],
            resource: resource._id || resource,
            description: `Resource "${resource.name}" overbooked (${totalQty}/${available}) for "${a.title}" and "${b.title}"`,
            aiSuggestion: 'Reduce resource allocation or stagger event times.',
          });
        }
      }
    }
  });

  events.forEach((ev) => {
    if (ev.venue?.capacity && ev.expectedAudience > ev.venue.capacity) {
      conflicts.push({
        type: 'capacity',
        severity: 'medium',
        events: [ev._id],
        venue: ev.venue._id || ev.venue,
        description: `"${ev.title}" expected audience (${ev.expectedAudience}) exceeds venue capacity (${ev.venue.capacity})`,
        aiSuggestion: 'Move to a larger venue or cap registrations.',
      });
    }
  });

  return conflicts;
};

export { parseTime, timesOverlap, sameDay };
