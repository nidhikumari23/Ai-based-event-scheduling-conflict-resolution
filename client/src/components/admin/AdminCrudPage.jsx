import { useEffect, useState } from 'react';
import Modal from '../Modal';
import Loading from '../Loading';
import PageHeader from './PageHeader';
import DataTable from './DataTable';
import Alert from './Alert';
import EmptyState from './EmptyState';

export default function AdminCrudPage({
  title,
  subtitle,
  breadcrumb,
  api,
  fields,
  columns,
  initialForm = {},
  searchKeys = [],
  statsFn,
  detailFields,
  modalSize = 'md',
  onBeforeSave,
  extraActions,
  listAll = true,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const listCall = typeof api.list === 'function' ? api.list(listAll) : api.list();
    listCall.then(({ data }) => setItems(data)).catch(() => setMsg({ type: 'error', text: 'Failed to load data' })).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditItem(null);
    setForm(initialForm);
    setModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    const f = {};
    fields.forEach((field) => {
      if (field.getValue) f[field.name] = field.getValue(item);
      else if (Array.isArray(item[field.name])) f[field.name] = item[field.name].join(', ');
      else f[field.name] = item[field.name] ?? field.default ?? '';
    });
    setForm(f);
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let payload = { ...form };
      fields.forEach((f) => {
        if (f.type === 'number') payload[f.name] = Number(payload[f.name]);
        if (f.type === 'checkbox') payload[f.name] = Boolean(payload[f.name]);
        if (f.transform) payload[f.name] = f.transform(payload[f.name]);
      });
      if (onBeforeSave) payload = onBeforeSave(payload, editItem);
      if (editItem) await api.update(editItem._id, payload);
      else await api.create(payload);
      setModal(false);
      setMsg({ type: 'success', text: editItem ? 'Record updated successfully.' : 'Record created successfully.' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.name || item.title || 'this record'}"?`)) return;
    try {
      await api.remove(item._id);
      setMsg({ type: 'success', text: 'Record deleted.' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Delete failed' });
    }
  };

  const handleToggle = async (id) => {
    if (!api.toggle) return;
    try {
      await api.toggle(id);
      setMsg({ type: 'success', text: 'Status updated.' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Toggle failed' });
    }
  };

  const stats = statsFn ? statsFn(items) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumb={breadcrumb}
        stats={stats}
        actions={<button type="button" onClick={openCreate} className="btn-primary">+ Add New</button>}
      />

      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      {loading ? <Loading /> : items.length ? (
        <DataTable
          columns={columns}
          data={items}
          searchKeys={searchKeys}
          onRowClick={detailFields ? setDetailItem : undefined}
          actions={(row) => (
            <>
              {detailFields && (
                <button type="button" onClick={() => setDetailItem(row)} className="text-slate-400 hover:text-white text-xs">View</button>
              )}
              <button type="button" onClick={() => openEdit(row)} className="text-brand-400 hover:text-brand-300 text-xs">Edit</button>
              {api.toggle && (
                <button type="button" onClick={() => handleToggle(row._id)} className="text-amber-400 hover:text-amber-300 text-xs">Toggle</button>
              )}
              {extraActions?.(row, load, setMsg)}
              <button type="button" onClick={() => handleDelete(row)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
            </>
          )}
        />
      ) : (
        <EmptyState icon="📂" title={`No ${title.toLowerCase()} yet`} description="Create your first record to get started." action={<button type="button" onClick={openCreate} className="btn-primary">+ Add New</button>} />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? `Edit ${title.slice(0, -1) || title}` : `Create ${title.slice(0, -1) || title}`} size={modalSize}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={modalSize === 'lg' ? 'grid gap-4 sm:grid-cols-2' : 'space-y-4'}>
            {fields.map((field) => (
              <div key={field.name} className={field.fullWidth ? 'sm:col-span-2' : ''}>
                <label className="mb-1.5 block text-sm text-slate-400">{field.label}{field.required && ' *'}</label>
                {field.type === 'select' ? (
                  <select className="input-field" value={form[field.name]} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} required={field.required}>
                    {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea className="input-field min-h-[80px]" value={form[field.name]} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} required={field.required} />
                ) : field.type === 'color' ? (
                  <div className="flex gap-2">
                    <input type="color" className="h-10 w-14 cursor-pointer rounded border border-slate-700 bg-transparent" value={form[field.name]} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} />
                    <input className="input-field flex-1" value={form[field.name]} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} />
                  </div>
                ) : field.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={Boolean(form[field.name])} onChange={(e) => setForm({ ...form, [field.name]: e.target.checked })} />
                    {field.checkboxLabel || field.label}
                  </label>
                ) : (
                  <input type={field.type || 'text'} className="input-field" value={form[field.name]} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} required={field.required} min={field.min} max={field.max} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title="Record Details" size="md">
        {detailItem && (
          <dl className="space-y-3">
            {detailFields(detailItem).map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4 border-b border-slate-800 pb-2 text-sm">
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-right text-white">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
    </div>
  );
}
