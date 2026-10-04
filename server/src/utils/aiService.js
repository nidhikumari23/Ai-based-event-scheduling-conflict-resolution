import OpenAI from 'openai';
import { Settings } from '../models/Settings.js';

const getClient = async () => {
  const settings = await Settings.findOne();
  const apiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('your_openai')) return null;
  return new OpenAI({ apiKey });
};

export const generateAISchedule = async (payload) => {
  const client = await getClient();
  const { events, venues, resources, settings } = payload;

  if (!client) {
    const sorted = [...events].sort((a, b) => (b.priority || 5) - (a.priority || 5));
    return {
      summary: 'Rule-based schedule generated (OpenAI key not configured). Events ordered by priority with conflict-aware suggestions.',
      suggestions: sorted.map((e, i) => ({
        eventId: e._id,
        order: i + 1,
        recommendation: `Keep "${e.title}" at ${e.startTime}-${e.endTime} in ${e.venue?.name || 'TBD'}`,
      })),
      optimizedOrder: sorted.map((e) => e._id),
    };
  }

  const prompt = `You are a festival scheduling AI. Analyze these events and suggest an optimized schedule.
Festival: ${settings?.festivalName || 'Festival'}
Events: ${JSON.stringify(events.map((e) => ({ id: e._id, title: e.title, date: e.date, start: e.startTime, end: e.endTime, venue: e.venue?.name, priority: e.priority, audience: e.expectedAudience })))}
Venues: ${JSON.stringify(venues.map((v) => ({ name: v.name, capacity: v.capacity })))}
Resources: ${JSON.stringify(resources.map((r) => ({ name: r.name, available: r.available })))}
Return JSON with: summary (string), suggestions (array of {eventId, order, recommendation}), optimizedOrder (array of event ids as strings).`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
};

export const generateAIRecommendations = async (user, events) => {
  const client = await getClient();
  const interests = user.interests || [];

  if (!client) {
    const scored = events
      .map((e) => ({
        event: e,
        score:
          (interests.includes(e.category?.name) ? 10 : 0) +
          (e.isFeatured ? 5 : 0) +
          (e.priority || 5),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      summary: 'Personalized recommendations based on your interests and featured events.',
      recommendations: scored.map(({ event, score }) => ({
        eventId: event._id,
        title: event.title,
        reason: interests.includes(event.category?.name)
          ? `Matches your interest in ${event.category?.name}`
          : event.isFeatured
            ? 'Featured event'
            : 'Popular upcoming event',
        score,
      })),
    };
  }

  const prompt = `Recommend festival events for a user.
User interests: ${interests.join(', ') || 'general'}
Available events: ${JSON.stringify(events.map((e) => ({ id: e._id, title: e.title, category: e.category?.name, date: e.date, featured: e.isFeatured })))}
Return JSON with: summary (string), recommendations (array of {eventId, title, reason, score}).`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
};

export const resolveConflictWithAI = async (conflict, events) => {
  const client = await getClient();
  if (!client) {
    return {
      suggestion: conflict.aiSuggestion || 'Review event timings and reassign venue or resources manually.',
      steps: ['Identify overlapping events', 'Check alternative venues', 'Adjust start/end times'],
    };
  }

  const prompt = `Resolve this festival scheduling conflict:
Conflict: ${JSON.stringify({ type: conflict.type, description: conflict.description })}
Related events: ${JSON.stringify(events.map((e) => ({ title: e.title, date: e.date, time: `${e.startTime}-${e.endTime}`, venue: e.venue?.name })))}
Return JSON with: suggestion (string), steps (array of strings).`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
};

export const generatePersonalPlan = async (user, registeredEvents, allEvents) => {
  const client = await getClient();
  if (!client) {
    return {
      plan: registeredEvents.map((e) => ({
        time: `${e.startTime} - ${e.endTime}`,
        event: e.title,
        venue: e.venue?.name || 'TBD',
      })),
      warnings: [],
      summary: 'Your personal festival plan based on registered events.',
    };
  }

  const prompt = `Create a personal festival plan.
User: ${user.name}, interests: ${(user.interests || []).join(', ')}
Registered: ${JSON.stringify(registeredEvents.map((e) => ({ title: e.title, date: e.date, start: e.startTime, end: e.endTime })))}
Other events: ${JSON.stringify(allEvents.slice(0, 10).map((e) => ({ id: e._id, title: e.title, category: e.category?.name })))}
Return JSON with: plan (array of {time, event, venue}), warnings (array of strings for overlaps), summary (string).`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
};
