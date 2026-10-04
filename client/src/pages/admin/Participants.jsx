import { useEffect, useState } from 'react';
import { registrationAPI, eventAPI, notificationAPI, userAPI } from '../../api/api';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/admin/PageHeader';
import DataTable from '../../components/admin/DataTable';
import Alert from '../../components/admin/Alert';
import Modal from '../../components/Modal';

export default function Participants() {
  const [regs, setRegs] = useState([]);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('');
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [notifyModal, setNotifyModal] = useState(false);
  const [notifyForm, setNotifyForm] = useState({ title: '', message: '', type: 'registration' });

  const load = async () => {
    setLoading(true);
    const params = eventFilter ? { event: eventFilter } : {};
    const [r, ev, u] = await Promise.all([registrationAPI.all(params), eventAPI.list({}), userAPI.list()]);
    setRegs(r.data);
    setEvents(ev.data);
    setUsers(u.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventFilter]);

  const filtered = filter === 'all' ? regs : regs.filter((r) => r.status === filter);

  const updateStatus = async (id, status) => {
    await registrationAPI.updateStatus(id, status);
    setMsg({ type: 'success', text: `Registration ${status}.` });
    load();
  };

  const exportList = async () => {
    const { data } = await registrationAPI.export(eventFilter || undefined);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'participants-export.json';
    a.click();
    setMsg({ type: 'success', text: 'Export downloaded.' });
  };

  const sendNotify = async (e) => {
    e.preventDefault();
    await notificationAPI.send({ ...notifyForm, broadcast: true });
    setNotifyModal(false);
    setMsg({ type: 'success', text: 'Notification sent to all participants.' });
  };

  const stats = [
    { label: 'Total', value: regs.length },
    { label: 'Approved', value: regs.filter((r) => r.status === 'approved').length },
    { label: 'Pending', value: regs.filter((r) => r.status === 'pending').length },
    { label: 'Users', value: users.length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Participant Management" subtitle="Approve registrations and manage attendees" breadcrumb="Events & People" stats={stats}
        actions={<><button type="button" onClick={exportList} className="btn-secondary">Export</button><button type="button" onClick={() => setNotifyModal(true)} className="btn-secondary">Notify All</button></>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="flex flex-wrap gap-3">
        {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-lg px-4 py-2 text-sm capitalize ${filter === s ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{s}</button>
        ))}
        <select className="input-field w-auto" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
          <option value="">All Events</option>
          {events.map((ev) => <option key={ev._id} value={ev._id}>{ev.title}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : (
        <DataTable
          searchKeys={[]}
          data={filtered}
          columns={[
            { key: 'user', label: 'Participant', render: (r) => (<div><p className="font-medium text-white">{r.user?.name}</p><p className="text-xs text-slate-500">{r.user?.email}</p></div>) },
            { key: 'event', label: 'Event', render: (r) => r.event?.title },
            { key: 'date', label: 'Event Date', render: (r) => formatDate(r.event?.date) },
            { key: 'venue', label: 'Venue', render: (r) => r.event?.venue?.name || '—' },
            { key: 'status', label: 'Status', render: (r) => <Badge type={r.status}>{r.status}</Badge> },
            { key: 'createdAt', label: 'Registered', render: (r) => formatDate(r.createdAt) },
          ]}
          actions={(r) => (
            <>
              {r.status === 'pending' && (<><button type="button" onClick={() => updateStatus(r._id, 'approved')} className="text-emerald-400 text-xs">Approve</button><button type="button" onClick={() => updateStatus(r._id, 'rejected')} className="text-red-400 text-xs">Reject</button></>)}
              <button type="button" onClick={() => { if (confirm('Remove participant?')) registrationAPI.remove(r._id).then(load); }} className="text-slate-400 text-xs">Remove</button>
            </>
          )}
        />
      )}

      <Modal open={notifyModal} onClose={() => setNotifyModal(false)} title="Send Notification to All">
        <form onSubmit={sendNotify} className="space-y-4">
          <input className="input-field" placeholder="Title" value={notifyForm.title} onChange={(e) => setNotifyForm({ ...notifyForm, title: e.target.value })} required />
          <textarea className="input-field min-h-[100px]" placeholder="Message" value={notifyForm.message} onChange={(e) => setNotifyForm({ ...notifyForm, message: e.target.value })} required />
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setNotifyModal(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Send</button></div>
        </form>
      </Modal>
    </div>
  );
}
