const eligibleStatuses = new Set(['scheduled', 'published']);
const activeRegistrationStatuses = new Set(['pending', 'approved']);
const stopWords = new Set([
  'a', 'about', 'an', 'and', 'are', 'available', 'can', 'festival', 'find', 'for',
  'give', 'happening', 'help', 'i', 'in', 'is', 'me', 'of', 'on', 'show', 'tell',
  'the', 'there', 'to', 'upcoming', 'what', 'when', 'where', 'which', 'with',
  'event', 'events', 'category', 'categories', 'list', 'today', 'tomorrow',
]);

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const eventRange = (event) => {
  const date = event?.date ? new Date(event.date) : null;
  const start = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(event?.startTime || '');
  const end = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(event?.endTime || '');
  if (!date || Number.isNaN(date.getTime()) || !start || !end) return null;

  const day = date.toISOString().slice(0, 10);
  const startAt = Date.parse(`${day}T${start[1]}:${start[2]}:00.000Z`);
  let endAt = Date.parse(`${day}T${end[1]}:${end[2]}:00.000Z`);
  if (endAt === startAt) return null;
  if (endAt < startAt) endAt += 24 * 60 * 60 * 1000;
  return { startAt, endAt, day };
};

const isAvailable = (event, now) => {
  if (!event || !eligibleStatuses.has(event.status)) return false;
  if (event.venue && (event.venue.isAvailable === false || event.venue.isBlocked)) return false;
  const range = eventRange(event);
  if (!range || range.startAt <= now.getTime()) return false;
  const capacity = Number(event.venue?.capacity);
  const registered = Number(event.registrationCount || 0);
  return !(Number.isFinite(capacity) && capacity > 0 && registered >= capacity);
};

const categoryName = (event) => event?.category?.name || '';

const matchedInterests = (event, interests) => {
  const category = normalize(categoryName(event));
  return interests.filter((interest) => {
    const normalized = normalize(interest);
    return normalized && (normalized === category || category.includes(normalized) || normalized.includes(category));
  });
};

const matchedSkills = (event, skills) => {
  const searchable = normalize([
    event.title,
    event.description,
    event.rules,
    categoryName(event),
    event.category?.description,
  ].filter(Boolean).join(' '));
  const words = new Set(searchable.split(/\s+/));
  return skills.filter((skill) => {
    const tokens = normalize(skill).split(/\s+/).filter((token) => token.length >= 3);
    return tokens.length > 0 && tokens.every((token) => words.has(token));
  });
};

const getRegisteredEvents = (registrations) => registrations
  .filter((registration) => activeRegistrationStatuses.has(registration.status) && registration.event)
  .map((registration) => registration.event);

const getOverlapDetails = (event, registeredEvents) => {
  const range = eventRange(event);
  if (!range) return [];
  return registeredEvents.flatMap((registeredEvent) => {
    const registeredRange = eventRange(registeredEvent);
    if (!registeredRange ||
      range.startAt >= registeredRange.endAt || registeredRange.startAt >= range.endAt) return [];
    return [{
      eventId: String(registeredEvent._id),
      title: registeredEvent.title,
      date: registeredEvent.date,
      startTime: registeredEvent.startTime,
      endTime: registeredEvent.endTime,
    }];
  });
};

const scoreEvent = (event, { interests, skills, registrations, feedback }) => {
  const interestMatches = matchedInterests(event, interests);
  const skillMatches = matchedSkills(event, skills);
  const categoryKey = normalize(categoryName(event));
  const registrationCount = registrations.filter((registration) =>
    activeRegistrationStatuses.has(registration.status) &&
    normalize(categoryName(registration.event)) === categoryKey
  ).length;
  const categoryFeedback = feedback.filter((item) =>
    normalize(categoryName(item.event)) === categoryKey
  );
  const averageRating = categoryFeedback.length
    ? categoryFeedback.reduce((sum, item) => sum + item.rating, 0) / categoryFeedback.length
    : null;

  const interestPoints = interestMatches.length ? 40 : 0;
  const skillPoints = Math.min(25, skillMatches.length * 8);
  const registrationPoints = Math.min(20, registrationCount * 5);
  const feedbackPoints = averageRating === null ? 0 : Math.round(((averageRating - 3) / 2) * 15);
  const featuredPoints = event.isFeatured ? 5 : 0;
  const matchPercentage = Math.max(0, Math.min(
    100,
    interestPoints + skillPoints + registrationPoints + feedbackPoints + featuredPoints
  ));

  const reasons = [];
  if (interestMatches.length) reasons.push(`Matches your ${interestMatches.join(', ')} interest.`);
  if (skillMatches.length) reasons.push(`Related to your ${skillMatches.join(', ')} skill${skillMatches.length > 1 ? 's' : ''}.`);
  if (registrationCount) reasons.push(`You have registered for ${registrationCount} other ${categoryName(event)} event${registrationCount > 1 ? 's' : ''}.`);
  if (averageRating !== null) reasons.push(`Your average rating for ${categoryName(event)} events is ${averageRating.toFixed(1)}/5.`);
  if (event.isFeatured) reasons.push('This is a featured festival event.');
  if (!reasons.length) reasons.push('An upcoming event that is currently available to attend.');

  return { matchPercentage, reasons };
};

export const getAvailableEvents = (events, now = new Date()) =>
  events.filter((event) => isAvailable(event, now));

export const buildEventRecommendations = ({
  events,
  registrations,
  feedback,
  interests = [],
  skills = [],
  now = new Date(),
}) => {
  const registeredIds = new Set(registrations.map((registration) =>
    registration.event?._id ? String(registration.event._id) : String(registration.event)
  ));
  const registeredEvents = getRegisteredEvents(registrations);

  return getAvailableEvents(events, now)
    .filter((event) => !registeredIds.has(String(event._id)))
    .map((event) => {
      const { matchPercentage, reasons } = scoreEvent(event, {
        interests, skills, registrations, feedback,
      });
      const capacity = Number(event.venue?.capacity);
      const conflicts = getOverlapDetails(event, registeredEvents);
      return {
        eventId: String(event._id),
        title: event.title,
        matchPercentage,
        score: matchPercentage,
        explanation: reasons.join(' '),
        reasons,
        isConflicting: conflicts.length > 0,
        conflicts,
        availability: {
          registrationCount: Number(event.registrationCount || 0),
          capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
          seatsRemaining: Number.isFinite(capacity) && capacity > 0
            ? Math.max(0, capacity - Number(event.registrationCount || 0))
            : null,
        },
        event,
      };
    })
    .sort((left, right) =>
      right.matchPercentage - left.matchPercentage ||
      new Date(left.event.date) - new Date(right.event.date) ||
      left.event.startTime.localeCompare(right.event.startTime) ||
      left.title.localeCompare(right.title)
    );
};

const getQuestionTerms = (question) => normalize(question)
  .split(/\s+/)
  .filter((term) => term.length >= 3 && !stopWords.has(term));

const dateMatchesQuestion = (event, question, now) => {
  const range = eventRange(event);
  if (!range) return false;
  const normalized = normalize(question);
  const today = now.toISOString().slice(0, 10);
  if (normalized.includes('tomorrow')) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return range.day === tomorrow;
  }
  if (normalized.includes('today')) return range.day === today;
  return true;
};

const formatEventForAnswer = (event) => {
  const date = new Date(event.date).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const venue = event.venue?.name ? ` at ${event.venue.name}` : '';
  const seats = Number.isFinite(Number(event.venue?.capacity)) && Number(event.venue.capacity) > 0
    ? `, ${Math.max(0, Number(event.venue.capacity) - Number(event.registrationCount || 0))} seats remaining`
    : '';
  return `${event.title} (${categoryName(event) || 'Festival event'}) on ${date}, ${event.startTime}–${event.endTime}${venue}${seats}.`;
};

export const answerEventQuestion = (question, events, now = new Date()) => {
  const available = getAvailableEvents(events, now).filter((event) =>
    dateMatchesQuestion(event, question, now)
  );
  const terms = getQuestionTerms(question);
  const scored = available.map((event) => {
    const searchable = normalize([
      event.title,
      event.description,
      event.rules,
      categoryName(event),
      event.category?.description,
      event.venue?.name,
    ].filter(Boolean).join(' '));
    const matches = terms.filter((term) => searchable.includes(term));
    return { event, matchCount: matches.length };
  });
  const matching = terms.length
    ? scored.filter((item) => item.matchCount > 0).sort((a, b) =>
      b.matchCount - a.matchCount ||
      new Date(a.event.date) - new Date(b.event.date)
    ).map((item) => item.event)
    : available;
  const results = matching.slice(0, 5);

  if (!results.length) {
    const dateScope = normalize(question).includes('today') ? ' today'
      : normalize(question).includes('tomorrow') ? ' tomorrow' : '';
    return {
      answer: available.length
        ? `I couldn't find an available upcoming event matching that question${dateScope}. Try an event name or category.`
        : `There are no upcoming events currently available${dateScope}.`,
      events: [],
    };
  }

  const remainingCount = matching.length - results.length;
  return {
    answer: `I found ${matching.length} upcoming available event${matching.length === 1 ? '' : 's'}${terms.length ? ' matching your question' : ''}: ${results.map(formatEventForAnswer).join(' ')}${remainingCount > 0 ? ` And ${remainingCount} more; ask about a category or event name to narrow the list.` : ''}`,
    events: results.map((event) => ({
      _id: String(event._id),
      title: event.title,
      category: categoryName(event),
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      venue: event.venue?.name || '',
    })),
  };
};
