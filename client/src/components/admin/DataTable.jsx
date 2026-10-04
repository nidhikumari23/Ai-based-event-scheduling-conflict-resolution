import { useMemo, useState } from 'react';
import EmptyState from './EmptyState';

export default function DataTable({
  columns,
  data,
  searchKeys = [],
  searchPlaceholder = 'Search records...',
  actions,
  onRowClick,
  emptyTitle = 'No records found',
  emptyDescription,
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(() => {
    let rows = [...data];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((row) =>
        searchKeys.some((key) => String(row[key] ?? '').toLowerCase().includes(q)) ||
        columns.some((c) => {
          const val = c.render ? '' : row[c.key];
          return String(val ?? '').toLowerCase().includes(q);
        })
      );
    }
    if (sortKey) {
      rows.sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return rows;
  }, [data, search, sortKey, sortDir, searchKeys, columns]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="input-field max-w-sm"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="text-sm text-slate-500">{filtered.length} of {data.length} records</p>
      </div>

      {filtered.length ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3 font-medium">
                    {c.sortable ? (
                      <button type="button" onClick={() => toggleSort(c.key)} className="flex items-center gap-1 hover:text-white">
                        {c.label}
                        {sortKey === c.key && <span className="text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    ) : c.label}
                  </th>
                ))}
                {actions && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((row) => (
                <tr
                  key={row._id}
                  className={`transition hover:bg-slate-900/50 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-slate-300">
                      {c.render ? c.render(row) : row[c.key] ?? '—'}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </div>
  );
}
