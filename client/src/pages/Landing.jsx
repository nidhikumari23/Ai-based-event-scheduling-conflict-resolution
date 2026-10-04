import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicNavbar from '../components/PublicNavbar';
import { eventAPI, settingsAPI } from '../api/api';
import Badge, { formatDate } from '../components/Badge';
import Loading from '../components/Loading';

export default function Landing() {
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      eventAPI.list({ featured: 'true', upcoming: 'true' }),
      settingsAPI.public(),
    ])
      .then(([ev, set]) => {
        setEvents(ev.data.slice(0, 4));
        setSettings(set.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <PublicNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/30 via-slate-950 to-slate-950" />
        <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-600/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 text-center lg:pt-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            AI-Powered Festival Management Platform
          </div>
          <h1 className="font-display text-5xl leading-tight text-white md:text-7xl">
            Orchestrate Unforgettable
            <br />
            <span className="bg-gradient-to-r from-brand-400 to-cyan-400 bg-clip-text text-transparent">
              Festival Experiences
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            {settings?.festivalName || 'Metro Nexus Festival'} — intelligent event scheduling, real-time conflict
            resolution, and personalized attendee journeys powered by OpenAI.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/register" className="btn-primary px-8 py-3 text-base">
              Explore Festival
            </Link>
            <Link to="/login" className="btn-secondary px-8 py-3 text-base">
              Admin Portal
            </Link>
          </div>
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-8 border-t border-slate-800 pt-10">
            {[
              { n: '8+', l: 'Event Categories' },
              { n: 'AI', l: 'Smart Scheduling' },
              { n: '24/7', l: 'Conflict Detection' },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-3xl font-bold text-white">{s.n}</p>
                <p className="text-sm text-slate-500">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-slate-800 bg-slate-900/30 py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <h2 className="font-display text-4xl text-white">Enterprise-Grade Festival OS</h2>
            <p className="mt-4 text-slate-400">Everything you need to manage large-scale festivals</p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: '🤖', title: 'AI Schedule Generation', desc: 'OpenAI-powered optimization for venues, resources, and priorities.' },
              { icon: '⚡', title: 'Conflict Resolution', desc: 'Detect timing, venue, resource, and staff conflicts in real-time.' },
              { icon: '🎭', title: 'Event Management', desc: 'Full lifecycle control from draft to publish with rescheduling.' },
              { icon: '🏛️', title: 'Venue Orchestration', desc: 'Capacity tracking, maintenance blocks, and booking status.' },
              { icon: '🎫', title: 'Participant Portal', desc: 'Registration, personal schedules, and AI recommendations.' },
              { icon: '📊', title: 'Analytics & Reports', desc: 'Participation, utilization, and AI performance insights.' },
            ].map((f) => (
              <div key={f.title} className="card group transition hover:border-brand-500/30 hover:shadow-glow">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-4 text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Events */}
      <section id="events" className="py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-4xl text-white">Featured Events</h2>
              <p className="mt-2 text-slate-400">Don't miss these highlight performances</p>
            </div>
            <Link to="/register" className="btn-secondary hidden sm:inline-flex">
              View All Events
            </Link>
          </div>
          {loading ? (
            <Loading />
          ) : (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {events.map((ev) => (
                <div key={ev._id} className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 transition hover:border-brand-500/30">
                  <div className="aspect-video bg-gradient-to-br from-brand-900/40 to-slate-800 flex items-center justify-center">
                    <span className="text-4xl opacity-50">🎪</span>
                  </div>
                  <div className="p-5">
                    <Badge type="published">{ev.category?.name}</Badge>
                    <h3 className="mt-3 font-semibold text-white group-hover:text-brand-300">{ev.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-400">{ev.description}</p>
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDate(ev.date)}</span>
                      <span>{ev.startTime}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* AI Section */}
      <section id="ai" className="border-t border-slate-800 bg-gradient-to-b from-brand-950/20 to-slate-950 py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-4xl text-white">Powered by OpenAI</h2>
              <p className="mt-4 text-slate-400 leading-relaxed">
                Our AI engine analyzes events, venues, resources, and participant preferences to generate
                optimized schedules, detect conflicts, and deliver personalized festival plans.
              </p>
              <ul className="mt-8 space-y-3">
                {['Smart venue allocation', 'Priority-based ordering', 'Personal event recommendations', 'Conflict resolution suggestions'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/20 text-xs text-brand-400">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 font-mono text-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="ml-2 text-slate-500">AI Scheduler</span>
              </div>
              <pre className="overflow-x-auto text-slate-300">
{`> Analyzing 8 events across 8 venues...
> Detected 2 timing conflicts
> Optimizing by priority score...

✓ Opening Night Concert → Main Stage 18:00
✓ Tech Summit → Innovation Arena 10:00
⚠ Suggest: Move Dance Showcase to 10:00

Schedule confidence: 94%`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-3xl text-white">Ready to experience the festival?</h2>
          <p className="mt-4 text-slate-400">Register now and get AI-powered personalized recommendations.</p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/register" className="btn-primary px-8 py-3">
              Create Account
            </Link>
            <Link to="/login" className="btn-secondary px-8 py-3">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
        © 2026 Metro Nexus Festival OS. AI-Based Dynamic Event Scheduling System.
      </footer>
    </div>
  );
}
