import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiAPI, registrationAPI, userPortalAPI } from '../../api/api';
import Loading from '../../components/Loading';
import PageHeader from '../../components/user/PageHeader';
import EmptyState from '../../components/user/EmptyState';
import EventCard from '../../components/user/EventCard';
import Alert from '../../components/user/Alert';

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState([]);
  const [preferences, setPreferences] = useState({ interests: [], skills: [] });
  const [plan, setPlan] = useState(null);
  const [personalIds, setPersonalIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [planError, setPlanError] = useState('');
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [actionEventId, setActionEventId] = useState('');
  const [question, setQuestion] = useState('');
  const [assistantResult, setAssistantResult] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await aiAPI.recommendations();
      if (!Array.isArray(data.recommendations)) {
        throw new Error('Recommendations returned an unexpected response.');
      }
      setRecommendations(data.recommendations);
      setPreferences({
        interests: Array.isArray(data.preferences?.interests) ? data.preferences.interests : [],
        skills: Array.isArray(data.preferences?.skills) ? data.preferences.skills : [],
      });

      const [personalPlanResult, scheduleResult] = await Promise.allSettled([
        aiAPI.personalPlan(),
        userPortalAPI.personalSchedule(),
      ]);
      if (personalPlanResult.status === 'fulfilled') {
        setPlan(personalPlanResult.value.data);
        setPlanError('');
      } else {
        setPlan(null);
        setPlanError(personalPlanResult.reason.response?.data?.message || 'Your personal plan could not be loaded.');
      }
      if (scheduleResult.status === 'fulfilled' && Array.isArray(scheduleResult.value.data)) {
        setPersonalIds(scheduleResult.value.data.map((event) => String(event._id)));
      } else if (scheduleResult.status === 'rejected') {
        setPlanError(scheduleResult.reason.response?.data?.message || 'Your personal schedule could not be loaded.');
      }
    } catch (error) {
      setLoadError(error.response?.data?.message || error.message || 'Unable to load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addToPlan = async (eventId) => {
    setActionEventId(eventId);
    try {
      const { data } = await userPortalAPI.addToSchedule(eventId);
      setPersonalIds(data.map((event) => String(event._id)));
      setMsg({ type: 'success', text: 'Added to your personal schedule.' });
    } catch (error) {
      setMsg({ type: 'error', text: error.response?.data?.message || 'Could not add this event to your plan.' });
    } finally {
      setActionEventId('');
    }
  };

  const register = async (eventId) => {
    setActionEventId(eventId);
    try {
      await registrationAPI.register(eventId);
      setMsg({ type: 'success', text: 'Registration submitted. You can track its status in My Registrations.' });
      await load();
    } catch (error) {
      setMsg({ type: 'error', text: error.response?.data?.message || 'Could not register for this event.' });
    } finally {
      setActionEventId('');
    }
  };

  const askAssistant = async (event) => {
    event.preventDefault();
    setAssistantLoading(true);
    setAssistantError('');
    setAssistantResult(null);
    try {
      const { data } = await aiAPI.askEventAssistant(question);
      setAssistantResult(data);
    } catch (error) {
      setAssistantError(error.response?.data?.message || 'The event assistant could not answer right now.');
    } finally {
      setAssistantLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Personalized Event Recommendations"
        subtitle="Relevant festival events ranked from your profile and live event availability"
        breadcrumb="AI Engine"
        actions={<Link to="/user/personal-schedule" className="btn-secondary">View Personal Plan</Link>}
      />

      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      {loadError && (
        <div role="alert" className="card border border-red-500/30 text-sm text-red-300">
          {loadError}
          <button type="button" onClick={load} className="ml-3 underline">Retry</button>
        </div>
      )}

      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Your recommendation profile</h2>
            <p className="mt-1 text-sm text-slate-400">
              Scores reflect your preferences, skills, registrations, and event feedback. Only upcoming events with current availability are included.
            </p>
          </div>
          <Link to="/user/profile?tab=interests" className="btn-secondary text-sm">Manage interests & skills</Link>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Interests</p>
            <div className="flex flex-wrap gap-2">
              {preferences.interests.length
                ? preferences.interests.map((interest) => <span key={interest} className="rounded-full bg-brand-500/15 px-3 py-1 text-xs text-brand-300">{interest}</span>)
                : <span className="text-sm text-slate-500">No interests selected yet.</span>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Skills & topics</p>
            <div className="flex flex-wrap gap-2">
              {preferences.skills.length
                ? preferences.skills.map((skill) => <span key={skill} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{skill}</span>)
                : <span className="text-sm text-slate-500">Add skills to improve topic matches.</span>}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Recommended for you</h2>
            <p className="mt-1 text-sm text-slate-400">{recommendations.length} eligible event{recommendations.length === 1 ? '' : 's'} from the current festival schedule.</p>
          </div>
          <Link to="/user/registrations" className="text-sm text-brand-300 hover:text-brand-200">My registrations</Link>
        </div>
        {recommendations.length ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((recommendation) => {
              const eventId = String(recommendation.eventId);
              const inPlan = personalIds.includes(eventId);
              return (
                <article key={eventId} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
                    <span className="rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-300">
                      {recommendation.matchPercentage}% match
                    </span>
                    {recommendation.isConflicting && (
                      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300">
                        Schedule overlap
                      </span>
                    )}
                  </div>
                  <EventCard
                    event={recommendation.event}
                    actions={(
                      <>
                        <button
                          type="button"
                          disabled={actionEventId === eventId}
                          onClick={() => register(eventId)}
                          className="btn-primary flex-1 text-xs disabled:opacity-50"
                        >
                          {actionEventId === eventId ? 'Please wait…' : 'Register'}
                        </button>
                        <button
                          type="button"
                          disabled={inPlan || actionEventId === eventId}
                          onClick={() => addToPlan(eventId)}
                          className="btn-secondary flex-1 text-xs disabled:opacity-50"
                        >
                          {inPlan ? 'In personal plan' : 'Add to plan'}
                        </button>
                      </>
                    )}
                  />
                  <div className="px-5 pb-5">
                    <p className="text-sm leading-relaxed text-slate-300">{recommendation.explanation}</p>
                    {recommendation.isConflicting && (
                      <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                        <p className="font-medium">Overlaps an event you registered for:</p>
                        {recommendation.conflicts.map((conflict) => (
                          <p key={conflict.eventId} className="mt-1">
                            {conflict.title} · {conflict.startTime}–{conflict.endTime}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : !loadError ? (
          <EmptyState
            icon="✨"
            title="No available recommendations right now"
            description="New upcoming events will appear here when they are scheduled and have registration capacity."
            action={<Link to="/user/events" className="btn-primary">Browse festival events</Link>}
          />
        ) : null}
      </section>

      <section className="card">
        <div className="mb-4 flex items-start gap-3">
          <span className="text-2xl" aria-hidden="true">💬</span>
          <div>
            <h2 className="font-semibold text-white">AI Event Assistant</h2>
            <p className="mt-1 text-sm text-slate-400">Ask about upcoming events, categories, dates, times, venues, or availability.</p>
          </div>
        </div>
        <form onSubmit={askAssistant} className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input-field flex-1"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="For example: Which technical workshops are available?"
            minLength={3}
            maxLength={500}
            required
          />
          <button type="submit" disabled={assistantLoading} className="btn-primary disabled:opacity-50">
            {assistantLoading ? 'Searching…' : 'Ask'}
          </button>
        </form>
        {assistantError && <p role="alert" className="mt-3 text-sm text-red-300">{assistantError}</p>}
        {assistantResult && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-sm leading-relaxed text-slate-200">{assistantResult.answer}</p>
            {assistantResult.events?.length > 0 && (
              <ul className="mt-3 space-y-2">
                {assistantResult.events.map((event) => (
                  <li key={event._id}>
                    <Link to={`/user/events/${event._id}`} className="text-sm text-brand-300 hover:text-brand-200">
                      {event.title} · {event.category} · {event.startTime}–{event.endTime}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 text-lg font-semibold text-white">Your registered festival plan</h2>
        {planError && <p role="alert" className="mb-3 text-sm text-amber-300">{planError}</p>}
        {plan?.summary && <p className="mb-5 text-sm text-slate-400">{plan.summary}</p>}
        {plan?.warnings?.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <h3 className="font-medium text-amber-300">Overlap warnings</h3>
            {plan.warnings.map((warning, index) => <p key={index} className="mt-2 text-sm text-amber-200/80">⚠ {warning}</p>)}
          </div>
        )}
        {plan?.plan?.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-800/50 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Venue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {plan.plan.map((item, index) => (
                  <tr key={`${item.event}-${index}`}>
                    <td className="px-4 py-3 text-brand-300">{item.time}</td>
                    <td className="px-4 py-3 font-medium text-white">{item.event}</td>
                    <td className="px-4 py-3 text-slate-400">{item.venue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !planError && (
          <p className="text-sm text-slate-500">Your registered events will appear here after registration approval.</p>
        )}
      </section>
    </div>
  );
}
