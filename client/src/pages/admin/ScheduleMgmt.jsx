import { useEffect, useState } from 'react';
import { scheduleAPI } from '../../api/api';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/admin/PageHeader';
import Alert from '../../components/admin/Alert';

export default function ScheduleMgmt() {
  const [schedule, setSchedule] = useState(null);
  const [view, setView] = useState('day');
  const [viewData, setViewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: 'info', text: '' });

  const load = async () => {
    setLoading(true);
    const [{ data: sch }, { data: vd }] = await Promise.all([scheduleAPI.get(), scheduleAPI.view(view)]);
    setSchedule(sch);
    setViewData(vd);
    setLoading(false);
  };

  useEffect(() => { load(); }, [view]);

  const actions = {
    sync: async () => { await scheduleAPI.generate({}); setMsg({ type: 'success', text: 'Schedule synced from events.' }); load(); },
    lock: async () => { await scheduleAPI.lock(); setMsg({ type: 'success', text: 'Schedule locked.' }); load(); },
    publish: async () => { await scheduleAPI.publish(true); setMsg({ type: 'success', text: 'Schedule published to users.' }); load(); },
    unpublish: async () => { await scheduleAPI.publish(false); setMsg({ type: 'info', text: 'Schedule unpublished.' }); load(); },
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule Management" subtitle={schedule?.festivalName || 'Festival Schedule'} breadcrumb="AI & Scheduling"
        stats={[
          { label: 'Entries', value: schedule?.entries?.length || 0 },
          { label: 'Status', value: schedule?.isPublished ? 'Published' : 'Draft' },
          { label: 'Locked', value: schedule?.isLocked ? 'Yes' : 'No' },
          { label: 'Source', value: schedule?.generatedBy || 'manual' },
        ]}
        actions={<>
          <button type="button" onClick={actions.sync} className="btn-secondary">Sync Events</button>
          <button type="button" onClick={actions.lock} className="btn-secondary" disabled={schedule?.isLocked}>Lock</button>
          <button type="button" onClick={actions.publish} className="btn-primary">Publish</button>
          <button type="button" onClick={actions.unpublish} className="btn-secondary">Unpublish</button>
        </>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="flex flex-wrap items-center gap-3">
        {['day', 'venue', 'category'].map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={`rounded-lg px-4 py-2 text-sm capitalize ${view === v ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{v}-wise</button>
        ))}
        <Badge type={schedule?.isLocked ? 'cancelled' : 'approved'}>{schedule?.isLocked ? 'Locked' : 'Editable'}</Badge>
        <Badge type={schedule?.isPublished ? 'published' : 'draft'}>{schedule?.isPublished ? 'Published' : 'Draft'}</Badge>
      </div>

      {schedule?.aiSummary && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
          <p className="text-sm font-medium text-brand-300">AI Summary</p>
          <p className="mt-1 text-sm text-slate-400">{schedule.aiSummary}</p>
        </div>
      )}

      {loading ? <Loading /> : (
        <div className="space-y-6">
          {viewData && typeof viewData === 'object' && !Array.isArray(viewData) ? (
            Object.entries(viewData).map(([key, events]) => (
              <div key={key} className="card">
                <h3 className="mb-4 font-semibold text-white">{key} <span className="text-sm font-normal text-slate-500">({(Array.isArray(events) ? events : []).length})</span></h3>
                <div className="space-y-2">
                  {(Array.isArray(events) ? events : []).map((ev) => (
                    <div key={ev._id} className="flex items-center justify-between rounded-lg bg-slate-800/40 p-4">
                      <div><p className="font-medium text-white">{ev.title}</p><p className="text-xs text-slate-500">{ev.category?.name} · {ev.venue?.name}</p></div>
                      <div className="text-right"><p className="text-sm text-brand-300">{ev.startTime} – {ev.endTime}</p><p className="text-xs text-slate-500">{formatDate(ev.date)}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="card space-y-2">
              {schedule?.entries?.map((entry, i) => (
                <div key={i} className="flex justify-between rounded-lg bg-slate-800/40 p-3 text-sm">
                  <span className="text-white">{entry.event?.title}</span>
                  <span className="text-slate-500">{formatDate(entry.date)} {entry.startTime}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
