import { useEffect, useState } from 'react';
import { resourceAPI } from '../../api/api';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';
import PageHeader from '../../components/admin/PageHeader';
import DataTable from '../../components/admin/DataTable';
import Alert from '../../components/admin/Alert';

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [overbooked, setOverbooked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'Equipment', quantity: 10, available: 10, description: '', costPerUnit: 0 });
  const [msg, setMsg] = useState({ type: 'info', text: '' });

  const load = async () => {
    setLoading(true);
    const [res, ob] = await Promise.all([resourceAPI.list(), resourceAPI.overbooking()]);
    setResources(res.data);
    setOverbooked(ob.data.overbooked || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (item = null) => {
    setEditItem(item);
    setForm(item ? { ...item, costPerUnit: item.costPerUnit || 0 } : { name: '', type: 'Equipment', quantity: 10, available: 10, description: '', costPerUnit: 0 });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, quantity: Number(form.quantity), available: Number(form.available), costPerUnit: Number(form.costPerUnit) };
    if (editItem) await resourceAPI.update(editItem._id, payload);
    else await resourceAPI.create(payload);
    setModal(false);
    setMsg({ type: 'success', text: 'Resource saved.' });
    load();
  };

  const stats = [
    { label: 'Total Resources', value: resources.length },
    { label: 'Available Types', value: new Set(resources.map((r) => r.type)).size },
    { label: 'Overbooked', value: overbooked.length },
    { label: 'Unavailable', value: resources.filter((r) => !r.isAvailable).length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Resource Management" subtitle="Track equipment, personnel, and inventory" breadcrumb="Master Data" stats={stats} actions={<button type="button" onClick={() => openEdit()} className="btn-primary">+ Add Resource</button>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      {overbooked.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <h3 className="font-semibold text-red-300">⚠ Overbooking Detected</h3>
          <p className="mt-1 text-sm text-red-200/80">{overbooked.map((r) => r.name).join(', ')}</p>
        </div>
      )}

      {loading ? <Loading /> : (
        <DataTable
          searchKeys={['name', 'type']}
          data={resources}
          columns={[
            { key: 'name', label: 'Resource', sortable: true },
            { key: 'type', label: 'Type' },
            { key: 'quantity', label: 'Total', sortable: true },
            { key: 'available', label: 'Available', sortable: true },
            { key: 'usage', label: 'Utilization', render: (r) => {
              const used = r.quantity - r.available;
              const pct = r.quantity ? Math.round((used / r.quantity) * 100) : 0;
              return (
                <div className="min-w-[100px]">
                  <div className="mb-1 flex justify-between text-xs"><span>{pct}%</span><span>{used}/{r.quantity}</span></div>
                  <div className="h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            }},
            { key: 'isAvailable', label: 'Status', render: (r) => <Badge type={r.isAvailable ? 'approved' : 'cancelled'}>{r.isAvailable ? 'Available' : 'Unavailable'}</Badge> },
          ]}
          actions={(row) => (
            <>
              <button type="button" onClick={() => resourceAPI.toggle(row._id).then(load)} className="text-amber-400 text-xs">Toggle</button>
              <button type="button" onClick={() => openEdit(row)} className="text-brand-400 text-xs">Edit</button>
              <button type="button" onClick={() => { if (confirm('Delete?')) resourceAPI.remove(row._id).then(load); }} className="text-red-400 text-xs">Delete</button>
            </>
          )}
        />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Resource' : 'Create Resource'} size="lg">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm text-slate-400">Name *</label><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Type *</label><input className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Total Quantity</label><input type="number" min="0" className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Available</label><input type="number" min="0" className="input-field" value={form.available} onChange={(e) => setForm({ ...form, available: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Cost Per Unit</label><input type="number" min="0" className="input-field" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-slate-400">Description</label><textarea className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="sm:col-span-2 flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
