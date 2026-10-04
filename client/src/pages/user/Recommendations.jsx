import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiAPI, userPortalAPI } from '../../api/api';
import Loading from '../../components/Loading';
import PageHeader from '../../components/user/PageHeader';
import EventCard from '../../components/user/EventCard';
import Alert from '../../components/user/Alert';

export default function Recommendations() {
  const [recs, setRecs] = useState(null);
  const [plan, setPlan] = useState(null);
  const [personalIds, setPersonalIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: 'info', text: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [r, p, schedule] = await Promise.all([
        aiAPI.recommendations(),
        aiAPI.personalPlan(),
        userPortalAPI.personalSchedule(),
      ]);
      setRecs(r.data);
      setPlan(p.data);
      setPersonalIds(schedule.data.map((e) => e._id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addToPlan = async (eventId) => {
    try {
      const { data } = await userPortalAPI.addToSchedule(eventId);
      setPersonalIds(data.map((e) => e._id));
      setMsg({ type: 'success', text: 'Added to your personal schedule!' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Could not add to plan' });
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Recommendations"
        subtitle="Personalized event picks and festival plan powered by OpenAI"
        breadcrumb="AI Engine"
        actions={<Link to="/user/personal-schedule" className="btn-secondary">View Personal Plan</Link>}
      />

      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      {recs?.summary && (
        <div className="rounded-xl border border-brand-500/20 bg-gradient-to-r from-brand-950/40 to-slate-900/40 p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🤖</span>
            <div>
              <h3 className="font-semibold text-white">AI Analysis</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{recs.summary}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-4 text-lg font-semibold text-white">Recommended Events</h3>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {recs?.recommendations?.map((r) => (
            <div key={r.eventId} className="card flex flex-col">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-brand-500/20 px-3 py-1 text-xs font-medium text-brand-300">
                  Match {r.score}%
                </span>
                {personalIds.includes(r.eventId) && <span className="text-xs text-cyan-400">✓ In plan</span>}
              </div>
              <h4 className="text-lg font-semibold text-white">{r.title}</h4>
              <p className="mt-2 flex-1 text-sm text-slate-400">{r.reason}</p>
              <div className="mt-4 flex gap-2 border-t border-slate-800 pt-4">
                <Link to={`/user/events/${r.eventId}`} className="btn-secondary flex-1 text-center text-xs">View</Link>
                {!personalIds.includes(r.eventId) && (
                  <button onClick={() => addToPlan(r.eventId)} className="btn-primary flex-1 text-xs">Add to Plan</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {plan && (
        <div className="card">
          <h3 className="mb-2 text-lg font-semibold text-white">Your Personal Festival Plan</h3>
          <p className="mb-6 text-sm text-slate-400">{plan.summary}</p>

          {plan.warnings?.length > 0 && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <h4 className="font-medium text-amber-300">Overlap Warnings</h4>
              {plan.warnings.map((w, i) => (
                <p key={i} className="mt-2 text-sm text-amber-200/80">⚠ {w}</p>
              ))}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Venue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {plan.plan?.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-brand-300">{item.time}</td>
                    <td className="px-4 py-3 font-medium text-white">{item.event}</td>
                    <td className="px-4 py-3 text-slate-400">{item.venue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
