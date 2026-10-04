import { useState } from 'react';
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

  const run = async (fn, step, successMsg) => {
    setLoading(true);
    setActiveStep(step);
    try {
      const { data } = await fn();
      setResult((prev) => ({ ...prev, [step]: data }));
      setMsg({ type: 'success', text: successMsg });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    } finally {
      setLoading(false);
      setActiveStep('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="AI Scheduling Management" subtitle="Generate optimized schedules and detect conflicts using OpenAI" breadcrumb="AI & Scheduling"
        actions={<Link to="/admin/schedule" className="btn-secondary">View Schedule</Link>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { step: 'generate', label: 'Generate AI Schedule', desc: 'Analyze events, venues & resources', fn: () => aiAPI.generateSchedule(), msg: 'AI schedule generated.' },
          { step: 'detect', label: 'Detect Conflicts', desc: 'Find timing, venue & resource clashes', fn: () => conflictAPI.detect(), msg: 'Conflict scan complete.' },
          { step: 'regenerate', label: 'Regenerate All', desc: 'Re-run AI after admin changes', fn: () => aiAPI.regenerate(), msg: 'Schedule regenerated.' },
        ].map((action) => (
          <button key={action.step} type="button" disabled={loading} onClick={() => run(action.fn, action.step, action.msg)}
            className="card text-left transition hover:border-brand-500/30 disabled:opacity-50">
            <span className="text-2xl">{action.step === 'generate' ? '🤖' : action.step === 'detect' ? '⚠️' : '🔄'}</span>
            <h3 className="mt-3 font-semibold text-white">{action.label}</h3>
            <p className="mt-1 text-sm text-slate-500">{action.desc}</p>
            {activeStep === action.step && <p className="mt-2 text-xs text-brand-400">Processing...</p>}
          </button>
        ))}
      </div>

      {loading && <Loading />}

      {result?.generate && (
        <div className="card">
          <h3 className="mb-4 font-semibold text-white">AI Schedule Output</h3>
          <p className="rounded-lg bg-slate-800/40 p-4 text-sm text-slate-300">{result.generate.summary}</p>
          {result.generate.suggestions?.length > 0 && (
            <div className="mt-4 space-y-2">
              {result.generate.suggestions.map((s, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-slate-800 p-3 text-sm">
                  <span className="font-bold text-brand-400">#{s.order}</span>
                  <span className="text-slate-300">{s.recommendation}</span>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => scheduleAPI.generate({ aiSummary: result.generate.summary, generatedBy: 'ai' })} className="btn-primary mt-4 text-sm">Save to Schedule</button>
        </div>
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
          <div className="card"><h3 className="font-semibold text-white">Updated Schedule</h3><p className="mt-2 text-sm text-slate-400">{result.regenerate.schedule?.summary}</p></div>
          <div className="card"><h3 className="font-semibold text-white">New Conflicts</h3><p className="mt-2 text-2xl font-bold text-amber-400">{result.regenerate.conflicts?.length || 0}</p></div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 font-mono text-sm">
        <p className="text-slate-500">// AI Scheduler Console</p>
        <pre className="mt-2 text-slate-300">{`> OpenAI integration active
> Fallback: rule-based optimization when API key not set
> Configure key in Settings → OpenAI API Key`}</pre>
      </div>
    </div>
  );
}
