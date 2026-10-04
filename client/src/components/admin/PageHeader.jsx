export default function PageHeader({ title, subtitle, breadcrumb, actions, stats }) {
  return (
    <div className="mb-8 space-y-4 border-b border-slate-800 pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {breadcrumb && <p className="mb-1 text-xs font-medium uppercase tracking-wider text-brand-400">{breadcrumb}</p>}
          <h1 className="font-display text-3xl text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {stats?.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
