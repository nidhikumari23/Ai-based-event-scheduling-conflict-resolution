import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { feedbackAPI } from '../../api/api';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/user/PageHeader';
import EmptyState from '../../components/user/EmptyState';
import Alert from '../../components/user/Alert';
import Modal from '../../components/Modal';

export default function MyFeedback() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ rating: 5, comment: '' });

  const load = () => {
    setLoading(true);
    feedbackAPI.my().then(({ data }) => setFeedback(data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ rating: item.rating, comment: item.comment });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    await feedbackAPI.update(editItem._id, form);
    setEditItem(null);
    setMsg({ type: 'success', text: 'Feedback updated successfully.' });
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this feedback?')) return;
    await feedbackAPI.remove(id);
    setMsg({ type: 'success', text: 'Feedback deleted.' });
    load();
  };

  const avgRating = feedback.length
    ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Feedback & Reviews"
        subtitle="Manage your event ratings and comments"
        breadcrumb="Reviews"
        actions={<Link to="/user/events" className="btn-primary">Review More Events</Link>}
      />

      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-center">
          <p className="text-3xl font-bold text-white">{feedback.length}</p>
          <p className="text-sm text-slate-500">Total Reviews</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center">
          <p className="text-3xl font-bold text-amber-400">{avgRating}</p>
          <p className="text-sm text-slate-500">Average Rating Given</p>
        </div>
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-5 text-center">
          <p className="text-3xl font-bold text-brand-300">{feedback.filter((f) => f.adminReply).length}</p>
          <p className="text-sm text-slate-500">Admin Replies</p>
        </div>
      </div>

      {loading ? <Loading /> : feedback.length ? (
        <div className="space-y-4">
          {feedback.map((f) => (
            <div key={f._id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1">
                  <Link to={`/user/events/${f.event?._id}`} className="text-lg font-semibold text-white hover:text-brand-300">
                    {f.event?.title}
                  </Link>
                  <p className="text-xs text-slate-500">{formatDate(f.event?.date)} · Reviewed {formatDate(f.createdAt)}</p>
                  <div className="mt-3 flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={`text-lg ${i < f.rating ? 'text-amber-400' : 'text-slate-600'}`}>★</span>
                    ))}
                  </div>
                  {f.comment && <p className="mt-3 text-sm leading-relaxed text-slate-400">{f.comment}</p>}
                  {f.adminReply && (
                    <div className="mt-4 rounded-lg border border-brand-500/20 bg-brand-500/10 p-4">
                      <p className="text-xs font-medium uppercase text-brand-400">Admin Response</p>
                      <p className="mt-1 text-sm text-slate-300">{f.adminReply}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(f)} className="btn-secondary text-xs">Edit</button>
                  <button onClick={() => handleDelete(f._id)} className="btn-danger text-xs">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="💬"
          title="No reviews yet"
          description="Attend events and share your experience by leaving feedback."
          action={<Link to="/user/events" className="btn-primary">Browse Events</Link>}
        />
      )}

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Review">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-400">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })} className={`text-2xl ${n <= form.rating ? 'text-amber-400' : 'text-slate-600'}`}>★</button>
              ))}
            </div>
          </div>
          <textarea className="input-field min-h-[100px]" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditItem(null)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
