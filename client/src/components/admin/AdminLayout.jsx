import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { dashboardAPI } from '../../api/api';
import AdminSidebar from './AdminSidebar';

const pageTitles = {
  '/admin': 'Dashboard',
  '/admin/categories': 'Event Categories',
  '/admin/brands': 'Brands & Sponsors',
  '/admin/venues': 'Venue Management',
  '/admin/resources': 'Resource Management',
  '/admin/staff': 'Staff Management',
  '/admin/events': 'Event Management',
  '/admin/participants': 'Participant Management',
  '/admin/ai-scheduling': 'AI Scheduling',
  '/admin/conflicts': 'Conflict Resolution',
  '/admin/schedule': 'Schedule Management',
  '/admin/notifications': 'Notifications',
  '/admin/reports': 'Reports & Analytics',
  '/admin/feedback': 'Feedback Management',
  '/admin/settings': 'System Settings',
};

export default function AdminLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openConflicts, setOpenConflicts] = useState(0);

  useEffect(() => {
    dashboardAPI.admin().then(({ data }) => setOpenConflicts(data.stats?.openConflicts || 0)).catch(() => {});
  }, [location.pathname]);

  const title = Object.entries(pageTitles).find(([path]) =>
    path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path) && path !== '/admin'
  )?.[1] || 'Admin Console';

  return (
    <div className="flex min-h-screen bg-slate-950">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-800 bg-slate-950/90 px-4 backdrop-blur lg:px-8">
          <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden" aria-label="Open menu">☰</button>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-brand-400">Festival Management Console</p>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            {openConflicts > 0 && (
              <Link to="/admin/conflicts" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300">
                {openConflicts} open conflict{openConflicts !== 1 ? 's' : ''}
              </Link>
            )}
            <Link to="/admin/ai-scheduling" className="btn-secondary text-xs">AI Scheduler</Link>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
