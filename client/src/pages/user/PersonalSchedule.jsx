import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { userPortalAPI, aiAPI } from '../../api/api';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/user/PageHeader';
import EmptyState from '../../components/user/EmptyState';
import Alert from '../../components/user/Alert';
import EventCard from '../../components/user/EventCard';

export default function PersonalSchedule() {
  const [events, setEvents] = useState([]);
  const [overlaps, setOverlaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [view, setView] = useState('timeline');

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: schedule }, { data: overlapData }] = await Promise.all([
        userPortalAPI.personalSchedule(),
        userPortalAPI.stats(),
      ]);
      setEvents(schedule);
      setOverlaps(overlapData.scheduleOverlaps || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const removeEvent = async (eventId) => {
    try {
      await userPortalAPI.removeFromSchedule(eventId);
      setMsg({ type: 'success', text: 'Event removed from your personal plan.' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Could not remove event' });
    }
  };

  const checkOverlaps = async () => {
    const { data } = await aiAPI.checkOverlaps(events.map((e) => e._id));
    if (data.hasConflict) {
      setMsg({ type: 'warning', text: `Found ${data.overlaps.length} scheduling conflict(s) in your personal plan.` });
      setOverlaps(data.overlaps);
    } else {
      setMsg({ type: 'success', text: 'No time conflicts detected in your personal plan!' });
    }
  };

  const groupedByDay = events.reduce((acc, ev) => {
    const key = new Date(ev.date).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  Object.values(groupedByDay).forEach((dayEvents) => {
    dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal Schedule"
        subtitle="Build your custom festival plan — add events and track conflicts"
        breadcrumb="Planner"
        actions={
          <>
            <button onClick={checkOverlaps} className="btn-secondary">Check Conflicts</button>
            <Link to="/user/events" className="btn-primary">Add Events</Link>
          </>
        }
      />

      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      {overlaps.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <h3 className="font-semibold text-amber-300">⚠ Schedule Conflicts Detected</h3>
          <div className="mt-3 space-y-2">
            {overlaps.map((o, i) => (
              <p key={i} className="text-sm text-amber-200/80">{o.description}</p>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => setView('timeline')} className={`rounded-lg px-4 py-2 text-sm ${view === 'timeline' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Timeline</button>
        <button onClick={() => setView('cards')} className={`rounded-lg px-4 py-2 text-sm ${view === 'cards' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Cards</button>
      </div>

      {loading ? <Loading /> : events.length ? (
        view === 'timeline' ? (
          <div className="space-y-8">
            {Object.entries(groupedByDay).map(([day, dayEvents]) => (
              <div key={day}>
                <h3 className="mb-4 flex items-center gap-3 font-semibold text-white">
                  <span className="rounded-lg bg-brand-600/15 px-3 py-1 text-sm text-brand-300">{formatDate(dayEvents[0].date)}</span>
                  <span className="text-sm font-normal text-slate-500">{dayEvents.length} event(s)</span>
                </h3>
                <div className="relative space-y-0 border-l-2 border-slate-800 pl-8">
                  {dayEvents.map((ev) => (
                    <div key={ev._id} className="relative pb-8 last:pb-0">
                      <span className="absolute -left-[41px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-brand-500 bg-slate-950" />
                      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-brand-400">{ev.startTime} – {ev.endTime}</p>
                            <Link to={`/user/events/${ev._id}`} className="mt-1 text-lg font-semibold text-white hover:text-brand-300">{ev.title}</Link>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge>{ev.category?.name}</Badge>
                              <span className="text-xs text-slate-500">📍 {ev.venue?.name}</span>
                            </div>
                          </div>
                          <button onClick={() => removeEvent(ev._id)} className="text-sm text-red-400 hover:text-red-300">Remove</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((ev) => (
              <EventCard
                key={ev._id}
                event={ev}
                actions={
                  <>
                    <Link to={`/user/events/${ev._id}`} className="btn-secondary text-xs">Details</Link>
                    <button onClick={() => removeEvent(ev._id)} className="btn-danger text-xs">Remove</button>
                  </>
                }
              />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon="📋"
          title="Your personal schedule is empty"
          description="Add events from Browse Events or event detail pages to build your custom festival plan."
          action={<Link to="/user/events" className="btn-primary">Browse Events</Link>}
        />
      )}
    </div>
  );
}
