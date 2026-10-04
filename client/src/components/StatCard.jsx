export default function StatCard({ label, value, icon, trend, color = 'brand' }) {
  const colors = {
    brand: 'from-brand-600/20 to-brand-900/10 border-brand-500/20',
    emerald: 'from-emerald-600/20 to-emerald-900/10 border-emerald-500/20',
    amber: 'from-amber-600/20 to-amber-900/10 border-amber-500/20',
    rose: 'from-rose-600/20 to-rose-900/10 border-rose-500/20',
    cyan: 'from-cyan-600/20 to-cyan-900/10 border-cyan-500/20',
  };
  return (
    <div className={`stat-card border bg-gradient-to-br ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {trend && <p className="mt-1 text-xs text-slate-500">{trend}</p>}
        </div>
        {icon && <span className="text-2xl opacity-80">{icon}</span>}
      </div>
    </div>
  );
}
