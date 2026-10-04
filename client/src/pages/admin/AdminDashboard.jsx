import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../../api/api';
import StatCard from '../../components/StatCard';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/admin/PageHeader';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.admin().then(({ data: d }) => setData(d)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading fullScreen />;

  const { stats, upcomingEvents, conflictAlerts, resourceUsage, aiScheduleSummary } = data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Operations Dashboard"
        subtitle="Real-time overview of festival management"
        breadcrumb="Overview"
        actions={
          <>
            <Link to="/admin/conflicts" className="btn-secondary">View Conflicts</Link>
            <Link to="/admin/ai-scheduling" className="btn-primary">AI Scheduler</Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total Events" value={stats.totalEvents} icon="🎭" color="brand" trend="All festival events" />
        <StatCard label="Venues" value={stats.totalVenues} icon="🏛️" color="cyan" />
        <StatCard label="Participants" value={stats.totalParticipants} icon="👥" color="emerald" trend={`${stats.approvedRegistrations} approved`} />
        <StatCard label="Resources" value={stats.totalResources} icon="📦" color="amber" />
        <StatCard label="Open Conflicts" value={stats.openConflicts} icon="⚠️" color="rose" trend={stats.openConflicts > 0 ? 'Needs attention' : 'All clear'} />
        <StatCard label="Registrations" value={stats.approvedRegistrations} icon="🎫" color="brand" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Upcoming Events</h3>
              <p className="text-xs text-slate-500">Next scheduled performances</p>
            </div>
            <Link to="/admin/events" className="text-sm text-brand-400">Manage events →</Link>
          </div>
          <div className="space-y-3">
            {upcomingEvents?.map((ev) => (
              <div key={ev._id} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-800/30 p-4">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-600/15 text-center">
                  <span className="text-xs font-bold text-brand-300">{new Date(ev.date).getDate()}</span>
                  <span className="text-[10px] uppercase text-slate-500">{new Date(ev.date).toLocaleString('en', { month: 'short' })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{ev.title}</p>
                  <p className="text-xs text-slate-500">{ev.venue?.name} · {ev.startTime} · {ev.category?.name}</p>
                </div>
                <Badge type={ev.status}>{ev.status}</Badge>
              </div>
            ))}
            {!upcomingEvents?.length && <p className="py-8 text-center text-sm text-slate-500">No upcoming events</p>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">Conflict Alerts</h3>
              <Link to="/admin/conflicts" className="text-sm text-brand-400">Resolve</Link>
            </div>
            {conflictAlerts?.length ? conflictAlerts.map((c) => (
              <div key={c._id} className="mb-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3 last:mb-0">
                <div className="flex gap-2"><Badge type={c.severity}>{c.type}</Badge><Badge type={c.status}>{c.status}</Badge></div>
                <p className="mt-2 text-sm text-slate-300">{c.description}</p>
              </div>
            )) : <p className="text-sm text-emerald-400">✓ No open conflicts</p>}
          </div>

          <div className="card">
            <h3 className="mb-3 font-semibold text-white">AI Schedule Summary</h3>
            <p className="text-sm leading-relaxed text-slate-400">{aiScheduleSummary}</p>
            <Link to="/admin/schedule" className="btn-secondary mt-4 inline-flex text-xs">Open Schedule</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-5 font-semibold text-white">Resource Utilization</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {resourceUsage?.map((r) => {
            const used = r.quantity - r.available;
            const pct = r.quantity ? Math.round((used / r.quantity) * 100) : 0;
            return (
              <div key={r._id} className="rounded-lg bg-slate-800/40 p-4">
                <p className="text-sm font-medium text-white">{r.name}</p>
                <p className="text-xs text-slate-500">{r.type}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">{r.available}/{r.quantity} available ({pct}% used)</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: '/admin/events', icon: '🎭', label: 'Manage Events', desc: 'Create & publish' },
          { to: '/admin/participants', icon: '🎫', label: 'Participants', desc: 'Approve registrations' },
          { to: '/admin/reports', icon: '📈', label: 'Reports', desc: 'Analytics & export' },
          { to: '/admin/settings', icon: '⚙️', label: 'Settings', desc: 'Festival config' },
        ].map((q) => (
          <Link key={q.to} to={q.to} className="card transition hover:border-brand-500/30 hover:shadow-glow">
            <span className="text-2xl">{q.icon}</span>
            <p className="mt-3 font-semibold text-white">{q.label}</p>
            <p className="text-xs text-slate-500">{q.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
