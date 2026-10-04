export default function PageHeader({ title, subtitle, actions, breadcrumb }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {breadcrumb && <p className="mb-1 text-xs font-medium uppercase tracking-wider text-brand-400">{breadcrumb}</p>}
        <h1 className="font-display text-3xl text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
