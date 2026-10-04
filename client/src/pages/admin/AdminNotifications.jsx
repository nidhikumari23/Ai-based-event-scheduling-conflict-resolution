import { useEffect, useState } from 'react';
import { notificationAPI } from '../../api/api';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/admin/PageHeader';
import DataTable from '../../components/admin/DataTable';
import Alert from '../../components/admin/Alert';

const templates = [
  { title: 'Schedule Update', message: 'The festival schedule has been updated. Please review your registrations.', type: 'schedule_change' },
  { title: 'Event Reminder', message: 'Your registered event starts in 1 hour. Please arrive 15 minutes early.', type: 'reminder' },
  { title: 'Event Cancelled', message: 'An event you registered for has been cancelled. We apologize for the inconvenience.', type: 'cancellation' },
  { title: 'Conflict Alert', message: 'A scheduling conflict has been detected in your assigned area. Please review.', type: 'conflict_alert' },
  { title: 'AI Schedule Update', message: 'Our AI has optimized the festival schedule. Check the updated timings.', type: 'ai_recommendation' },
];

export default function AdminNotifications() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', message: '', type: 'general', broadcast: true, userIds: '' });
  const [msg, setMsg] = useState({ type: 'info', text: '' });

  const load = () => {
    notificationAPI.list().then(({ data }) => setHistory(data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (!form.broadcast && form.userIds) {
      payload.userIds = form.userIds.split(',').map((s) => s.trim()).filter(Boolean);
      payload.broadcast = false;
    }
    await notificationAPI.send(payload);
    setForm({ title: '', message: '', type: 'general', broadcast: true, userIds: '' });
    setMsg({ type: 'success', text: 'Notification sent successfully.' });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Notification Management" subtitle="Send alerts and announcements to participants" breadcrumb="Communication" />

      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h3 className="font-semibold text-white">Compose Notification</h3>
          <div><label className="mb-1 block text-sm text-slate-400">Title *</label><input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Message *</label><textarea className="input-field min-h-[100px]" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Type</label>
            <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {['general', 'event_update', 'schedule_change', 'cancellation', 'reminder', 'conflict_alert', 'registration', 'ai_recommendation'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={form.broadcast} onChange={(e) => setForm({ ...form, broadcast: e.target.checked })} />Broadcast to all users</label>
          {!form.broadcast && <input className="input-field" placeholder="User IDs (comma separated)" value={form.userIds} onChange={(e) => setForm({ ...form, userIds: e.target.value })} />}
          <button type="submit" className="btn-primary w-full">Send Notification</button>
        </form>

        <div className="card">
          <h3 className="mb-4 font-semibold text-white">Quick Templates</h3>
          <div className="space-y-2">
            {templates.map((t) => (
              <button key={t.type} type="button" onClick={() => setForm({ ...form, ...t, broadcast: true })} className="w-full rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-left text-sm transition hover:border-brand-500/30">
                <p className="font-medium text-white">{t.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{t.message}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold text-white">Recent Notifications</h3>
        {loading ? <Loading /> : (
          <DataTable
            data={history.slice(0, 20)}
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'type', label: 'Type', render: (n) => <Badge>{n.type?.replace(/_/g, ' ')}</Badge> },
              { key: 'isRead', label: 'Read', render: (n) => n.isRead ? 'Yes' : 'No' },
              { key: 'createdAt', label: 'Sent', render: (n) => new Date(n.createdAt).toLocaleString() },
            ]}
            actions={(n) => <button type="button" onClick={() => notificationAPI.remove(n._id).then(load)} className="text-red-400 text-xs">Delete</button>}
          />
        )}
      </div>
    </div>
  );
}
