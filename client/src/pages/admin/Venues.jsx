import { useEffect, useState } from 'react';
import { venueAPI } from '../../api/api';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';
import PageHeader from '../../components/admin/PageHeader';
import DataTable from '../../components/admin/DataTable';
import Alert from '../../components/admin/Alert';
import EmptyState from '../../components/admin/EmptyState';

export default function Venues() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [bookingsModal, setBookingsModal] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', location: '', capacity: 100, facilities: '', description: '' });
  const [blockModal, setBlockModal] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [msg, setMsg] = useState({ type: 'info', text: '' });

  const load = () => {
    setLoading(true);
    venueAPI.list().then(({ data }) => setVenues(data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openEdit = (item = null) => {
    setEditItem(item);
    setForm(item ? {
      name: item.name, location: item.location, capacity: item.capacity,
      facilities: (item.facilities || []).join(', '), description: item.description || '',
    } : { name: '', location: '', capacity: 100, facilities: '', description: '' });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, capacity: Number(form.capacity), facilities: form.facilities.split(',').map((s) => s.trim()).filter(Boolean) };
    if (editItem) await venueAPI.update(editItem._id, payload);
    else await venueAPI.create(payload);
    setModal(false);
    setMsg({ type: 'success', text: 'Venue saved successfully.' });
    load();
  };

  const viewBookings = async (venue) => {
    const { data } = await venueAPI.bookings(venue._id);
    setBookings(data);
    setBookingsModal(venue);
  };

  const toggleBlock = async () => {
    await venueAPI.block(blockModal._id, { isBlocked: !blockModal.isBlocked, reason: blockReason });
    setBlockModal(null);
    setBlockReason('');
    setMsg({ type: 'success', text: 'Venue block status updated.' });
    load();
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete venue "${item.name}"?`)) return;
    await venueAPI.remove(item._id);
    setMsg({ type: 'success', text: 'Venue deleted.' });
    load();
  };

  const stats = [
    { label: 'Total Venues', value: venues.length },
    { label: 'Available', value: venues.filter((v) => v.isAvailable && !v.isBlocked).length },
    { label: 'Blocked', value: venues.filter((v) => v.isBlocked).length },
    { label: 'Total Capacity', value: venues.reduce((s, v) => s + (v.capacity || 0), 0).toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Venue Management" subtitle="Manage festival locations, capacity, and bookings" breadcrumb="Master Data" stats={stats} actions={<button type="button" onClick={() => openEdit()} className="btn-primary">+ Add Venue</button>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      {loading ? <Loading /> : venues.length ? (
        <DataTable
          searchKeys={['name', 'location']}
          data={venues}
          columns={[
            { key: 'name', label: 'Venue', sortable: true },
            { key: 'location', label: 'Location' },
            { key: 'capacity', label: 'Capacity', sortable: true },
            { key: 'facilities', label: 'Facilities', render: (v) => (v.facilities || []).slice(0, 2).join(', ') || '—' },
            { key: 'status', label: 'Status', render: (v) => <Badge type={v.isBlocked ? 'cancelled' : v.isAvailable ? 'approved' : 'pending'}>{v.isBlocked ? 'Blocked' : v.isAvailable ? 'Available' : 'Unavailable'}</Badge> },
          ]}
          actions={(row) => (
            <>
              <button type="button" onClick={() => viewBookings(row)} className="text-cyan-400 text-xs">Bookings</button>
              <button type="button" onClick={() => { setBlockModal(row); setBlockReason(row.blockReason || ''); }} className="text-amber-400 text-xs">{row.isBlocked ? 'Unblock' : 'Block'}</button>
              <button type="button" onClick={() => openEdit(row)} className="text-brand-400 text-xs">Edit</button>
              <button type="button" onClick={() => handleDelete(row)} className="text-red-400 text-xs">Delete</button>
            </>
          )}
        />
      ) : (
        <EmptyState icon="🏛️" title="No venues configured" action={<button type="button" onClick={() => openEdit()} className="btn-primary">+ Add Venue</button>} />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Venue' : 'Create Venue'} size="lg">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm text-slate-400">Name *</label><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Location *</label><input className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Capacity *</label><input type="number" min="1" className="input-field" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-slate-400">Facilities (comma separated)</label><input className="input-field" value={form.facilities} onChange={(e) => setForm({ ...form, facilities: e.target.value })} placeholder="Sound system, AC, Stage" /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-slate-400">Description</label><textarea className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="sm:col-span-2 flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Save Venue</button></div>
        </form>
      </Modal>

      <Modal open={!!bookingsModal} onClose={() => setBookingsModal(null)} title={`Bookings — ${bookingsModal?.name}`} size="lg">
        {bookings && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Capacity: {bookings.venue?.capacity} · {bookings.bookings?.length || 0} events scheduled</p>
            {bookings.bookings?.length ? bookings.bookings.map((ev) => (
              <div key={ev._id} className="rounded-lg bg-slate-800/40 p-3 text-sm">
                <p className="font-medium text-white">{ev.title}</p>
                <p className="text-slate-500">{new Date(ev.date).toLocaleDateString()} · {ev.startTime}–{ev.endTime}</p>
              </div>
            )) : <p className="text-slate-500">No bookings for this venue</p>}
          </div>
        )}
      </Modal>

      <Modal open={!!blockModal} onClose={() => setBlockModal(null)} title={blockModal?.isBlocked ? 'Unblock Venue' : 'Block Venue for Maintenance'}>
        {!blockModal?.isBlocked && (
          <textarea className="input-field mb-4 min-h-[80px]" placeholder="Reason for blocking..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setBlockModal(null)} className="btn-secondary">Cancel</button>
          <button type="button" onClick={toggleBlock} className="btn-primary">{blockModal?.isBlocked ? 'Unblock' : 'Block Venue'}</button>
        </div>
      </Modal>
    </div>
  );
}
