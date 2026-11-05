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
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: sch }, { data: vd }] = await Promise.all([scheduleAPI.get(), scheduleAPI.view(view)]);
      setSchedule(sch);
      setViewData(vd);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load the schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [view]);

  const runAction = async (action, success) => {
    try {
      await action();
      setMsg({ type: 'success', text: success });
      await load();
    } catch (requestError) {
      setMsg({ type: 'error', text: requestError.response?.data?.message || 'Schedule action failed.' });
    }
  };

  const calendarMonths = Array.isArray(viewData) ? Object.values(viewData.reduce((months, event) => {
    const dateKey = event.date ? new Date(event.date).toISOString().slice(0, 10) : '';
    if (!dateKey) return months;
    const monthKey = dateKey.slice(0, 7);
    if (!months[monthKey]) months[monthKey] = {};
    if (!months[monthKey][dateKey]) months[monthKey][dateKey] = [];
    months[monthKey][dateKey].push(event);
    return months;
  }, {})) : [];

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
          <button type="button" onClick={() => runAction(() => scheduleAPI.generate({}), 'Schedule synced from events.')} className="btn-secondary">Sync Events</button>
          {schedule?.isLocked
            ? <button type="button" onClick={() => runAction(() => scheduleAPI.unlock(), 'Schedule unlocked. Authorized admins can now save schedule changes.')} className="btn-primary">Unlock Schedule</button>
            : <button type="button" onClick={() => runAction(() => scheduleAPI.lock(), 'Schedule locked.')} className="btn-secondary">Lock</button>}
          <button type="button" onClick={() => runAction(() => scheduleAPI.publish(true), 'Schedule published to users.')} className="btn-primary">Publish</button>
          <button type="button" onClick={() => runAction(() => scheduleAPI.publish(false), 'Schedule unpublished.')} className="btn-secondary">Unpublish</button>
        </>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />
      {error && <div role="alert" className="card border border-red-500/30 text-sm text-red-300">{error}<button type="button" onClick={load} className="ml-3 underline">Retry</button></div>}

      <div className="flex flex-wrap items-center gap-3">
        {['calendar', 'day', 'venue', 'category'].map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={`rounded-lg px-4 py-2 text-sm capitalize ${view === v ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{v}-wise</button>
        ))}
        <Badge type={schedule?.isLocked ? 'cancelled' : 'approved'}>{schedule?.isLocked ? 'Locked' : 'Editable'}</Badge>
        <Badge type={schedule?.isPublished ? 'published' : 'draft'}>{schedule?.isPublished ? 'Published' : 'Draft'}</Badge>
      </div>
      {schedule?.isLocked && (
        <div role="status" className="card border border-amber-500/30 text-sm text-amber-200">
          <p className="font-medium">Schedule changes are blocked while this schedule is locked.</p>
          <p className="mt-1 text-amber-100/80">
            {schedule.lockReason || 'No reason was recorded for this existing lock. An administrator must unlock the schedule before changes can be saved.'}
            {schedule.lockedBy?.name && ` Locked by ${schedule.lockedBy.name}.`}
            {schedule.lockedAt && ` Locked on ${new Date(schedule.lockedAt).toLocaleString()}.`}
          </p>
          <p className="mt-1 text-amber-100/80">Only an administrator can unlock it; schedule validation remains active after unlocking.</p>
        </div>
      )}

      {schedule?.aiSummary && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
          <p className="text-sm font-medium text-brand-300">AI Summary</p>
          <p className="mt-1 text-sm text-slate-400">{schedule.aiSummary}</p>
        </div>
      )}

      {loading ? <Loading /> : (
        <div className="space-y-6">
          {view === 'calendar' && Array.isArray(viewData) ? (
            calendarMonths.map((month) => {
              const firstDate = Object.keys(month).sort()[0];
              const [year, monthNumber] = firstDate.split('-').map(Number);
              const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
              const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
              const cells = [...Array(monthStart.getUTCDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
              while (cells.length % 7) cells.push(null);
              return (
                <section key={firstDate.slice(0, 7)} className="card">
                  <h3 className="mb-4 font-semibold text-white">{monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>
                  <div className="grid grid-cols-7 gap-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <p key={day} className="p-2 text-center text-xs text-slate-500">{day}</p>)}
                    {cells.map((day, index) => {
                      const dateKey = day ? `${firstDate.slice(0, 7)}-${String(day).padStart(2, '0')}` : '';
                      const events = month[dateKey] || [];
                      return <div key={`${dateKey}-${index}`} className="min-h-24 border border-slate-800/70 p-1 sm:min-h-28">
                        {day && <p className="px-1 text-xs text-slate-500">{day}</p>}
                        {events.map((event) => <div key={event._id} className="mb-1 rounded bg-brand-500/10 p-1 text-[10px] text-brand-200 sm:text-xs">
                          <p className="truncate">{event.startTime} {event.title}</p>
                          <p className="truncate text-slate-500">{event.venue?.name || 'Venue TBD'}</p>
                        </div>)}
                      </div>;
                    })}
                  </div>
                </section>
              );
            })
          ) : viewData && typeof viewData === 'object' && !Array.isArray(viewData) ? (
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
          ) : Array.isArray(viewData) ? (
            viewData.map((ev) => (
              <div key={ev._id} className="card flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-medium text-white">{ev.title}</p><p className="text-xs text-slate-500">{ev.category?.name || 'Uncategorized'} · {ev.venue?.name || 'Venue TBD'}</p></div>
                <div className="text-right"><p className="text-sm text-brand-300">{ev.startTime} – {ev.endTime}</p><p className="text-xs text-slate-500">{formatDate(ev.date)}</p></div>
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
