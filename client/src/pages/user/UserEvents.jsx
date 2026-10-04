import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventAPI, categoryAPI, venueAPI, registrationAPI, userPortalAPI } from '../../api/api';
import Loading from '../../components/Loading';
import PageHeader from '../../components/user/PageHeader';
import EventCard from '../../components/user/EventCard';
import EmptyState from '../../components/user/EmptyState';
import Alert from '../../components/user/Alert';

export default function UserEvents() {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [venues, setVenues] = useState([]);
  const [myRegs, setMyRegs] = useState([]);
  const [personalIds, setPersonalIds] = useState([]);
  const [filters, setFilters] = useState({ search: '', category: '', venue: '', date: '', featured: false, sort: 'date' });
  const [viewMode, setViewMode] = useState('grid');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: 'info', text: '' });

  useEffect(() => {
    Promise.all([categoryAPI.list(), venueAPI.list(), registrationAPI.my(), userPortalAPI.personalSchedule()])
      .then(([c, v, regs, schedule]) => {
        setCategories(c.data);
        setVenues(v.data);
        setMyRegs(regs.data);
        setPersonalIds(schedule.data.map((e) => e._id));
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { status: 'published', upcoming: 'true' };
    if (filters.search) params.search = filters.search;
    if (filters.category) params.category = filters.category;
    if (filters.venue) params.venue = filters.venue;
    if (filters.date) params.date = filters.date;
    if (filters.featured) params.featured = 'true';
    eventAPI.list(params).then(({ data }) => {
      let sorted = [...data];
      if (filters.sort === 'priority') sorted.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      else if (filters.sort === 'audience') sorted.sort((a, b) => (b.expectedAudience || 0) - (a.expectedAudience || 0));
      else sorted.sort((a, b) => new Date(a.date) - new Date(b.date) || a.startTime.localeCompare(b.startTime));
      setEvents(sorted);
    }).finally(() => setLoading(false));
  }, [filters]);

  const isRegistered = (id) => myRegs.some((r) => r.event?._id === id && r.status !== 'cancelled');
  const regStatus = (id) => myRegs.find((r) => r.event?._id === id)?.status;
  const inPersonalSchedule = (id) => personalIds.includes(id);

  const handleRegister = async (eventId) => {
    try {
      await registrationAPI.register(eventId);
      const { data } = await registrationAPI.my();
      setMyRegs(data);
      setMsg({ type: 'success', text: 'Registration submitted — awaiting admin approval.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Registration failed' });
    }
  };

  const handleAddToPlan = async (eventId) => {
    try {
      const { data } = await userPortalAPI.addToSchedule(eventId);
      setPersonalIds(data.map((e) => e._id));
      setMsg({ type: 'success', text: 'Added to your personal schedule.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Could not add to schedule' });
    }
  };

  const clearFilters = () => setFilters({ search: '', category: '', venue: '', date: '', featured: false, sort: 'date' });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Browse Events"
        subtitle={`${events.length} upcoming events available`}
        breadcrumb="Discover"
        actions={
          <div className="flex gap-2">
            <button onClick={() => setViewMode('grid')} className={`rounded-lg px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Grid</button>
            <button onClick={() => setViewMode('list')} className={`rounded-lg px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}>List</button>
          </div>
        }
      />

      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="card">
        <div className="grid gap-4 lg:grid-cols-6">
          <input className="input-field lg:col-span-2" placeholder="Search events..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <select className="input-field" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select className="input-field" value={filters.venue} onChange={(e) => setFilters({ ...filters, venue: e.target.value })}>
            <option value="">All Venues</option>
            {venues.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
          </select>
          <input type="date" className="input-field" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          <select className="input-field" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
            <option value="date">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="audience">Sort by Audience</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={filters.featured} onChange={(e) => setFilters({ ...filters, featured: e.target.checked })} />
            Featured events only
          </label>
          <button onClick={clearFilters} className="text-sm text-brand-400 hover:text-brand-300">Clear filters</button>
        </div>
      </div>

      {loading ? <Loading /> : events.length ? (
        <div className={viewMode === 'grid' ? 'grid gap-6 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-4'}>
          {events.map((ev) => (
            <EventCard
              key={ev._id}
              event={ev}
              compact={viewMode === 'list'}
              actions={
                <>
                  <Link to={`/user/events/${ev._id}`} className="btn-secondary text-xs">View Details</Link>
                  {!isRegistered(ev._id) ? (
                    <button onClick={() => handleRegister(ev._id)} className="btn-primary text-xs">Register</button>
                  ) : (
                    <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                      {regStatus(ev._id) === 'approved' ? '✓ Registered' : `⏳ ${regStatus(ev._id)}`}
                    </span>
                  )}
                  {!inPersonalSchedule(ev._id) ? (
                    <button onClick={() => handleAddToPlan(ev._id)} className="btn-secondary text-xs">+ My Plan</button>
                  ) : (
                    <span className="text-xs text-cyan-400">In personal plan</span>
                  )}
                </>
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🔍"
          title="No events found"
          description="Try adjusting your filters or check back later for new events."
          action={<button onClick={clearFilters} className="btn-primary">Clear Filters</button>}
        />
      )}
    </div>
  );
}
