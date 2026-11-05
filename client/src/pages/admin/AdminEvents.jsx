import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventAPI, categoryAPI, venueAPI, staffAPI, brandAPI, resourceAPI } from '../../api/api';
import Modal from '../../components/Modal';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/admin/PageHeader';
import DataTable from '../../components/admin/DataTable';
import Alert from '../../components/admin/Alert';

const statusOptions = ['draft', 'scheduled', 'published', 'cancelled'];

const makeEventPayload = (values) => {
  const { preferredStart, preferredEnd, requiredFacilities, ...fields } = values;
  return {
    ...fields,
    venue: values.venue || null,
    organizer: values.organizer || null,
    expectedAudience: Number(values.expectedAudience),
    priority: Number(values.priority),
    setupMinutes: Number(values.setupMinutes),
    cleanupMinutes: Number(values.cleanupMinutes),
    requiredFacilities: requiredFacilities.split(',').map((facility) => facility.trim()).filter(Boolean),
    preferredTimeSlots: preferredStart && preferredEnd ? [{ startTime: preferredStart, endTime: preferredEnd }] : [],
    resources: values.resources.map((requirement) => ({ ...requirement, quantity: Number(requirement.quantity) })),
  };
};

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [venues, setVenues] = useState([]);
  const [staff, setStaff] = useState([]);
  const [resources, setResources] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState('');
  const [venueLoading, setVenueLoading] = useState(true);
  const [venueError, setVenueError] = useState('');
  const [resourceLoading, setResourceLoading] = useState(true);
  const [resourceError, setResourceError] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [resourceSearch, setResourceSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [conflictResolution, setConflictResolution] = useState(null);
  const [selectedAlternative, setSelectedAlternative] = useState(null);
  const submitLock = useRef(false);
  const [form, setForm] = useState({
    title: '', description: '', category: '', venue: '', organizer: '', date: '',
    startTime: '10:00', endTime: '12:00', expectedAudience: 100, priority: 5, status: 'draft',
    rules: '', isFeatured: false, setupMinutes: 0, cleanupMinutes: 0, staff: [], resources: [],
    requiredFacilities: '', preferredStart: '', preferredEnd: '',
  });
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', startTime: '', endTime: '', venue: '' });

  const loadOptions = async (request, setItems, setLoading, setError, label) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await request();
      if (!Array.isArray(data)) {
        throw new Error(`The ${label.toLowerCase()} API returned an invalid response.`);
      }
      setItems(data);
    } catch (error) {
      setItems([]);
      setError(error.response?.data?.message || error.message || `Unable to load ${label.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = () => loadOptions(staffAPI.list, setStaff, setStaffLoading, setStaffError, 'Staff');
  const loadCategories = () => loadOptions(() => categoryAPI.list(true), setCategories, setCategoryLoading, setCategoryError, 'Categories');
  const loadVenues = () => loadOptions(venueAPI.list, setVenues, setVenueLoading, setVenueError, 'Venues');
  const loadResources = () => loadOptions(resourceAPI.list, setResources, setResourceLoading, setResourceError, 'Resources');
  const loadFormOptions = () => Promise.all([loadStaff(), loadCategories(), loadVenues(), loadResources()]);

  const load = async () => {
    setLoading(true);
    const formOptionsRequest = loadFormOptions();
    try {
      const [ev, br] = await Promise.all([eventAPI.list({}), brandAPI.list(true)]);
      setEvents(ev.data);
      setBrands(br.data);
    } catch (error) {
      setMsg({ type: 'error', text: error.response?.data?.message || 'Unable to load event management data.' });
    } finally {
      setLoading(false);
      await formOptionsRequest;
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? events : events.filter((e) => e.status === filter);

  const openEdit = (item = null) => {
    loadFormOptions();
    setSubmitError('');
    setConflictResolution(null);
    setSelectedAlternative(null);
    setEditItem(item);
    if (item) {
      setForm({
        title: item.title, description: item.description || '', category: item.category?._id || '',
        venue: item.venue?._id || '', organizer: item.organizer?._id || '',
        date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
        startTime: item.startTime, endTime: item.endTime, expectedAudience: item.expectedAudience,
        priority: item.priority, status: item.status, rules: item.rules || '', isFeatured: item.isFeatured,
        setupMinutes: item.setupMinutes || 0,
        cleanupMinutes: item.cleanupMinutes || 0,
        staff: (item.staff || []).map((member) => String(member._id || member)),
        resources: (item.resources || []).map((requirement) => ({
          resource: String(requirement.resource?._id || requirement.resource),
          quantity: Number(requirement.quantity) || 1,
        })),
        requiredFacilities: (item.requiredFacilities || []).join(', '),
        preferredStart: item.preferredTimeSlots?.[0]?.startTime || '',
        preferredEnd: item.preferredTimeSlots?.[0]?.endTime || '',
      });
    } else {
      setForm({
        title: '', description: '', category: '', venue: '', organizer: '', date: '',
        startTime: '10:00', endTime: '12:00', expectedAudience: 100, priority: 5,
        status: 'draft', rules: '', isFeatured: false, setupMinutes: 0, cleanupMinutes: 0,
        staff: [], resources: [], requiredFacilities: '', preferredStart: '', preferredEnd: '',
      });
    }
    setModal(true);
  };

  const saveForm = async (values) => {
    if (submitLock.current) return;
    if (!values.category) {
      setSubmitError('A category is required. Add a category in Category Management, then select it before saving.');
      return;
    }
    submitLock.current = true;

    const payload = makeEventPayload(values);
    setIsSaving(true);
    setSubmitError('');
    try {
      const { data: savedEvent } = editItem
        ? await eventAPI.update(editItem._id, payload)
        : await eventAPI.create(payload);
      if (!savedEvent?._id) {
        throw new Error('The server did not confirm that the event was saved.');
      }
      setModal(false);
      setConflictResolution(null);
      setSelectedAlternative(null);
      setMsg({ type: 'success', text: 'Event saved successfully.' });
      await load();
    } catch (err) {
      const response = err.response?.data;
      const conflicts = response?.details?.conflicts;
      const conflictDetails = Array.isArray(conflicts)
        ? conflicts.map((conflict) => `${conflict.code || conflict.type}: ${conflict.description}`).join('\n')
        : '';
      setSubmitError([response?.message || err.message || 'Unable to save the event.', conflictDetails].filter(Boolean).join('\n'));
      setConflictResolution(null);
      setSelectedAlternative(null);
      if (!editItem && Array.isArray(conflicts) && conflicts.length) {
        try {
          const { data } = await eventAPI.alternatives(payload);
          setConflictResolution(data);
          if (!data.alternatives?.length) {
            setSubmitError((previous) => `${previous}\nNo feasible alternatives are available for the current schedule and resource constraints.`);
          }
        } catch (suggestionError) {
          setSubmitError((previous) =>
            `${previous}\nUnable to generate alternatives: ${suggestionError.response?.data?.message || suggestionError.message || 'Request failed.'}`
          );
        }
      }
    } finally {
      submitLock.current = false;
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await saveForm(form);
  };

  const retryWithAlternative = () => {
    if (!selectedAlternative) return;
    saveForm({
      ...form,
      date: selectedAlternative.date,
      startTime: selectedAlternative.startTime,
      endTime: selectedAlternative.endTime,
      venue: selectedAlternative.venue,
      organizer: selectedAlternative.organizer || '',
      staff: selectedAlternative.staff || [],
      resources: (selectedAlternative.resources || []).map(({ resource, quantity }) => ({
        resource: String(resource),
        quantity: Number(quantity),
      })),
    });
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    try {
      await eventAPI.reschedule(rescheduleModal._id, rescheduleForm);
      setRescheduleModal(null);
      setMsg({ type: 'success', text: 'Event rescheduled and checked against current availability.' });
      load();
    } catch (error) {
      setMsg({ type: 'error', text: error.response?.data?.message || 'Unable to reschedule event.' });
    }
  };

  const markCompleted = async (event) => {
    try {
      await eventAPI.complete(event._id);
      setMsg({ type: 'success', text: `"${event.title}" marked completed.` });
      await load();
    } catch (error) {
      setMsg({ type: 'error', text: error.response?.data?.message || 'Unable to complete this event.' });
    }
  };

  const stats = [
    { label: 'Total', value: events.length },
    { label: 'Published', value: events.filter((e) => e.status === 'published').length },
    { label: 'Draft', value: events.filter((e) => e.status === 'draft').length },
    { label: 'Featured', value: events.filter((e) => e.isFeatured).length },
    { label: 'Cancelled', value: events.filter((e) => e.status === 'cancelled').length },
  ];

  const filteredStaff = staff.filter((member) => member.name.toLowerCase().includes(staffSearch.trim().toLowerCase()));
  const filteredResources = resources.filter((resource) => resource.name.toLowerCase().includes(resourceSearch.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader title="Event Management" subtitle="Full lifecycle control for festival events" breadcrumb="Events & People" stats={stats} actions={<button type="button" onClick={() => openEdit()} className="btn-primary">+ Create Event</button>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="flex flex-wrap gap-2">
        {['all', ...statusOptions].map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-lg px-4 py-2 text-sm capitalize ${filter === s ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{s}</button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <DataTable
          searchKeys={['title']}
          data={filtered}
          onRowClick={setDetailModal}
          columns={[
            { key: 'title', label: 'Event', sortable: true, render: (ev) => (
              <div>
                <p className="font-medium text-white">{ev.title}</p>
                {ev.isFeatured && <Badge type="published" className="mt-1">Featured</Badge>}
              </div>
            )},
            { key: 'category', label: 'Category', render: (ev) => ev.category?.name },
            { key: 'venue', label: 'Venue', render: (ev) => ev.venue?.name || 'TBD' },
            { key: 'date', label: 'Date', sortable: true, render: (ev) => formatDate(ev.date) },
            { key: 'time', label: 'Time', render: (ev) => `${ev.startTime}–${ev.endTime}` },
            { key: 'registrations', label: 'Regs', render: (ev) => ev.registrationCount || 0 },
            { key: 'priority', label: 'Priority', sortable: true },
            { key: 'status', label: 'Status', render: (ev) => <Badge type={ev.status}>{ev.status}</Badge> },
          ]}
          actions={(ev) => (
            <>
              <button type="button" onClick={() => setDetailModal(ev)} className="text-slate-400 text-xs">View</button>
              <button type="button" onClick={() => openEdit(ev)} className="text-brand-400 text-xs">Edit</button>
              <button type="button" onClick={() => eventAPI.featured(ev._id).then(load)} className="text-amber-400 text-xs">Featured</button>
              <button type="button" onClick={() => { setRescheduleModal(ev); setRescheduleForm({ date: ev.date ? new Date(ev.date).toISOString().split('T')[0] : '', startTime: ev.startTime, endTime: ev.endTime, venue: ev.venue?._id || '' }); }} className="text-cyan-400 text-xs">Reschedule</button>
              {['scheduled', 'published'].includes(ev.status) && <button type="button" onClick={() => markCompleted(ev)} className="text-emerald-400 text-xs">Mark completed</button>}
              {ev.status !== 'cancelled' && <button type="button" onClick={() => eventAPI.cancel(ev._id).then(load)} className="text-orange-400 text-xs">Cancel</button>}
              <button type="button" onClick={() => { if (confirm('Delete event?')) eventAPI.remove(ev._id).then(load); }} className="text-red-400 text-xs">Delete</button>
            </>
          )}
        />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Event' : 'Create Event'} size="xl">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          {submitError && (
            <div role="alert" aria-live="polite" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:col-span-2">
              <p className="whitespace-pre-line">{submitError}</p>
              {submitError.includes('Schedule is locked') && (
                <Link to="/admin/schedule" className="mt-2 inline-flex text-brand-300 underline underline-offset-2">
                  Open Schedule Management to unlock the schedule
                </Link>
              )}
            </div>
          )}
          {conflictResolution?.conflicts?.length > 0 && (
            <section aria-label="Conflict resolution alternatives" className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:col-span-2">
              <div>
                <h3 className="font-semibold text-amber-200">Schedule conflicts and feasible alternatives</h3>
                <p className="mt-1 text-sm text-slate-400">Each option is checked against current venue, capacity, facility, timing, buffer, staff, and resource availability. Select an option and retry; the server will validate it again before saving.</p>
              </div>
              {conflictResolution.conflicts.map((conflict, conflictIndex) => (
                <div key={`${conflict.code}-${conflictIndex}`} className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{conflict.code || conflict.type}</p>
                    <p className="mt-1 text-sm text-slate-300">{conflict.reason}</p>
                  </div>
                  {conflict.alternatives?.length ? conflict.alternatives.map((alternative) => {
                    const selected = selectedAlternative &&
                      selectedAlternative.date === alternative.date &&
                      selectedAlternative.startTime === alternative.startTime &&
                      selectedAlternative.venue === alternative.venue &&
                      JSON.stringify(selectedAlternative.staff) === JSON.stringify(alternative.staff) &&
                      JSON.stringify(selectedAlternative.resources) === JSON.stringify(alternative.resources);
                    return (
                      <article key={`${alternative.venue}-${alternative.date}-${alternative.startTime}-${alternative.rank}`} className={`rounded-lg border p-3 ${selected ? 'border-brand-400 bg-brand-500/10' : 'border-slate-700'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-white">{alternative.venueName} · {alternative.date} · {alternative.startTime}–{alternative.endTime}</p>
                            <p className="mt-1 text-xs text-slate-400">{alternative.explanation}</p>
                          </div>
                          <button type="button" onClick={() => setSelectedAlternative(alternative)} className={selected ? 'btn-primary text-xs' : 'btn-secondary text-xs'} disabled={isSaving}>
                            {selected ? 'Selected' : 'Select alternative'}
                          </button>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                          <p>Venue: {alternative.availability.venue.capacity} capacity (needs {alternative.availability.venue.requiredCapacity}); {alternative.availability.venue.facilitiesAvailable ? 'all facilities available' : 'required facilities missing'}</p>
                          <p>Reserved: {alternative.availability.time.reservedFrom} – {alternative.availability.time.reservedUntil} ({alternative.availability.time.setupMinutes}m setup, {alternative.availability.time.cleanupMinutes}m cleanup)</p>
                          <p>Staff: {alternative.availability.staff.length ? alternative.availability.staff.map((member) => `${member.name} (${member.role})`).join(', ') : 'None required'}</p>
                          <p>Resources: {alternative.availability.resources.length ? alternative.availability.resources.map((item) => `${item.name}: ${item.quantity}/${item.availableQuantity}`).join(', ') : 'None required'}</p>
                        </div>
                      </article>
                    );
                  }) : <p className="text-sm text-amber-200">No feasible option resolves this conflict with the current availability.</p>}
                </div>
              ))}
              {selectedAlternative && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-3">
                  <p className="text-sm text-brand-200">Selected: {selectedAlternative.venueName} · {selectedAlternative.date} · {selectedAlternative.startTime}–{selectedAlternative.endTime}</p>
                  <button type="button" onClick={retryWithAlternative} className="btn-primary" disabled={isSaving}>
                    {isSaving ? 'Revalidating…' : 'Retry event creation'}
                  </button>
                </div>
              )}
            </section>
          )}
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-slate-400">Title *</label><input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-slate-400">Description</label><textarea className="input-field min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Category *</label>
            <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} disabled={categoryLoading || Boolean(categoryError) || categories.length === 0} required>
              <option value="">{categoryLoading ? 'Loading categories…' : categoryError ? 'Categories unavailable' : categories.length ? 'Select category' : 'No categories available'}</option>
              {form.category && !categories.some((category) => String(category._id) === String(form.category)) && <option value={form.category}>Category currently assigned to this event</option>}
              {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
            </select>
            {categoryError ? <div role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-xs text-red-300"><span>{categoryError}</span><button type="button" onClick={loadCategories} className="underline underline-offset-2">Retry</button></div>
              : !categoryLoading && !categories.length ? <p className="mt-1 text-xs text-amber-300">No categories exist yet. Add one in <a className="underline underline-offset-2" href="/admin/categories">Category Management</a>.</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Venue</label>
            <select className="input-field" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} disabled={venueLoading || Boolean(venueError) || venues.length === 0}>
              <option value="">{venueLoading ? 'Loading venues…' : venueError ? 'Venues unavailable' : venues.length ? 'Select venue' : 'No venues available'}</option>
              {form.venue && !venues.some((venue) => String(venue._id) === String(form.venue)) && <option value={form.venue}>Venue currently assigned to this event</option>}
              {venues.map((venue) => <option key={venue._id} value={venue._id}>{venue.name} · capacity {venue.capacity}</option>)}
            </select>
            {venueError ? <div role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-xs text-red-300"><span>{venueError}</span><button type="button" onClick={loadVenues} className="underline underline-offset-2">Retry</button></div>
              : !venueLoading && !venues.length ? <p className="mt-1 text-xs text-amber-300">No venues exist yet. Add one in <a className="underline underline-offset-2" href="/admin/venues">Venue Management</a>.</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Organizer</label>
            <select
              className="input-field"
              value={form.organizer}
              onChange={(e) => setForm({ ...form, organizer: e.target.value })}
              disabled={staffLoading || Boolean(staffError)}
            >
              <option value="">
                {staffLoading ? 'Loading organizers…' : staffError ? 'Organizers unavailable' : staff.length ? 'Select organizer' : 'No organizers available'}
              </option>
              {form.organizer && !staff.some((member) => String(member._id) === String(form.organizer)) && (
                <option value={form.organizer}>Organizer currently assigned to this event</option>
              )}
              {staff.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
            </select>
            {staffError ? (
              <div role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-xs text-red-300">
                <span>{staffError}</span>
                <button type="button" onClick={loadStaff} className="underline underline-offset-2">Retry</button>
              </div>
            ) : !staffLoading && staff.length === 0 ? (
              <p className="mt-1 text-xs text-amber-300">
                No organizers exist yet. Add a staff member in <a className="underline underline-offset-2" href="/admin/staff">Staff Management</a>.
              </p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="event-staff-search" className="mb-1 block text-sm text-slate-400">Assign Staff</label>
            <input id="event-staff-search" type="search" className="input-field" value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} placeholder="Search staff by name" disabled={staffLoading || Boolean(staffError)} />
            {staffLoading ? <p className="mt-1 text-xs text-slate-400">Loading staff…</p>
              : staffError ? <div role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-xs text-red-300"><span>{staffError}</span><button type="button" onClick={loadStaff} className="underline underline-offset-2">Retry</button></div>
                : !staff.length ? <p className="mt-1 text-xs text-amber-300">No staff members exist yet. Add them in <a className="underline underline-offset-2" href="/admin/staff">Staff Management</a>.</p>
                  : !filteredStaff.length ? <p className="mt-1 text-xs text-slate-400">No staff match that search.</p>
                    : <div className="mt-2 grid gap-2 sm:grid-cols-2">{filteredStaff.map((member) => (
                      <label key={member._id} className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300">
                        <input type="checkbox" checked={form.staff.includes(String(member._id))} onChange={(e) => setForm({ ...form, staff: e.target.checked ? [...new Set([...form.staff, String(member._id)])] : form.staff.filter((id) => id !== String(member._id)) })} />
                        <span>{member.name} · {member.role}{member.isAvailable === false ? ' · unavailable' : ''}</span>
                      </label>
                    ))}</div>}
            <p className="mt-1 text-xs text-slate-500">Unavailable or overlapping staff will be rejected or replaced only with a same-role available staff member in a generated proposal.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="event-resource-search" className="mb-1 block text-sm text-slate-400">Required Resources</label>
            <input id="event-resource-search" type="search" className="input-field" value={resourceSearch} onChange={(e) => setResourceSearch(e.target.value)} placeholder="Search resources by name" disabled={resourceLoading || Boolean(resourceError)} />
            {resourceLoading ? <p className="mt-1 text-xs text-slate-400">Loading resources…</p>
              : resourceError ? <div role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-xs text-red-300"><span>{resourceError}</span><button type="button" onClick={loadResources} className="underline underline-offset-2">Retry</button></div>
                : !resources.length ? <p className="mt-1 text-xs text-amber-300">No resources exist yet. Add them in <a className="underline underline-offset-2" href="/admin/resources">Resource Management</a>.</p>
                  : !filteredResources.length ? <p className="mt-1 text-xs text-slate-400">No resources match that search.</p>
                    : <div className="mt-2 grid gap-2 sm:grid-cols-2">{filteredResources.map((resource) => {
                      const requirement = form.resources.find((item) => String(item.resource) === String(resource._id));
                      return (
                        <div key={resource._id} className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300">
                          <label className="flex min-w-0 flex-1 items-center gap-2">
                            <input type="checkbox" checked={Boolean(requirement)} onChange={(e) => setForm({
                              ...form,
                              resources: e.target.checked
                                ? [...form.resources, { resource: String(resource._id), quantity: 1 }]
                                : form.resources.filter((item) => String(item.resource) !== String(resource._id)),
                            })} />
                            <span>{resource.name} · {resource.available}/{resource.quantity} available{resource.isAvailable === false ? ' · unavailable' : ''}</span>
                          </label>
                          {requirement && <input aria-label={`${resource.name} quantity`} type="number" min="1" max={resource.available} className="input-field max-w-24" value={requirement.quantity} onChange={(e) => setForm({ ...form, resources: form.resources.map((item) => String(item.resource) === String(resource._id) ? { ...item, quantity: e.target.value } : item) })} />}
                        </div>
                      );
                    })}</div>}
            {form.resources.map((requirement) => {
              if (resources.some((item) => String(item._id) === String(requirement.resource))) return null;
              return <p key={requirement.resource} className="mt-2 text-xs text-amber-300">A previously assigned resource is no longer available in the resource list.</p>;
            })}
          </div>
          <div><label className="mb-1 block text-sm text-slate-400">Date *</label><input type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Start</label><input type="time" className="input-field" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">End</label><input type="time" className="input-field" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Expected Audience</label><input type="number" className="input-field" value={form.expectedAudience} onChange={(e) => setForm({ ...form, expectedAudience: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Priority (1-10)</label><input type="number" min="1" max="10" className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Setup buffer (minutes)</label><input type="number" min="0" className="input-field" value={form.setupMinutes} onChange={(e) => setForm({ ...form, setupMinutes: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Cleanup buffer (minutes)</label><input type="number" min="0" className="input-field" value={form.cleanupMinutes} onChange={(e) => setForm({ ...form, cleanupMinutes: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Preferred time starts</label><input type="time" className="input-field" value={form.preferredStart} onChange={(e) => setForm({ ...form, preferredStart: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Preferred time ends</label><input type="time" className="input-field" value={form.preferredEnd} onChange={(e) => setForm({ ...form, preferredEnd: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-slate-400">Required venue facilities (comma separated)</label><input className="input-field" value={form.requiredFacilities} onChange={(e) => setForm({ ...form, requiredFacilities: e.target.value })} placeholder="Projector, Stage" /></div>
          <div><label className="mb-1 block text-sm text-slate-400">Status</label><select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{[...statusOptions, ...(form.status === 'completed' ? ['completed'] : [])].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} /><label className="text-sm text-slate-400">Featured Event</label></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-slate-400">Rules</label><textarea className="input-field" value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} /></div>
          <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex justify-end gap-3 border-t border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur sm:col-span-2"><button type="button" onClick={() => setModal(false)} className="btn-secondary" disabled={isSaving}>Cancel</button><button type="submit" className="btn-primary" disabled={isSaving}>{isSaving ? 'Saving…' : editItem ? 'Save Changes' : 'Save Event'}</button></div>
        </form>
      </Modal>

      <Modal open={!!rescheduleModal} onClose={() => setRescheduleModal(null)} title="Reschedule Event">
        <form onSubmit={handleReschedule} className="space-y-4">
          <input type="date" className="input-field" value={rescheduleForm.date} onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <input type="time" className="input-field" value={rescheduleForm.startTime} onChange={(e) => setRescheduleForm({ ...rescheduleForm, startTime: e.target.value })} />
            <input type="time" className="input-field" value={rescheduleForm.endTime} onChange={(e) => setRescheduleForm({ ...rescheduleForm, endTime: e.target.value })} />
          </div>
          <select className="input-field" value={rescheduleForm.venue} onChange={(e) => setRescheduleForm({ ...rescheduleForm, venue: e.target.value })}>
            <option value="">Select venue</option>{venues.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
          </select>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setRescheduleModal(null)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Reschedule</button></div>
        </form>
      </Modal>

      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title={detailModal?.title} size="lg">
        {detailModal && (
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ['Category', detailModal.category?.name], ['Venue', detailModal.venue?.name], ['Organizer', detailModal.organizer?.name],
              ['Date', formatDate(detailModal.date)], ['Time', `${detailModal.startTime} – ${detailModal.endTime}`],
              ['Audience', detailModal.expectedAudience], ['Registrations', detailModal.registrationCount], ['Priority', detailModal.priority],
              ['Status', detailModal.status], ['Featured', detailModal.isFeatured ? 'Yes' : 'No'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-800/40 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-white">{value ?? '—'}</dd></div>
            ))}
            <div className="sm:col-span-2 rounded-lg bg-slate-800/40 p-3"><dt className="text-xs text-slate-500">Description</dt><dd className="mt-1 text-sm text-slate-300">{detailModal.description || '—'}</dd></div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
