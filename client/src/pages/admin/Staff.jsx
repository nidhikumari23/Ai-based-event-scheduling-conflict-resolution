import { useEffect, useState } from 'react';
import { staffAPI, eventAPI } from '../../api/api';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';
import PageHeader from '../../components/admin/PageHeader';
import DataTable from '../../components/admin/DataTable';
import Alert from '../../components/admin/Alert';

const roleOptions = [
  { value: 'manager', label: 'Manager' }, { value: 'coordinator', label: 'Coordinator' },
  { value: 'technician', label: 'Technician' }, { value: 'security', label: 'Security' },
  { value: 'volunteer', label: 'Volunteer' }, { value: 'host', label: 'Host' },
];

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [assignEventId, setAssignEventId] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'volunteer', availabilityNotes: '' });
  const [msg, setMsg] = useState({ type: 'info', text: '' });

  const load = async () => {
    setLoading(true);
    const [st, ev] = await Promise.all([staffAPI.list(), eventAPI.list({})]);
    setStaff(st.data);
    setEvents(ev.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (item = null) => {
    setEditItem(item);
    setForm(item || { name: '', email: '', phone: '', role: 'volunteer', availabilityNotes: '' });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editItem) await staffAPI.update(editItem._id, form);
    else await staffAPI.create(form);
    setModal(false);
    setMsg({ type: 'success', text: 'Staff member saved.' });
    load();
  };

  const assignEvent = async () => {
    await staffAPI.assign(assignModal._id, assignEventId);
    setAssignModal(null);
    setAssignEventId('');
    setMsg({ type: 'success', text: 'Staff assigned to event.' });
    load();
  };

  const stats = [
    { label: 'Total Staff', value: staff.length },
    { label: 'Available', value: staff.filter((s) => s.isAvailable).length },
    { label: 'Technicians', value: staff.filter((s) => s.role === 'technician').length },
    { label: 'Security', value: staff.filter((s) => s.role === 'security').length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Staff Management" subtitle="Manage organizers, technicians, and volunteers" breadcrumb="Master Data" stats={stats} actions={<button type="button" onClick={() => openEdit()} className="btn-primary">+ Add Staff</button>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      {loading ? <Loading /> : (
        <DataTable
          searchKeys={['name', 'email', 'role']}
          data={staff}
          columns={[
            { key: 'name', label: 'Name', sortable: true },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'role', label: 'Role', render: (s) => <Badge>{s.role}</Badge> },
            { key: 'assignedEvents', label: 'Events', render: (s) => s.assignedEvents?.length || 0 },
            { key: 'isAvailable', label: 'Available', render: (s) => <Badge type={s.isAvailable ? 'approved' : 'cancelled'}>{s.isAvailable ? 'Yes' : 'No'}</Badge> },
          ]}
          actions={(row) => (
            <>
              <button type="button" onClick={() => { setAssignModal(row); setAssignEventId(''); }} className="text-cyan-400 text-xs">Assign</button>
              <button type="button" onClick={() => staffAPI.toggle(row._id).then(load)} className="text-amber-400 text-xs">Toggle</button>
              <button type="button" onClick={() => openEdit(row)} className="text-brand-400 text-xs">Edit</button>
              <button type="button" onClick={() => { if (confirm('Delete?')) staffAPI.remove(row._id).then(load); }} className="text-red-400 text-xs">Delete</button>
            </>
          )}
        />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Staff' : 'Add Staff Member'} size="lg">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm text-slate-400">Name *</label><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Email *</label><input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Phone</label><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Role</label><select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-slate-400">Availability Notes</label><textarea className="input-field" value={form.availabilityNotes} onChange={(e) => setForm({ ...form, availabilityNotes: e.target.value })} /></div>
          <div className="sm:col-span-2 flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Save</button></div>
        </form>
      </Modal>

      <Modal open={!!assignModal} onClose={() => setAssignModal(null)} title={`Assign ${assignModal?.name} to Event`}>
        <select className="input-field" value={assignEventId} onChange={(e) => setAssignEventId(e.target.value)}>
          <option value="">Select event</option>
          {events.map((ev) => <option key={ev._id} value={ev._id}>{ev.title}</option>)}
        </select>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={() => setAssignModal(null)} className="btn-secondary">Cancel</button>
          <button type="button" onClick={assignEvent} disabled={!assignEventId} className="btn-primary">Assign</button>
        </div>
      </Modal>
    </div>
  );
}
