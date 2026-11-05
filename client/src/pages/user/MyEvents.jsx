import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { registrationAPI } from '../../api/api';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/user/PageHeader';
import EmptyState from '../../components/user/EmptyState';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'completed', label: 'Completed' },
];

const eventWindow = (event) => {
  const date = event?.date ? new Date(event.date) : null;
  const start = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(event?.startTime || '');
  const end = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(event?.endTime || '');
  if (!date || Number.isNaN(date.getTime()) || !start || !end) return null;
  const [year, month, day] = date.toISOString().slice(0, 10).split('-').map(Number);
  const startAt = Date.UTC(year, month - 1, day, Number(start[1]), Number(start[2])) - 330 * 60_000;
  let endAt = Date.UTC(year, month - 1, day, Number(end[1]), Number(end[2])) - 330 * 60_000;
  if (endAt <= startAt) endAt += 24 * 60 * 60_000;
  return { startAt, endAt };
};

const eventTab = (registration, now) => {
  const event = registration.event;
  if (!event || event.status === 'cancelled' || registration.status === 'cancelled' || registration.status === 'rejected') return null;
  if (event.status === 'completed') return 'completed';
  const range = eventWindow(event);
  if (!range) return null;
  if (['scheduled', 'published'].includes(event.status) && range.startAt <= now && range.endAt > now) return 'ongoing';
  if (['scheduled', 'published'].includes(event.status) && range.startAt > now) return 'upcoming';
  return null;
};

export default function MyEvents() {
  const [registrations, setRegistrations] = useState([]);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await registrationAPI.myEvents();
      if (!Array.isArray(data)) throw new Error('The My Events API returned an invalid response.');
      setRegistrations(data);
    } catch (error) {
      setLoadError(error.response?.data?.message || error.message || 'Unable to load your event history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const categorized = useMemo(() => registrations.map((registration) => ({
    registration,
    tab: eventTab(registration, now),
  })), [registrations, now]);
  const visible = categorized.filter((item) => item.tab === activeTab).map((item) => item.registration);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Events"
        subtitle="View your event registrations and attendance status"
        breadcrumb="Participation"
        actions={<Link to="/user/events" className="btn-secondary">Browse Events</Link>}
      />
      {loadError && (
        <div role="alert" className="card border border-red-500/30 text-sm text-red-300">
          {loadError}<button type="button" onClick={load} className="ml-3 underline">Retry</button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`rounded-xl border p-4 text-left ${activeTab === key ? 'border-brand-500/50 bg-brand-500/10' : 'border-slate-800 bg-slate-900/50'}`}
          >
            <p className="text-2xl font-bold text-white">{categorized.filter((item) => item.tab === key).length}</p>
            <p className="text-sm text-slate-400">{label}</p>
          </button>
        ))}
      </div>

      {loading ? <Loading /> : visible.length ? (
        <div className="space-y-4">
          {visible.map((registration) => {
            const event = registration.event;
            return (
              <article key={registration._id} className="card space-y-4">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <Link to={`/user/events/${event._id}`} className="text-lg font-semibold text-white hover:text-brand-300">{event.title}</Link>
                    <p className="mt-1 text-sm text-slate-400">{formatDate(event.date)} · {event.startTime}–{event.endTime} · {event.venue?.name || 'Venue TBD'}</p>
                    <p className="mt-1 text-xs text-slate-500">Registered {formatDate(registration.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge type={registration.status}>{registration.status}</Badge>
                    <Badge type={event.status}>{`Event Status: ${event.status.charAt(0).toUpperCase()}${event.status.slice(1)}`}</Badge>
                    {event.status === 'completed' && (
                      <Badge type={registration.attendanceStatus === 'verified' ? 'approved' : registration.attendanceStatus === 'absent' ? 'rejected' : 'pending'}>
                        {registration.attendanceStatus === 'verified' ? 'Attendance: Present' : registration.attendanceStatus === 'absent' ? 'Attendance: Absent' : 'Attendance: Not Marked'}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                  <Link to={`/user/events/${event._id}`} className="btn-secondary text-sm">Event details</Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : !loadError && (
        <EmptyState
          icon={activeTab === 'completed' ? '🏅' : activeTab === 'ongoing' ? '🎪' : '📅'}
          title={`No ${activeTab} events`}
          description={activeTab === 'completed'
            ? 'Your completed events and attendance statuses will appear here.'
            : activeTab === 'ongoing'
              ? 'You do not have an event in progress right now.'
              : 'Approved and pending registrations for upcoming events will appear here.'}
          action={<Link to="/user/events" className="btn-primary">Browse Events</Link>}
        />
      )}
    </div>
  );
}
