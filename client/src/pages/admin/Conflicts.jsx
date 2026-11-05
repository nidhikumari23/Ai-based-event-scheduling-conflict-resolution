import { useEffect, useState } from 'react';
import { conflictAPI, eventAPI } from '../../api/api';
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
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    const params = filter !== 'all' ? { status: filter } : {};
    try {
      const [c, s] = await Promise.all([conflictAPI.list(params), conflictAPI.summary()]);
      setConflicts(Array.isArray(c.data) ? c.data : []);
      setSummary(s.data || {});
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Unable to load conflicts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const detect = async () => {
    setActionLoading(true);
    try {
      const { data } = await conflictAPI.detect();
      setMsg({ type: 'success', text: `Detected ${data.count} active conflicts.` });
      await load();
    } catch (error) {
      setMsg({ type: 'error', text: error.response?.data?.message || 'Conflict detection failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const resolve = async (action) => {
    setActionLoading(true);
    try {
      await conflictAPI.resolve(resolveModal._id, { action, resolution: resolution || resolveModal.aiSuggestion });
      setResolveModal(null);
      setResolution('');
      setMsg({ type: 'success', text: action === 'ignore' ? 'Conflict ignored.' : 'Conflict revalidated and resolved.' });
      await load();
    } catch (error) {
      setMsg({ type: 'error', text: error.response?.data?.message || 'Unable to update conflict.' });
    } finally {
      setActionLoading(false);
    }
  };

  const getAI = async (id) => {
    setActionLoading(true);
    try {
      const { data } = await conflictAPI.aiSuggestion(id);
      setAiResult({ ...data, conflictId: id });
    } catch (error) {
      setMsg({ type: 'error', text: error.response?.data?.message || 'Unable to generate feasible alternatives.' });
    } finally {
      setActionLoading(false);
    }
  };

  const approveSuggestion = async (suggestion) => {
    setActionLoading(true);
    try {
      const payload = {
        ...suggestion.eventPayload,
        resolutionConflictId: aiResult.conflictId,
      };
      if (suggestion.isNewEvent) {
        await eventAPI.create(payload);
      } else {
        await eventAPI.update(suggestion.eventId, payload);
      }
      setAiResult(null);
      let scanError;
      try {
        await conflictAPI.detect();
      } catch (error) {
        scanError = error;
      }
      setMsg(scanError
        ? {
            type: 'error',
            text: `Alternative saved after backend schedule revalidation, but conflict status could not be refreshed: ${scanError.response?.data?.message || scanError.message}`,
          }
        : { type: 'success', text: 'Selected alternative saved, revalidated, and conflict status refreshed.' });
      await load();
    } catch (error) {
      setMsg({ type: 'error', text: error.response?.data?.message || error.message || 'Unable to approve this alternative.' });
    } finally {
      setActionLoading(false);
    }
  };

  const stats = summary ? Object.entries(summary).map(([k, v]) => ({ label: k, value: v })) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Conflict Resolution" subtitle="Detect and resolve scheduling conflicts" breadcrumb="AI & Scheduling" stats={stats} actions={<button type="button" onClick={detect} disabled={actionLoading} className="btn-primary">Detect Conflicts</button>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />
      {loadError && <div role="alert" className="card border border-red-500/30 text-sm text-red-300">{loadError}<button type="button" onClick={load} className="ml-3 underline">Retry</button></div>}

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
                  {c.events?.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                      {c.events.map((event) => (
                        <li key={event._id || event}>
                          {event.title || event}
                          {event.startTime && ` · ${event.startTime}–${event.endTime}`}
                          {event.date && ` · ${new Date(event.date).toLocaleDateString()}`}
                          {event.venue?.name && ` · ${event.venue.name}`}
                        </li>
                      ))}
                    </ul>
                  )}
                  {c.proposedEvent && (
                    <p className="mt-2 text-xs text-amber-300">
                      {c.proposedEvent.isNewEvent ? 'Rejected event proposal' : 'Rejected schedule update'}:{' '}
                      {c.proposedEvent.title} · {c.proposedEvent.startTime}–{c.proposedEvent.endTime}
                      {c.proposedEvent.date && ` · ${new Date(c.proposedEvent.date).toLocaleDateString()}`}
                      {c.proposedEvent.venue?.name && ` · ${c.proposedEvent.venue.name}`}
                    </p>
                  )}
                  {c.aiSuggestion && <p className="mt-3 rounded-lg bg-brand-500/10 p-3 text-sm text-brand-300">AI: {c.aiSuggestion}</p>}
                  {c.resolution && c.status !== 'open' && <p className="mt-2 text-sm text-emerald-400">Resolution: {c.resolution}</p>}
                </div>
                {c.status === 'open' && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={actionLoading} onClick={() => getAI(c._id)} className="btn-secondary text-xs">Find feasible alternatives</button>
                    <button type="button" disabled={actionLoading} onClick={() => { setResolveModal(c); setResolution(''); }} className="btn-primary text-xs">Resolve</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!conflicts.length && (
            <p className="py-12 text-center text-sm text-slate-500">
              {filter === 'open'
                ? 'No unresolved conflicts are recorded. Failed scheduled-event validation is saved as a proposal conflict; Detect Conflicts also scans saved scheduled and published events.'
                : filter === 'resolved'
                  ? 'No resolved conflicts are recorded yet.'
                  : `No conflicts are recorded for the ${filter} filter.`}
            </p>
          )}
        </div>
      )}

      {aiResult && (
        <div className="card border-brand-500/30">
          <h3 className="font-semibold text-white">Validated Resolution Suggestions</h3>
          {aiResult.conflict && (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-sm font-medium capitalize text-amber-200">{aiResult.conflict.type} conflict</p>
              <p className="mt-1 text-sm text-slate-300">{aiResult.conflict.reason}</p>
            </div>
          )}
          <p className="mt-2 text-slate-300">{aiResult.suggestion}</p>
          {aiResult.explanation && <p className="mt-2 text-sm text-slate-400">{aiResult.explanation}</p>}
          <ul className="mt-3 list-inside list-disc text-sm text-slate-400">{aiResult.steps?.map((s, i) => <li key={i}>{s}</li>)}</ul>
          <div className="mt-4 space-y-3">
            {aiResult.suggestions?.map((suggestion, index) => (
              <div key={`${suggestion.eventId}-${suggestion.proposed.date}-${suggestion.proposed.startTime}-${suggestion.proposed.venue}`} className="rounded-lg border border-slate-700 p-4">
                <p className="font-medium text-white">Option {index + 1}: {suggestion.title}</p>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded bg-slate-800/50 p-3">
                    <p className="mb-1 text-xs uppercase text-slate-500">Original schedule</p>
                    <p className="text-slate-300">{suggestion.original.date ? new Date(suggestion.original.date).toLocaleDateString() : 'Unscheduled'} · {suggestion.original.startTime}–{suggestion.original.endTime}</p>
                    <p className="text-slate-400">{suggestion.original.venueName}</p>
                  </div>
                  <div className="rounded bg-emerald-500/5 p-3">
                    <p className="mb-1 text-xs uppercase text-emerald-400">Proposed · score {suggestion.proposed.score}</p>
                    <p className="text-slate-300">{suggestion.proposed.date} · {suggestion.proposed.startTime}–{suggestion.proposed.endTime}</p>
                    <p className="text-slate-400">{suggestion.proposed.venueName}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-400">{suggestion.reason}</p>
                <p className="mt-1 text-xs text-slate-500">{suggestion.impact}</p>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded bg-slate-800/50 p-3 text-slate-300">
                    <p className="font-medium text-white">Availability checked</p>
                    <p className="mt-1">
                      Venue: {suggestion.availability?.venue?.available ? 'Available' : 'Unavailable'} · Capacity{' '}
                      {suggestion.availability?.venue?.capacity}/{suggestion.availability?.venue?.requiredCapacity}
                    </p>
                    <p>
                      Facilities: {suggestion.availability?.venue?.facilitiesAvailable ? 'All required facilities available' : 'Requirements not met'}
                    </p>
                    <p className="mt-1">
                      Reserved with buffers: {suggestion.availability?.time?.reservedFrom
                        ? new Date(suggestion.availability.time.reservedFrom).toLocaleString()
                        : 'Not specified'}{' '}
                      – {suggestion.availability?.time?.reservedUntil
                        ? new Date(suggestion.availability.time.reservedUntil).toLocaleString()
                        : 'Not specified'}
                    </p>
                  </div>
                  <div className="rounded bg-slate-800/50 p-3 text-slate-300">
                    <p className="font-medium text-white">Assigned staff & resources</p>
                    <p className="mt-1">
                      Staff: {suggestion.availability?.staff?.length
                        ? suggestion.availability.staff.map((member) => `${member.name} (${member.role})`).join(', ')
                        : 'No staff required'}
                    </p>
                    <p>
                      Resources: {suggestion.availability?.resources?.length
                        ? suggestion.availability.resources.map((resource) =>
                            `${resource.name} × ${resource.quantity} (${resource.availableQuantity} available)`
                          ).join(', ')
                        : 'No resources required'}
                    </p>
                  </div>
                </div>
                <button type="button" disabled={actionLoading || !suggestion.feasible} onClick={() => approveSuggestion(suggestion)} className="btn-primary mt-3 text-xs">
                  {actionLoading ? 'Revalidating…' : 'Apply solution & revalidate'}
                </button>
              </div>
            ))}
            {!aiResult.suggestions?.length && <p className="text-sm text-amber-300">No feasible alternative was found. Adjust availability or the search window and try again.</p>}
          </div>
          <button type="button" onClick={() => setAiResult(null)} className="mt-4 text-sm text-slate-500">Dismiss</button>
        </div>
      )}

      <Modal open={!!resolveModal} onClose={() => setResolveModal(null)} title="Resolve Conflict">
        <textarea className="input-field mb-4 min-h-[80px]" placeholder="Resolution notes..." value={resolution} onChange={(e) => setResolution(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={actionLoading} onClick={() => resolve('resolve')} className="btn-secondary text-sm">Revalidate & mark resolved</button>
          <button type="button" disabled={actionLoading} onClick={() => resolve('ignore')} className="text-sm text-slate-400">Ignore</button>
        </div>
      </Modal>
    </div>
  );
}
