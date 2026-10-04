import { Link } from 'react-router-dom';
import Badge, { formatDate } from '../Badge';

export default function EventCard({ event, actions, compact = false }) {
  if (!event) return null;

  const seatsLeft = event.venue ? Math.max(0, event.venue.capacity - (event.registrationCount || 0)) : null;
  const fillPercent = event.venue ? Math.min(100, ((event.registrationCount || 0) / event.venue.capacity) * 100) : 0;

  return (
    <div className={`group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 transition hover:border-brand-500/30 hover:shadow-glow ${compact ? '' : 'flex flex-col'}`}>
      <div className={`relative bg-gradient-to-br from-brand-900/30 via-slate-800 to-slate-900 ${compact ? 'h-28' : 'aspect-[16/10]'}`}>
        {event.poster ? (
          <img src={event.poster} alt={event.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className={`opacity-40 ${compact ? 'text-3xl' : 'text-5xl'}`}>🎪</span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {event.category?.name && <Badge>{event.category.name}</Badge>}
          {event.isFeatured && <Badge type="published">Featured</Badge>}
        </div>
      </div>

      <div className={`flex flex-1 flex-col p-5 ${compact ? 'p-4' : ''}`}>
        <Link to={`/user/events/${event._id}`} className={`font-semibold text-white transition hover:text-brand-300 ${compact ? 'text-base' : 'text-lg'}`}>
          {event.title}
        </Link>
        {!compact && event.description && (
          <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-400">{event.description}</p>
        )}

        <div className="mt-4 space-y-2 text-xs text-slate-500">
          <div className="flex items-center justify-between gap-2">
            <span>📅 {formatDate(event.date)}</span>
            <span>🕐 {event.startTime} – {event.endTime}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>📍 {event.venue?.name || 'TBD'}</span>
            {seatsLeft !== null && (
              <span className={seatsLeft < 20 ? 'text-amber-400' : 'text-slate-500'}>{seatsLeft} seats left</span>
            )}
          </div>
        </div>

        {seatsLeft !== null && !compact && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${fillPercent}%` }} />
            </div>
          </div>
        )}

        {actions && <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-4">{actions}</div>}
      </div>
    </div>
  );
}
