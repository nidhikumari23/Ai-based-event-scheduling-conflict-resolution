import { useEffect, useState } from 'react';
import { reportAPI } from '../../api/api';
import Loading from '../../components/Loading';
import PageHeader from '../../components/admin/PageHeader';
import DataTable from '../../components/admin/DataTable';
import Alert from '../../components/admin/Alert';

const reportTypes = {
  participation: { label: 'Event Participation', fn: reportAPI.participation, desc: 'Registration fill rates per event' },
  venues: { label: 'Venue Utilization', fn: reportAPI.venues, desc: 'Booking density by venue' },
  resources: { label: 'Resource Utilization', fn: reportAPI.resources, desc: 'Equipment usage stats' },
  conflicts: { label: 'Conflict Report', fn: reportAPI.conflicts, desc: 'All scheduling conflicts' },
  registrations: { label: 'Registration Stats', fn: reportAPI.registrations, desc: 'Status breakdown' },
  cancelled: { label: 'Cancelled Events', fn: reportAPI.cancelled, desc: 'Cancelled event log' },
  'ai-schedule': { label: 'AI Schedule Performance', fn: reportAPI.aiSchedule, desc: 'AI generation metrics' },
};

export default function Reports() {
  const [activeReport, setActiveReport] = useState('participation');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: 'info', text: '' });

  useEffect(() => {
    setLoading(true);
    reportTypes[activeReport].fn().then(({ data: d }) => setData(Array.isArray(d) ? d : [d])).catch(() => setMsg({ type: 'error', text: 'Failed to load report' })).finally(() => setLoading(false));
  }, [activeReport]);

  const exportReport = async () => {
    try {
      const type = activeReport === 'participation' ? 'participation' : 'registrations';
      const { data: blob } = await reportAPI.export(type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeReport}-report.xlsx`;
      a.click();
      setMsg({ type: 'success', text: 'Excel report downloaded.' });
    } catch {
      setMsg({ type: 'error', text: 'Export failed.' });
    }
  };

  const columns = data?.[0] ? Object.keys(data[0]).map((key) => ({
    key,
    label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
    render: (row) => {
      const val = row[key];
      if (val && typeof val === 'object') return JSON.stringify(val);
      return String(val ?? '—');
    },
  })) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" subtitle="Festival performance insights and exports" breadcrumb="Analytics"
        actions={<button type="button" onClick={exportReport} className="btn-primary">Export Excel</button>} />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(reportTypes).map(([key, r]) => (
          <button key={key} type="button" onClick={() => setActiveReport(key)}
            className={`rounded-xl border p-4 text-left transition ${activeReport === key ? 'border-brand-500/50 bg-brand-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}>
            <p className="font-medium text-white">{r.label}</p>
            <p className="mt-1 text-xs text-slate-500">{r.desc}</p>
          </button>
        ))}
      </div>

      <div className="card">
        <h3 className="mb-4 font-semibold text-white">{reportTypes[activeReport].label}</h3>
        {loading ? <Loading /> : data?.length ? (
          <DataTable columns={columns} data={data} searchKeys={columns.map((c) => c.key)} />
        ) : (
          <p className="py-8 text-center text-slate-500">No data available for this report</p>
        )}
      </div>
    </div>
  );
}
