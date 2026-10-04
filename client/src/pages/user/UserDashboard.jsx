import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/StatCard';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/user/PageHeader';
import EventCard from '../../components/user/EventCard';

export default function UserDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.user().then(({ data: d }) => setData(d)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading fullScreen />;

  const { stats, festival, upcomingRegistered, personalSchedule, notifications, recommendedEvents, liveEvents } = data;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'Guest'}`}
        subtitle={`${festival?.name || 'Metro Nexus Festival'} — your personalized festival hub`}
        actions={
          <>
            <Link to="/user/events" className="btn-primary">Browse Events</Link>
            <Link to="/user/recommendations" className="btn-secondary">AI Picks</Link>
          </>
        }
      />

      {festival?.startDate && (
        <div className="rounded-xl border border-brand-500/20 bg-gradient-to-r from-brand-950/40 to-slate-900/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-brand-300">Festival Dates</p>
              <p className="mt-1 text-white">
                {formatDate(festival.startDate)} — {formatDate(festival.endDate)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(user?.interests || []).slice(0, 4).map((interest) => (
                <Badge key={interest}>{interest}</Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {liveEvents?.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live Now
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {liveEvents.map((ev) => (
              <Link key={ev._id} to={`/user/events/${ev._id}`} className="rounded-lg bg-emerald-500/10 p-3 transition hover:bg-emerald-500/20">
                <p className="font-medium text-white">{ev.title}</p>
                <p className="text-xs text-emerald-200/70">{ev.venue?.name} · until {ev.endTime}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Registrations" value={stats.registeredCount} icon="🎫" trend={`${stats.approvedCount} approved`} />
        <StatCard label="Pending Approval" value={stats.pendingCount} icon="⏳" color="amber" />
        <StatCard label="Personal Plan" value={stats.personalScheduleCount} icon="📋" color="cyan" />
        <StatCard label="Unread Alerts" value={stats.unreadNotifications} icon="🔔" color="rose" />
        <StatCard label="My Reviews" value={stats.feedbackCount} icon="💬" color="emerald" />
        <StatCard label="Upcoming" value={upcomingRegistered?.length || 0} icon="📅" color="brand" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Upcoming Registered Events</h3>
              <p className="text-xs text-slate-500">Events you've signed up for</p>
            </div>
            <Link to="/user/registrations" className="text-sm text-brand-400 hover:text-brand-300">Manage →</Link>
          </div>
          {upcomingRegistered?.length ? (
            <div className="space-y-3">
              {upcomingRegistered.map((ev) => (
                <Link
                  key={ev._id}
                  to={`/user/events/${ev._id}`}
                  className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-800/30 p-4 transition hover:border-brand-500/30"
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-600/15 text-center">
                    <span className="text-xs font-bold text-brand-300">{new Date(ev.date).getDate()}</span>
                    <span className="text-[10px] uppercase text-slate-500">{new Date(ev.date).toLocaleString('en', { month: 'short' })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{ev.title}</p>
                    <p className="text-xs text-slate-500">{ev.startTime} – {ev.endTime} · {ev.venue?.name}</p>
                  </div>
                  <Badge>{ev.category?.name}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-slate-800/30 p-6 text-center text-sm text-slate-500">
              No upcoming registrations. <Link to="/user/events" className="text-brand-400">Explore events</Link>
            </p>
          )}
        </div>

        <div className="card">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-semibold text-white">Recent Notifications</h3>
            <Link to="/user/notifications" className="text-sm text-brand-400">View all</Link>
          </div>
          <div className="space-y-3">
            {notifications?.slice(0, 5).map((n) => (
              <div key={n._id} className={`rounded-lg p-3 ${!n.isRead ? 'border border-brand-500/20 bg-brand-500/5' : 'bg-slate-800/30'}`}>
                <p className="text-sm font-medium text-white">{n.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{n.message}</p>
              </div>
            ))}
            {!notifications?.length && <p className="text-sm text-slate-500">No notifications yet</p>}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Recommended For You</h3>
            <p className="text-sm text-slate-500">Based on your interests and featured events</p>
          </div>
          <Link to="/user/recommendations" className="text-sm text-brand-400">See AI recommendations →</Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {recommendedEvents?.map((ev) => (
            <EventCard key={ev._id} event={ev} compact />
          ))}
        </div>
      </div>

      {personalSchedule?.length > 0 && (
        <div>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Personal Schedule Preview</h3>
            <Link to="/user/personal-schedule" className="text-sm text-brand-400">Open planner →</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {personalSchedule.map((ev) => (
              <EventCard key={ev._id} event={ev} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
