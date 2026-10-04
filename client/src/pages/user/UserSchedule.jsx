import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { scheduleAPI, eventAPI, registrationAPI } from '../../api/api';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/user/PageHeader';

export default function UserSchedule() {
  const [tab, setTab] = useState('festival');
  const [view, setView] = useState('day');
  const [festivalData, setFestivalData] = useState(null);
  const [myEvents, setMyEvents] = useState([]);
  const [live, setLive] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [tomorrowEvents, setTomorrowEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    Promise.all([
      scheduleAPI.view(view),
      scheduleAPI.public(),
      eventAPI.live(),
      eventAPI.list({ date: todayStr, status: 'published' }),
      eventAPI.list({ date: tomorrowStr, status: 'published' }),
      registrationAPI.my(),
    ]).then(([viewData, publicSchedule, liveData, today, tomorrow, regs]) => {
      setFestivalData(viewData.data);
      setLive(liveData.data);
      setTodayEvents(today.data);
      setTomorrowEvents(tomorrow.data);
      setMyEvents(regs.data.filter((r) => r.status === 'approved').map((r) => r.event).filter(Boolean));
    }).finally(() => setLoading(false));
  }, [view]);

  const renderGrouped = (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return Object.entries(data).map(([key, events]) => (
      <div key={key} className="card">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
          <span className="rounded-lg bg-slate-800 px-3 py-1 text-sm">{key}</span>
          <span className="text-sm font-normal text-slate-500">{(Array.isArray(events) ? events : []).length} events</span>
        </h3>
        <div className="space-y-2">
          {(Array.isArray(events) ? events : []).map((ev) => (
            <Link key={ev._id} to={`/user/events/${ev._id}`} className="flex items-center justify-between rounded-lg bg-slate-800/40 p-4 transition hover:bg-slate-800/60">
              <div>
                <p className="font-medium text-white">{ev.title}</p>
                <p className="text-xs text-slate-500">{ev.category?.name} · {ev.venue?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-brand-300">{ev.startTime} – {ev.endTime}</p>
                {ev.isFeatured && <Badge type="published" className="mt-1">Featured</Badge>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Festival Schedule"
        subtitle="View the complete festival timetable and your registered events"
        breadcrumb="Schedule"
      />

      {live.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-slate-900/50 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-emerald-300">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
            Live Now — {live.length} event(s)
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((ev) => (
              <Link key={ev._id} to={`/user/events/${ev._id}`} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 hover:bg-emerald-500/10">
                <p className="font-medium text-white">{ev.title}</p>
                <p className="text-xs text-emerald-200/70">{ev.venue?.name} · ends {ev.endTime}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-semibold text-white">Today's Events</h3>
          {todayEvents.length ? todayEvents.slice(0, 4).map((ev) => (
            <Link key={ev._id} to={`/user/events/${ev._id}`} className="mb-2 block rounded-lg bg-slate-800/40 p-3 text-sm hover:bg-slate-800/60">
              <span className="text-brand-400">{ev.startTime}</span> · {ev.title}
            </Link>
          )) : <p className="text-sm text-slate-500">No events today</p>}
        </div>
        <div className="card">
          <h3 className="mb-3 font-semibold text-white">Tomorrow's Events</h3>
          {tomorrowEvents.length ? tomorrowEvents.slice(0, 4).map((ev) => (
            <Link key={ev._id} to={`/user/events/${ev._id}`} className="mb-2 block rounded-lg bg-slate-800/40 p-3 text-sm hover:bg-slate-800/60">
              <span className="text-brand-400">{ev.startTime}</span> · {ev.title}
            </Link>
          )) : <p className="text-sm text-slate-500">No events tomorrow</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab('festival')} className={`rounded-lg px-4 py-2 text-sm ${tab === 'festival' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Full Festival</button>
        <button onClick={() => setTab('mine')} className={`rounded-lg px-4 py-2 text-sm ${tab === 'mine' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>My Registered ({myEvents.length})</button>
      </div>

      {tab === 'festival' && (
        <div className="flex gap-2">
          {['day', 'venue', 'category'].map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-lg px-4 py-2 text-sm capitalize ${view === v ? 'bg-slate-700 text-white' : 'bg-slate-800/50 text-slate-400'}`}>
              {v}-wise
            </button>
          ))}
        </div>
      )}

      {loading ? <Loading /> : tab === 'festival' ? (
        <div className="space-y-6">{renderGrouped(festivalData)}</div>
      ) : (
        <div className="space-y-4">
          {myEvents.length ? myEvents.map((ev) => (
            <Link key={ev._id} to={`/user/events/${ev._id}`} className="card flex items-center justify-between transition hover:border-brand-500/30">
              <div>
                <p className="font-semibold text-white">{ev.title}</p>
                <p className="text-sm text-slate-500">{formatDate(ev.date)} · {ev.startTime} – {ev.endTime} · {ev.venue?.name}</p>
              </div>
              <Badge>{ev.category?.name}</Badge>
            </Link>
          )) : (
            <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
              No approved registrations. <Link to="/user/events" className="text-brand-400">Register for events</Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
