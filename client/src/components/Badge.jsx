const severityColors = {
  low: 'bg-slate-500/20 text-slate-300',
  medium: 'bg-amber-500/20 text-amber-300',
  high: 'bg-orange-500/20 text-orange-300',
  critical: 'bg-red-500/20 text-red-300',
};

const statusColors = {
  draft: 'bg-slate-500/20 text-slate-300',
  scheduled: 'bg-blue-500/20 text-blue-300',
  published: 'bg-emerald-500/20 text-emerald-300',
  cancelled: 'bg-red-500/20 text-red-300',
  pending: 'bg-amber-500/20 text-amber-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
  open: 'bg-red-500/20 text-red-300',
  resolved: 'bg-emerald-500/20 text-emerald-300',
};

export default function Badge({ children, variant = 'default', type }) {
  const cls = type ? statusColors[type] || severityColors[type] : 'bg-brand-500/20 text-brand-300';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const formatTime = (t) => t || '—';
