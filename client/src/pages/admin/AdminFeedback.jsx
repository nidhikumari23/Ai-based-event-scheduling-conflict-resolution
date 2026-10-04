import { useEffect, useState } from 'react';
import { feedbackAPI } from '../../api/api';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/admin/PageHeader';
import DataTable from '../../components/admin/DataTable';
import Alert from '../../components/admin/Alert';
import Modal from '../../components/Modal';

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState([]);
  const [popular, setPopular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [replyModal, setReplyModal] = useState(null);
  const [reply, setReply] = useState('');
  const [msg, setMsg] = useState({ type: 'info', text: '' });

  const load = async () => {
    setLoading(true);
    const [fb, pop] = await Promise.all([feedbackAPI.list(), feedbackAPI.popular()]);
    setFeedback(fb.data);
    setPopular(pop.data);
    setLoading(false);
  };

  useEffect(load, []);

  const filtered = filter === 'unreplied' ? feedback.filter((f) => !f.adminReply) : filter === 'replied' ? feedback.filter((f) => f.adminReply) : feedback;

  const submitReply = async (e) => {
    e.preventDefault();
    await feedbackAPI.reply(replyModal._id, reply);
    setReplyModal(null);
    setReply('');
    setMsg({ type: 'success', text: 'Reply posted.' });
    load();
  };

  const avgRating = feedback.length ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1) : '—';

  return (
    <div className="space-y-6">
      <PageHeader title="Feedback Management" subtitle="Review ratings and respond to participant feedback" breadcrumb="Communication"
        stats={[
          { label: 'Total Reviews', value: feedback.length },
          { label: 'Avg Rating', value: avgRating },
          { label: 'Unreplied', value: feedback.filter((f) => !f.adminReply).length },
          { label: 'Popular Events', value: popular.length },
        ]} />

      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      {popular.length > 0 && (
        <div className="card">
          <h3 className="mb-4 font-semibold text-white">Top Rated Events</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {popular.slice(0, 4).map((p) => (
              <div key={p._id} className="rounded-lg bg-slate-800/40 p-3">
                <p className="font-medium text-white">{p._id?.title || 'Event'}</p>
                <p className="text-amber-400">★ {p.avgRating?.toFixed(1)} ({p.count} reviews)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'unreplied', 'replied'].map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-sm capitalize ${filter === f ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{f}</button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <DataTable
          data={filtered}
          columns={[
            { key: 'user', label: 'User', render: (f) => (<div><p className="text-white">{f.user?.name}</p><p className="text-xs text-slate-500">{f.user?.email}</p></div>) },
            { key: 'event', label: 'Event', render: (f) => f.event?.title },
            { key: 'rating', label: 'Rating', render: (f) => (<span className="text-amber-400">{'★'.repeat(f.rating)}</span>) },
            { key: 'comment', label: 'Comment', render: (f) => <span className="line-clamp-2">{f.comment || '—'}</span> },
            { key: 'adminReply', label: 'Replied', render: (f) => <Badge type={f.adminReply ? 'approved' : 'pending'}>{f.adminReply ? 'Yes' : 'No'}</Badge> },
            { key: 'createdAt', label: 'Date', render: (f) => formatDate(f.createdAt) },
          ]}
          actions={(f) => (
            <>
              <button type="button" onClick={() => { setReplyModal(f); setReply(f.adminReply || ''); }} className="text-brand-400 text-xs">{f.adminReply ? 'Edit Reply' : 'Reply'}</button>
              <button type="button" onClick={() => { if (confirm('Delete feedback?')) feedbackAPI.remove(f._id).then(load); }} className="text-red-400 text-xs">Delete</button>
            </>
          )}
        />
      )}

      <Modal open={!!replyModal} onClose={() => setReplyModal(null)} title={`Reply to ${replyModal?.user?.name}`}>
        <p className="mb-3 text-sm text-slate-400">"{replyModal?.comment}"</p>
        <form onSubmit={submitReply}>
          <textarea className="input-field min-h-[100px]" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write your response..." required />
          <div className="mt-4 flex justify-end gap-3"><button type="button" onClick={() => setReplyModal(null)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Post Reply</button></div>
        </form>
      </Modal>
    </div>
  );
}
