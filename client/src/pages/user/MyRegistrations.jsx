import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { registrationAPI } from '../../api/api';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/user/PageHeader';
import EmptyState from '../../components/user/EmptyState';
import Alert from '../../components/user/Alert';
import Modal from '../../components/Modal';

export default function MyRegistrations() {
  const [regs, setRegs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [cancelTarget, setCancelTarget] = useState(null);

  const load = () => {
    setLoading(true);
    registrationAPI.my().then(({ data }) => setRegs(data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = filter === 'all' ? regs : regs.filter((r) => r.status === filter);

  const stats = {
    all: regs.length,
    approved: regs.filter((r) => r.status === 'approved').length,
    pending: regs.filter((r) => r.status === 'pending').length,
    rejected: regs.filter((r) => r.status === 'rejected').length,
    cancelled: regs.filter((r) => r.status === 'cancelled').length,
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await registrationAPI.cancel(cancelTarget.event._id);
      setMsg({ type: 'success', text: 'Registration cancelled successfully.' });
      setCancelTarget(null);
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Cancellation failed' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Registrations"
        subtitle="Manage your event registrations and track approval status"
        breadcrumb="Account"
        actions={<Link to="/user/events" className="btn-primary">Browse Events</Link>}
      />

      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { key: 'all', label: 'All', count: stats.all },
          { key: 'approved', label: 'Approved', count: stats.approved },
          { key: 'pending', label: 'Pending', count: stats.pending },
          { key: 'rejected', label: 'Rejected', count: stats.rejected },
          { key: 'cancelled', label: 'Cancelled', count: stats.cancelled },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-xl border p-4 text-left transition ${
              filter === tab.key ? 'border-brand-500/50 bg-brand-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
            }`}
          >
            <p className="text-2xl font-bold text-white">{tab.count}</p>
            <p className="text-xs capitalize text-slate-500">{tab.label}</p>
          </button>
        ))}
      </div>

      {loading ? <Loading /> : filtered.length ? (
        <div className="space-y-4">
          {filtered.map((r) => (
            <div key={r._id} className="card overflow-hidden p-0">
              <div className="flex flex-col lg:flex-row">
                <div className="flex items-center gap-4 border-b border-slate-800 bg-slate-800/20 p-5 lg:w-48 lg:border-b-0 lg:border-r">
                  <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-brand-600/15">
                    <span className="text-xl font-bold text-brand-300">{new Date(r.event?.date).getDate()}</span>
                    <span className="text-xs uppercase text-slate-500">{new Date(r.event?.date).toLocaleString('en', { month: 'short' })}</span>
                  </div>
                  <Badge type={r.status} className="lg:hidden">{r.status}</Badge>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                  <div>
                    <Link to={`/user/events/${r.event?._id}`} className="text-lg font-semibold text-white hover:text-brand-300">
                      {r.event?.title}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span>🕐 {r.event?.startTime} – {r.event?.endTime}</span>
                      <span>📍 {r.event?.venue?.name}</span>
                      <span>🏷️ {r.event?.category?.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">Registered {formatDate(r.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge type={r.status} className="hidden lg:inline-flex">{r.status}</Badge>
                    <Link to={`/user/events/${r.event?._id}`} className="btn-secondary text-xs">View Event</Link>
                    {['approved', 'pending'].includes(r.status) && (
                      <button onClick={() => setCancelTarget(r)} className="btn-danger text-xs">Cancel</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🎫"
          title="No registrations found"
          description={filter === 'all' ? "You haven't registered for any events yet." : `No ${filter} registrations.`}
          action={<Link to="/user/events" className="btn-primary">Browse Events</Link>}
        />
      )}

      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Cancel Registration">
        <p className="text-sm text-slate-400">
          Are you sure you want to cancel your registration for <strong className="text-white">{cancelTarget?.event?.title}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setCancelTarget(null)} className="btn-secondary">Keep Registration</button>
          <button onClick={handleCancel} className="btn-danger">Confirm Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
