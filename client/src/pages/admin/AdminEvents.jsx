import { useEffect, useState } from 'react';
import { eventAPI, categoryAPI, venueAPI, staffAPI, brandAPI } from '../../api/api';
import Modal from '../../components/Modal';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/admin/PageHeader';
import DataTable from '../../components/admin/DataTable';
import Alert from '../../components/admin/Alert';

const statusOptions = ['draft', 'scheduled', 'published', 'cancelled', 'completed'];

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [venues, setVenues] = useState([]);
  const [staff, setStaff] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [form, setForm] = useState({
    title: '', description: '', category: '', venue: '', organizer: '', date: '',
    startTime: '10:00', endTime: '12:00', expectedAudience: 100, priority: 5, status: 'draft', rules: '', isFeatured: false,
  });
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', startTime: '', endTime: '', venue: '' });

  const load = async () => {
    setLoading(true);
    const [ev, cat, ven, st, br] = await Promise.all([
      eventAPI.list({}), categoryAPI.list(true), venueAPI.list(), staffAPI.list(), brandAPI.list(true),
    ]);
    setEvents(ev.data);
    setCategories(cat.data);
    setVenues(ven.data);
    setStaff(st.data);
    setBrands(br.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? events : events.filter((e) => e.status === filter);

  const openEdit = (item = null) => {
    setEditItem(item);
    if (item) {
      setForm({
        title: item.title, description: item.description || '', category: item.category?._id || '',
        venue: item.venue?._id || '', organizer: item.organizer?._id || '',
        date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
        startTime: item.startTime, endTime: item.endTime, expectedAudience: item.expectedAudience,
        priority: item.priority, status: item.status, rules: item.rules || '', isFeatured: item.isFeatured,
      });
    } else {
      setForm({ title: '', description: '', category: '', venue: '', organizer: '', date: '', startTime: '10:00', endTime: '12:00', expectedAudience: 100, priority: 5, status: 'draft', rules: '', isFeatured: false });
    }
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, expectedAudience: Number(form.expectedAudience), priority: Number(form.priority) };
    try {
      if (editItem) await eventAPI.update(editItem._id, payload);
      else await eventAPI.create(payload);
      setModal(false);
      setMsg({ type: 'success', text: 'Event saved successfully.' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Save failed' });
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    await eventAPI.reschedule(rescheduleModal._id, rescheduleForm);
    setRescheduleModal(null);
    setMsg({ type: 'success', text: 'Event rescheduled.' });
    load();
  };

  const stats = [
    { label: 'Total', value: events.length },
    { label: 'Published', value: events.filter((e) => e.status === 'published').length },
    { label: 'Draft', value: events.filter((e) => e.status === 'draft').length },
    { label: 'Featured', value: events.filter((e) => e.isFeatured).length },
    { label: 'Cancelled', value: events.filter((e) => e.status === 'cancelled').length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Event Management" subtitle="Full lifecycle control for festival events" breadcrumb="Events & People" stats={stats} actions={<button type="button" onClick={() => openEdit()} className="btn-primary">+ Create Event</button>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="flex flex-wrap gap-2">
        {['all', ...statusOptions].map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-lg px-4 py-2 text-sm capitalize ${filter === s ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{s}</button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <DataTable
          searchKeys={['title']}
          data={filtered}
          onRowClick={setDetailModal}
          columns={[
            { key: 'title', label: 'Event', sortable: true, render: (ev) => (
              <div>
                <p className="font-medium text-white">{ev.title}</p>
                {ev.isFeatured && <Badge type="published" className="mt-1">Featured</Badge>}
              </div>
            )},
            { key: 'category', label: 'Category', render: (ev) => ev.category?.name },
            { key: 'venue', label: 'Venue', render: (ev) => ev.venue?.name || 'TBD' },
            { key: 'date', label: 'Date', sortable: true, render: (ev) => formatDate(ev.date) },
            { key: 'time', label: 'Time', render: (ev) => `${ev.startTime}–${ev.endTime}` },
            { key: 'registrations', label: 'Regs', render: (ev) => ev.registrationCount || 0 },
            { key: 'priority', label: 'Priority', sortable: true },
            { key: 'status', label: 'Status', render: (ev) => <Badge type={ev.status}>{ev.status}</Badge> },
          ]}
          actions={(ev) => (
            <>
              <button type="button" onClick={() => setDetailModal(ev)} className="text-slate-400 text-xs">View</button>
              <button type="button" onClick={() => openEdit(ev)} className="text-brand-400 text-xs">Edit</button>
              <button type="button" onClick={() => eventAPI.featured(ev._id).then(load)} className="text-amber-400 text-xs">Featured</button>
              <button type="button" onClick={() => { setRescheduleModal(ev); setRescheduleForm({ date: ev.date ? new Date(ev.date).toISOString().split('T')[0] : '', startTime: ev.startTime, endTime: ev.endTime, venue: ev.venue?._id || '' }); }} className="text-cyan-400 text-xs">Reschedule</button>
              {ev.status !== 'cancelled' && <button type="button" onClick={() => eventAPI.cancel(ev._id).then(load)} className="text-orange-400 text-xs">Cancel</button>}
              <button type="button" onClick={() => { if (confirm('Delete event?')) eventAPI.remove(ev._id).then(load); }} className="text-red-400 text-xs">Delete</button>
            </>
          )}
        />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Event' : 'Create Event'} size="xl">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-slate-400">Title *</label><input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-slate-400">Description</label><textarea className="input-field min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Category *</label><select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required><option value="">Select</option>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
          <div><label className="mb-1 block text-sm text-slate-400">Venue</label><select className="input-field" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}><option value="">Select</option>{venues.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}</select></div>
          <div><label className="mb-1 block text-sm text-slate-400">Organizer</label><select className="input-field" value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })}><option value="">Select</option>{staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
          <div><label className="mb-1 block text-sm text-slate-400">Date *</label><input type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Start</label><input type="time" className="input-field" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">End</label><input type="time" className="input-field" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Expected Audience</label><input type="number" className="input-field" value={form.expectedAudience} onChange={(e) => setForm({ ...form, expectedAudience: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Priority (1-10)</label><input type="number" min="1" max="10" className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Status</label><select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} /><label className="text-sm text-slate-400">Featured Event</label></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-slate-400">Rules</label><textarea className="input-field" value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} /></div>
          <div className="sm:col-span-2 flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Save Event</button></div>
        </form>
      </Modal>

      <Modal open={!!rescheduleModal} onClose={() => setRescheduleModal(null)} title="Reschedule Event">
        <form onSubmit={handleReschedule} className="space-y-4">
          <input type="date" className="input-field" value={rescheduleForm.date} onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <input type="time" className="input-field" value={rescheduleForm.startTime} onChange={(e) => setRescheduleForm({ ...rescheduleForm, startTime: e.target.value })} />
            <input type="time" className="input-field" value={rescheduleForm.endTime} onChange={(e) => setRescheduleForm({ ...rescheduleForm, endTime: e.target.value })} />
          </div>
          <select className="input-field" value={rescheduleForm.venue} onChange={(e) => setRescheduleForm({ ...rescheduleForm, venue: e.target.value })}>
            <option value="">Select venue</option>{venues.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
          </select>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setRescheduleModal(null)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Reschedule</button></div>
        </form>
      </Modal>

      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title={detailModal?.title} size="lg">
        {detailModal && (
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ['Category', detailModal.category?.name], ['Venue', detailModal.venue?.name], ['Organizer', detailModal.organizer?.name],
              ['Date', formatDate(detailModal.date)], ['Time', `${detailModal.startTime} – ${detailModal.endTime}`],
              ['Audience', detailModal.expectedAudience], ['Registrations', detailModal.registrationCount], ['Priority', detailModal.priority],
              ['Status', detailModal.status], ['Featured', detailModal.isFeatured ? 'Yes' : 'No'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-800/40 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-white">{value ?? '—'}</dd></div>
            ))}
            <div className="sm:col-span-2 rounded-lg bg-slate-800/40 p-3"><dt className="text-xs text-slate-500">Description</dt><dd className="mt-1 text-sm text-slate-300">{detailModal.description || '—'}</dd></div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
