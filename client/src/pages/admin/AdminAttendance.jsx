import { useCallback, useEffect, useState } from 'react';
import { registrationAPI } from '../../api/api';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/admin/PageHeader';
import Alert from '../../components/admin/Alert';
import DataTable from '../../components/admin/DataTable';

const EMPTY_MESSAGE = { type: 'info', text: '' };

export default function AdminAttendance() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [report, setReport] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [actionId, setActionId] = useState('');
  const [message, setMessage] = useState(EMPTY_MESSAGE);
  const [error, setError] = useState('');

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setError('');
    try {
      const { data } = await registrationAPI.attendanceEvents();
      if (!Array.isArray(data)) throw new Error('The attendance events API returned an invalid response.');
      setEvents(data);
      setEventId((current) => current && data.some((event) => String(event._id) === current)
        ? current
        : data[0]?._id || '');
    } catch (requestError) {
      setEvents([]);
      setEventId('');
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load ended events.');
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  const loadAttendance = useCallback(async (id) => {
    if (!id) {
      setReport(null);
      return;
    }
    setLoadingReport(true);
    setError('');
    try {
      const { data } = await registrationAPI.eventAttendance(id);
      setReport(data);
    } catch (requestError) {
      setReport(null);
      setError(requestError.response?.data?.message || 'Unable to load attendance records.');
    } finally {
      setLoadingReport(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { loadAttendance(eventId); }, [eventId, loadAttendance]);

  const updateAttendance = async (registration, attendanceStatus) => {
    setActionId(String(registration._id));
    setMessage(EMPTY_MESSAGE);
    try {
      await registrationAPI.verifyAttendance(registration._id, attendanceStatus);
      setMessage({
        type: 'success',
        text: attendanceStatus === 'verified'
          ? `${registration.user?.name || 'Participant'} marked present.`
          : `${registration.user?.name || 'Participant'} marked absent.`,
      });
      await loadAttendance(eventId);
    } catch (requestError) {
      setMessage({
        type: 'error',
        text: requestError.response?.data?.message || 'Unable to update attendance.',
      });
    } finally {
      setActionId('');
    }
  };

  const event = report?.event;
  const participantRows = report?.registrations.map((registration) => ({
    ...registration,
    participantName: registration.user?.name || '',
    participantEmail: registration.user?.email || '',
  })) || [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Attendance"
        subtitle="Mark registered students present or absent for completed events"
        breadcrumb="Events & People"
        actions={<button type="button" onClick={loadEvents} className="btn-secondary">Refresh</button>}
      />
      <Alert type={message.type} message={message.text} onClose={() => setMessage(EMPTY_MESSAGE)} />
      {error && <div role="alert" className="card border border-red-500/30 text-sm text-red-300">{error}</div>}

      <section className="card">
        <label htmlFor="attendance-event-select" className="mb-2 block text-sm text-slate-400">Select a completed event</label>
        {loadingEvents ? <Loading /> : events.length ? (
          <select
            id="attendance-event-select"
            className="input-field max-w-2xl"
            value={eventId}
            onChange={(change) => setEventId(change.target.value)}
          >
            {events.map((item) => (
              <option key={item._id} value={item._id}>
                {item.title} · {formatDate(item.date)} · {item.startTime}–{item.endTime} · {item.status}
              </option>
            ))}
          </select>
        ) : !error ? (
          <p className="text-sm text-slate-500">There are no completed events available for attendance.</p>
        ) : null}
      </section>

      {loadingReport ? <Loading /> : event && report && (
        <>
          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">{event.title}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {formatDate(event.date)} · {event.startTime}–{event.endTime} · {event.venue?.name || 'Venue TBD'}
                </p>
              </div>
              <Badge type={event.status}>{event.status}</Badge>
            </div>
          </section>

          <section className="card">
            <h2 className="mb-4 text-lg font-semibold text-white">Registered participants</h2>
            {participantRows.length ? (
              <DataTable
                data={participantRows}
                searchKeys={['participantName', 'participantEmail']}
                searchPlaceholder="Search participants..."
                emptyTitle="No matching participants"
                columns={[
                  {
                    key: 'participant',
                    label: 'Participant',
                    render: (registration) => (
                      <div>
                        <p className="font-medium text-white">{registration.user?.name || 'Participant unavailable'}</p>
                        <p className="text-xs text-slate-500">{registration.user?.email || 'No email available'}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'attendanceStatus',
                    label: 'Attendance',
                    render: (registration) => {
                      const status = registration.attendanceStatus;
                      const label = status === 'verified' ? 'Present' : status === 'absent' ? 'Absent' : 'Not marked';
                      const type = status === 'verified' ? 'approved' : status === 'absent' ? 'rejected' : 'pending';
                      return <Badge type={type}>{label}</Badge>;
                    },
                  },
                  {
                    key: 'registrationStatus',
                    label: 'Registration',
                    render: (registration) => <Badge type={registration.status}>{registration.status}</Badge>,
                  },
                  {
                    key: 'attendanceVerifiedBy',
                    label: 'Last updated by',
                    render: (registration) => registration.attendanceVerifiedBy?.name || '—',
                  },
                ]}
                actions={(registration) => (
                  registration.status !== 'approved' ? (
                    <span className="text-xs text-slate-500">Approval required</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={actionId === String(registration._id) || registration.attendanceStatus === 'verified'}
                        onClick={() => updateAttendance(registration, 'verified')}
                        className="text-emerald-400 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                      >{actionId === String(registration._id) ? 'Saving…' : 'Present'}</button>
                      <button
                        type="button"
                        disabled={actionId === String(registration._id) || registration.attendanceStatus === 'absent'}
                        onClick={() => updateAttendance(registration, 'absent')}
                        className="text-amber-400 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                      >{actionId === String(registration._id) ? 'Saving…' : 'Absent'}</button>
                    </>
                  )
                )}
              />
            ) : (
              <p className="text-sm text-slate-500">There are no approved registrations for this event.</p>
            )}
          </section>
        </>
      )}
      {!loadingEvents && !loadingReport && !eventId && !error && (
        <div className="card text-sm text-slate-500">Attendance records will appear here after an event is marked completed.</div>
      )}
    </div>
  );
}
