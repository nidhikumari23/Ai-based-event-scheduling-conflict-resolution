import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiAPI, conflictAPI, scheduleAPI } from '../../api/api';
import Loading from '../../components/Loading';
import PageHeader from '../../components/admin/PageHeader';
import Alert from '../../components/admin/Alert';

export default function AIScheduling() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [activeStep, setActiveStep] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [searchWindow, setSearchWindow] = useState({ startDate: '', endDate: '' });

  const run = async (fn, step, successMsg) => {
    setLoading(true);
    setActiveStep(step);
    try {
      const { data } = await fn();
      setResult((prev) => ({ ...prev, [step]: data }));
      setMsg({ type: 'success', text: successMsg });
    } catch (err) {
      const message = err.response?.data?.message ||
        (err.request ? 'Could not reach the scheduling API. Check the backend connection and Vite proxy.' : err.message) ||
        'Operation failed';
      setMsg({ type: 'error', text: message });
    } finally {
      setLoading(false);
      setActiveStep('');
    }
  };

  const loadAnalytics = async () => {
    try {
      const { data } = await conflictAPI.summary();
      setAnalytics(data);
    } catch (error) {
      setMsg({ type: 'error', text: error.response?.data?.message || 'Unable to load scheduling analytics.' });
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const generate = () => {
    const options = Object.fromEntries(Object.entries(searchWindow).filter(([, value]) => value));
    run(() => aiAPI.generateSchedule(options), 'generate', 'Feasible schedule proposal generated. Nothing has been saved yet.');
  };

  const approve = async () => {
    if (!result?.generate?.assignments?.length) return;
    setLoading(true);
    setActiveStep('approve');
    try {
      const proposal = result.generate;
      const payload = {
        assignments: proposal.assignments,
        eventVersions: proposal.eventVersions,
        scheduleRevision: proposal.scheduleRevision,
        summary: proposal.summary,
      };
      await scheduleAPI.validate(payload);
      await scheduleAPI.approve(payload);
      setMsg({ type: 'success', text: 'Schedule saved and revalidated without conflicts.' });
      setResult((previous) => ({ ...previous, generate: null }));
      await loadAnalytics();
    } catch (error) {
      setMsg({ type: 'error', text: error.response?.data?.message || 'Schedule validation or approval failed.' });
    } finally {
      setLoading(false);
      setActiveStep('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Smart Scheduling Center" subtitle="Generate and validate ranked schedules using real venue, staff, and resource constraints" breadcrumb="AI & Scheduling"
        actions={<Link to="/admin/schedule" className="btn-secondary">View Schedule</Link>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      {analytics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ['Scheduled events', analytics.scheduledEvents],
            ['Detected conflicts', analytics.total],
            ['Pending conflicts', analytics.pending],
            ['Resolved conflicts', analytics.resolved],
            ['Scheduling success', `${analytics.schedulingSuccessRate}%`],
            ['Venue conflicts', analytics.venue],
          ].map(([label, value]) => (
            <div key={label} className="card">
              <p className="text-2xl font-bold text-white">{value ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}
      {!analytics && <button type="button" onClick={loadAnalytics} className="btn-secondary text-sm">Load scheduling analytics</button>}

      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold text-white">Smart Schedule Generator</h2>
          <p className="mt-1 text-sm text-slate-500">The engine scores multiple feasible time/venue choices. Generating a proposal does not write event changes.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-slate-400">Search from
            <input type="date" className="input-field mt-1" value={searchWindow.startDate} onChange={(event) => setSearchWindow({ ...searchWindow, startDate: event.target.value })} />
          </label>
          <label className="text-xs text-slate-400">Search through
            <input type="date" className="input-field mt-1" value={searchWindow.endDate} onChange={(event) => setSearchWindow({ ...searchWindow, endDate: event.target.value })} />
          </label>
          <button type="button" disabled={loading} onClick={generate} className="btn-primary self-end">
            {activeStep === 'generate' ? 'Generating…' : 'Generate ranked proposal'}
          </button>
        </div>
        <p className="text-xs text-slate-500">Without a custom window, the engine uses festival settings or a seven-day search window. Maximum custom search window: 31 days.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { step: 'detect', label: 'Conflict Detection Center', desc: 'Scan scheduled events, buffers, staff, resources and capacity', fn: () => conflictAPI.detect(), msg: 'Conflict scan complete.' },
          { step: 'regenerate', label: 'Re-evaluate Schedule', desc: 'Generate a fresh proposal and current conflict report', fn: () => aiAPI.regenerate(searchWindow), msg: 'Schedule re-evaluated.' },
        ].map((action) => (
          <button key={action.step} type="button" disabled={loading} onClick={() => run(action.fn, action.step, action.msg)}
            className="card text-left transition hover:border-brand-500/30 disabled:opacity-50">
            <span className="text-2xl">{action.step === 'detect' ? '⚠️' : '🔄'}</span>
            <h3 className="mt-3 font-semibold text-white">{action.label}</h3>
            <p className="mt-1 text-sm text-slate-500">{action.desc}</p>
            {activeStep === action.step && <p className="mt-2 text-xs text-brand-400">Processing...</p>}
          </button>
        ))}
      </div>

      {loading && <Loading />}

      {result?.generate && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">Schedule Comparison</h3>
              <p className="mt-1 text-sm text-slate-400">{result.generate.summary}</p>
              <p className="mt-1 text-xs text-slate-500">
                {result.generate.aiEnabled ? 'AI provides explanation only; feasibility and ranking are deterministic.' : 'AI unavailable; deterministic scheduling and scoring are active.'}
                {' '}Window: {result.generate.searchWindow?.startDate} – {result.generate.searchWindow?.endDate}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/60 px-4 py-2 text-sm text-slate-300">
              {result.generate.assignments?.length || 0} assigned · {result.generate.unscheduled?.length || 0} unscheduled · score {result.generate.score ?? 0}/100
            </div>
          </div>
          {result.generate.assignments?.length > 0 && (
            <div className="space-y-3">
              {result.generate.assignments.map((assignment) => (
                <article key={assignment.eventId} className="rounded-xl border border-slate-800 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-medium text-white">{assignment.title}</h4>
                    <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs text-brand-300">Score {assignment.score}/100</span>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-800/40 p-3">
                      <p className="mb-1 text-xs uppercase text-slate-500">Original</p>
                      <p className="text-slate-300">{assignment.original?.date || 'No date'} · {assignment.original?.startTime || '—'}–{assignment.original?.endTime || '—'}</p>
                      <p className="text-slate-400">{assignment.original?.venueName || 'Unassigned venue'}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/5 p-3">
                      <p className="mb-1 text-xs uppercase text-emerald-400">Recommended</p>
                      <p className="text-slate-300">{assignment.date} · {assignment.startTime}–{assignment.endTime}</p>
                      <p className="text-slate-400">{assignment.venueName}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{assignment.reason}</p>
                  <p className="mt-2 text-xs text-slate-500">Score details: {Object.entries(assignment.scoreCriteria || {}).map(([criterion, points]) => `${criterion}: ${points}`).join(' · ')}</p>
                </article>
              ))}
            </div>
          )}
          {result.generate.unscheduled?.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 p-4">
              <h4 className="font-medium text-amber-300">Unscheduled events</h4>
              {result.generate.unscheduled.map((item) => <p key={item.eventId} className="mt-2 text-sm text-slate-400">{item.title}: {item.reason}</p>)}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={approve} disabled={loading || result.generate.unscheduled?.length > 0 || !result.generate.assignments?.length} className="btn-primary text-sm">
              {activeStep === 'approve' ? 'Validating and saving…' : 'Validate & approve schedule'}
            </button>
            <button type="button" onClick={() => { setResult((previous) => ({ ...previous, generate: null })); setMsg({ type: 'info', text: 'Proposal rejected. No schedule data was changed.' }); }} disabled={loading} className="btn-secondary text-sm">Reject proposal</button>
          </div>
          <div className="rounded-lg bg-slate-800/30 p-3 text-xs text-slate-500">
            Ranking: capacity fit (20), preferred time (25), minimal changes (30), staff continuity (15), resources (10). Feasibility constraints are hard filters; AI text cannot alter dates, resources, or venue availability.
          </div>
        </section>
      )}

      {result?.detect && (
        <div className="card">
          <h3 className="mb-2 font-semibold text-white">Conflict Detection Results</h3>
          <p className="text-2xl font-bold text-red-400">{result.detect.count} conflicts found</p>
          <Link to="/admin/conflicts" className="btn-secondary mt-4 inline-flex text-sm">Resolve Conflicts →</Link>
        </div>
      )}

      {result?.regenerate && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card"><h3 className="font-semibold text-white">Proposal Summary</h3><p className="mt-2 text-sm text-slate-400">{result.regenerate.schedule?.summary}</p><p className="mt-2 text-xs text-slate-500">This is a proposal; re-evaluation does not save schedule changes.</p></div>
          <div className="card"><h3 className="font-semibold text-white">Detected Conflicts</h3><p className="mt-2 text-2xl font-bold text-amber-400">{result.regenerate.conflicts?.length || 0}</p></div>
        </div>
      )}

      <div className="flex flex-wrap gap-2"><Link to="/admin/conflicts" className="btn-secondary">Open Conflict Center</Link><Link to="/admin/events" className="btn-secondary">Manage event requirements</Link></div>
    </div>
  );
}
