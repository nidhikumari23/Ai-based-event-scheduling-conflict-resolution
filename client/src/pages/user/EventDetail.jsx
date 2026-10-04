import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { assetUrl, eventAPI, registrationAPI, feedbackAPI, userPortalAPI } from '../../api/api';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import Alert from '../../components/user/Alert';
import Modal from '../../components/Modal';

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [ratings, setRatings] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [inPersonalPlan, setInPersonalPlan] = useState(false);
  const [myFeedback, setMyFeedback] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, comment: '' });
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ev, rat, regs, schedule, myFb] = await Promise.all([
        eventAPI.get(id),
        feedbackAPI.ratings(id),
        registrationAPI.my(),
        userPortalAPI.personalSchedule(),
        feedbackAPI.my(),
      ]);
      setEvent(ev.data);
      setRatings(rat.data);
      setRegistration(regs.data.find((r) => r.event?._id === id && r.status !== 'cancelled') || null);
      setInPersonalPlan(schedule.data.some((e) => e._id === id));
      const existing = myFb.data.find((f) => f.event?._id === id || f.event === id);
      setMyFeedback(existing || null);
      if (existing) setFeedbackForm({ rating: existing.rating, comment: existing.comment });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const register = async () => {
    setActionLoading(true);
    try {
      await registrationAPI.register(id);
      setMsg({ type: 'success', text: 'Registration submitted! Awaiting admin approval.' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Registration failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const cancelReg = async () => {
    if (!confirm('Cancel your registration for this event?')) return;
    setActionLoading(true);
    try {
      await registrationAPI.cancel(id);
      setMsg({ type: 'success', text: 'Registration cancelled.' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Cancellation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const togglePersonalPlan = async () => {
    setActionLoading(true);
    try {
      if (inPersonalPlan) {
        await userPortalAPI.removeFromSchedule(id);
        setInPersonalPlan(false);
        setMsg({ type: 'success', text: 'Removed from personal schedule.' });
      } else {
        await userPortalAPI.addToSchedule(id);
        setInPersonalPlan(true);
        setMsg({ type: 'success', text: 'Added to personal schedule.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Action failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const submitFeedback = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (myFeedback) {
        await feedbackAPI.update(myFeedback._id, feedbackForm);
        setMsg({ type: 'success', text: 'Feedback updated successfully.' });
      } else {
        await feedbackAPI.create({ eventId: id, ...feedbackForm });
        setMsg({ type: 'success', text: 'Thank you for your feedback!' });
      }
      setShowFeedbackModal(false);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Could not save feedback' });
    } finally {
      setActionLoading(false);
    }
  };

  const deleteFeedback = async () => {
    if (!confirm('Delete your feedback for this event?')) return;
    await feedbackAPI.remove(myFeedback._id);
    setMyFeedback(null);
    setFeedbackForm({ rating: 5, comment: '' });
    setMsg({ type: 'success', text: 'Feedback deleted.' });
  };

  if (loading) return <Loading />;
  if (!event) return <EmptyState title="Event not found" action={<Link to="/user/events" className="btn-primary">Back to Events</Link>} />;

  const seatsLeft = event.venue ? Math.max(0, event.venue.capacity - (event.registrationCount || 0)) : null;
  const fillPercent = event.venue ? Math.min(100, ((event.registrationCount || 0) / event.venue.capacity) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/user/events" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-brand-300">← Back to Events</Link>

      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <div className="relative aspect-[21/9] bg-gradient-to-br from-brand-900/40 via-slate-800 to-slate-900">
          {event.poster ? (
            <img src={assetUrl(event.poster)} alt={event.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center"><span className="text-8xl opacity-20">🎭</span></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-8">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge>{event.category?.name}</Badge>
              <Badge type={event.status}>{event.status}</Badge>
              {event.isFeatured && <Badge type="published">Featured</Badge>}
              <Badge>Priority {event.priority}/10</Badge>
            </div>
            <h1 className="font-display text-3xl text-white lg:text-5xl">{event.title}</h1>
            <p className="mt-3 max-w-3xl text-slate-300">{event.description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h3 className="mb-4 font-semibold text-white">Event Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Date', value: formatDate(event.date), icon: '📅' },
              { label: 'Time', value: `${event.startTime} – ${event.endTime}`, icon: '🕐' },
              { label: 'Venue', value: event.venue?.name || 'TBD', icon: '📍' },
              { label: 'Location', value: event.venue?.location || '—', icon: '🗺️' },
              { label: 'Organizer', value: event.organizer?.name || '—', icon: '👤' },
              { label: 'Expected Audience', value: event.expectedAudience?.toLocaleString(), icon: '👥' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-slate-800/40 p-4">
                <p className="text-xs text-slate-500">{item.icon} {item.label}</p>
                <p className="mt-1 font-medium text-white">{item.value}</p>
              </div>
            ))}
          </div>

          {event.venue && (
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-slate-400">Seat Availability</span>
                <span className="text-white">{seatsLeft} of {event.venue.capacity} remaining</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${fillPercent > 85 ? 'bg-red-500' : fillPercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${fillPercent}%` }} />
              </div>
              {event.venue.facilities?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {event.venue.facilities.map((f) => <Badge key={f}>{f}</Badge>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <h3 className="mb-4 font-semibold text-white">Actions</h3>
            <div className="space-y-3">
              {!registration ? (
                <button onClick={register} disabled={actionLoading || event.status === 'cancelled'} className="btn-primary w-full">
                  Register for Event
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                    <p className="text-sm font-medium text-emerald-300">Registration: {registration.status}</p>
                  </div>
                  {registration.status !== 'cancelled' && (
                    <button onClick={cancelReg} disabled={actionLoading} className="btn-danger w-full text-sm">Cancel Registration</button>
                  )}
                </div>
              )}
              <button onClick={togglePersonalPlan} disabled={actionLoading} className="btn-secondary w-full">
                {inPersonalPlan ? 'Remove from Personal Plan' : 'Add to Personal Plan'}
              </button>
              <button onClick={() => setShowFeedbackModal(true)} className="btn-secondary w-full">
                {myFeedback ? 'Edit My Review' : 'Write a Review'}
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-3 font-semibold text-white">Ratings</h3>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-amber-400">{ratings?.average?.toFixed(1) || '—'}</span>
              <div>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < Math.round(ratings?.average || 0) ? 'text-amber-400' : 'text-slate-600'}>★</span>
                  ))}
                </div>
                <p className="text-xs text-slate-500">{ratings?.count || 0} reviews</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {event.brands?.length > 0 && (
        <div className="card">
          <h3 className="mb-4 font-semibold text-white">Sponsors & Partners</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {event.brands.map((b) => (
              <div key={b._id} className="flex items-center justify-between rounded-lg bg-slate-800/40 p-4">
                <div>
                  <p className="font-medium text-white">{b.name}</p>
                  <p className="text-xs text-slate-500">{b.description}</p>
                </div>
                <Badge>{b.sponsorshipType}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {event.rules && (
        <div className="card">
          <h3 className="mb-2 font-semibold text-white">Event Rules & Guidelines</h3>
          <p className="text-sm leading-relaxed text-slate-400">{event.rules}</p>
        </div>
      )}

      {myFeedback && (
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-white">Your Review</h3>
              <div className="mt-2 flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={i < myFeedback.rating ? 'text-amber-400' : 'text-slate-600'}>★</span>
                ))}
              </div>
              <p className="mt-2 text-sm text-slate-400">{myFeedback.comment}</p>
              {myFeedback.adminReply && (
                <div className="mt-3 rounded-lg bg-brand-500/10 p-3 text-sm text-brand-300">
                  <strong>Admin reply:</strong> {myFeedback.adminReply}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowFeedbackModal(true)} className="text-sm text-brand-400">Edit</button>
              <button onClick={deleteFeedback} className="text-sm text-red-400">Delete</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} title={myFeedback ? 'Edit Review' : 'Write a Review'}>
        <form onSubmit={submitFeedback} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-400">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFeedbackForm({ ...feedbackForm, rating: n })}
                  className={`text-2xl ${n <= feedbackForm.rating ? 'text-amber-400' : 'text-slate-600'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Comment</label>
            <textarea className="input-field min-h-[100px]" value={feedbackForm.comment} onChange={(e) => setFeedbackForm({ ...feedbackForm, comment: e.target.value })} placeholder="Share your experience..." />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowFeedbackModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={actionLoading} className="btn-primary">{myFeedback ? 'Update' : 'Submit'} Review</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function EmptyState({ title, action }) {
  return (
    <div className="py-16 text-center">
      <p className="text-lg text-white">{title}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}
