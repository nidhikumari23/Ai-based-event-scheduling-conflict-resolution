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

export const explainFeasibleSchedules = async ({ assignments, criteria, context = 'schedule' }) => {
  const fallback = assignments.length
    ? 'Feasible options were generated and ranked deterministically. Venue, staff, resource, timing, buffer, and capacity checks remain authoritative.'
    : 'No feasible assignments were found under the current availability and scheduling constraints.';
  try {
    const client = await getClient();
    if (!client || !assignments.length) return { explanation: fallback, aiEnabled: false };

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Explain only the provided, already validated schedule options and score criteria. Do not invent availability, events, or alternate dates/times/venues. Do not change their order or feasibility.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            context,
            scoreCriteria: criteria,
            feasibleOptions: assignments.map(({ eventId, title, date, startTime, endTime, venueName, score, reason }) => ({
              eventId, title, date, startTime, endTime, venueName, score, reason,
            })),
          }),
        },
      ],
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(response.choices[0].message.content);
    if (typeof parsed.explanation !== 'string' || !parsed.explanation.trim()) {
      return { explanation: fallback, aiEnabled: false };
    }
    return { explanation: parsed.explanation.slice(0, 1200), aiEnabled: true };
  } catch {
    console.warn('[Scheduling AI] Explanation unavailable; using deterministic schedule results.');
    return { explanation: fallback, aiEnabled: false };
  }
};
