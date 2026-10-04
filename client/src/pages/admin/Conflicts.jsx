import { useEffect, useState } from 'react';
import { conflictAPI } from '../../api/api';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/admin/PageHeader';
import Alert from '../../components/admin/Alert';
import Modal from '../../components/Modal';

export default function Conflicts() {
  const [conflicts, setConflicts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [resolveModal, setResolveModal] = useState(null);
  const [resolution, setResolution] = useState('');
  const [aiResult, setAiResult] = useState(null);

  const load = async () => {
    setLoading(true);
    const params = filter !== 'all' ? { status: filter } : {};
    const [c, s] = await Promise.all([conflictAPI.list(params), conflictAPI.summary()]);
    setConflicts(c.data);
    setSummary(s.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const detect = async () => {
    const { data } = await conflictAPI.detect();
    setMsg({ type: 'success', text: `Detected ${data.count} conflicts.` });
    load();
  };

  const resolve = async (action) => {
    await conflictAPI.resolve(resolveModal._id, { action, resolution: resolution || resolveModal.aiSuggestion });
    setResolveModal(null);
    setResolution('');
    setMsg({ type: 'success', text: 'Conflict updated.' });
    load();
  };

  const getAI = async (id) => {
    const { data } = await conflictAPI.aiSuggestion(id);
    setAiResult(data);
  };

  const stats = summary ? Object.entries(summary).map(([k, v]) => ({ label: k, value: v })) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Conflict Resolution" subtitle="Detect and resolve scheduling conflicts" breadcrumb="AI & Scheduling" stats={stats} actions={<button type="button" onClick={detect} className="btn-primary">Detect Conflicts</button>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="flex gap-2">
        {['open', 'resolved', 'ignored', 'accepted', 'all'].map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-sm capitalize ${filter === f ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{f}</button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <div className="space-y-4">
          {conflicts.map((c) => (
            <div key={c._id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge type={c.type}>{c.type}</Badge>
                    <Badge type={c.severity}>{c.severity}</Badge>
                    <Badge type={c.status}>{c.status}</Badge>
                  </div>
                  <p className="mt-3 text-slate-200">{c.description}</p>
                  {c.events?.length > 0 && <p className="mt-2 text-xs text-slate-500">Events: {c.events.map((e) => e.title || e).join(', ')}</p>}
                  {c.aiSuggestion && <p className="mt-3 rounded-lg bg-brand-500/10 p-3 text-sm text-brand-300">AI: {c.aiSuggestion}</p>}
                  {c.resolution && c.status !== 'open' && <p className="mt-2 text-sm text-emerald-400">Resolution: {c.resolution}</p>}
                </div>
                {c.status === 'open' && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => getAI(c._id)} className="btn-secondary text-xs">AI Suggest</button>
                    <button type="button" onClick={() => { setResolveModal(c); setResolution(''); }} className="btn-primary text-xs">Resolve</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!conflicts.length && <p className="py-12 text-center text-slate-500">No conflicts in this category</p>}
        </div>
      )}

      {aiResult && (
        <div className="card border-brand-500/30">
          <h3 className="font-semibold text-white">AI Resolution Suggestion</h3>
          <p className="mt-2 text-slate-300">{aiResult.suggestion}</p>
          <ul className="mt-3 list-inside list-disc text-sm text-slate-400">{aiResult.steps?.map((s, i) => <li key={i}>{s}</li>)}</ul>
          <button type="button" onClick={() => setAiResult(null)} className="mt-4 text-sm text-slate-500">Dismiss</button>
        </div>
      )}

      <Modal open={!!resolveModal} onClose={() => setResolveModal(null)} title="Resolve Conflict">
        <textarea className="input-field mb-4 min-h-[80px]" placeholder="Resolution notes..." value={resolution} onChange={(e) => setResolution(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => resolve('accept')} className="btn-primary text-sm">Accept AI Fix</button>
          <button type="button" onClick={() => resolve('resolve')} className="btn-secondary text-sm">Mark Resolved</button>
          <button type="button" onClick={() => resolve('ignore')} className="text-sm text-slate-400">Ignore</button>
        </div>
      </Modal>
    </div>
  );
}
