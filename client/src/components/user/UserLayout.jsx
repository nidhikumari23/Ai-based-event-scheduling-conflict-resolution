import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationAPI } from '../../api/api';
import UserSidebar from './UserSidebar';

const pageTitles = {
  '/user': 'Dashboard',
  '/user/events': 'Browse Events',
  '/user/registrations': 'My Registrations',
  '/user/personal-schedule': 'Personal Schedule',
  '/user/schedule': 'Festival Schedule',
  '/user/recommendations': 'AI Recommendations',
  '/user/feedback': 'My Feedback',
  '/user/notifications': 'Notifications',
  '/user/profile': 'Profile & Settings',
};

export default function UserLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notificationAPI.list().then(({ data }) => {
      setUnreadCount(data.filter((n) => !n.isRead).length);
    }).catch(() => {});
  }, [location.pathname]);

  const title = location.pathname.includes('/events/')
    ? 'Event Details'
    : Object.entries(pageTitles).find(([path]) =>
        path === '/user' ? location.pathname === '/user' : location.pathname.startsWith(path) && path !== '/user'
      )?.[1] || 'Participant Portal';

  return (
    <div className="flex min-h-screen bg-slate-950">
      <UserSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} unreadCount={unreadCount} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-800 bg-slate-950/90 px-4 backdrop-blur lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
            aria-label="Open menu"
          >
            ☰
          </button>

          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-brand-400">Participant Portal</p>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/user/notifications"
              className="relative rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600/20 text-xs font-bold text-brand-300">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <span className="text-sm text-slate-300">{user?.name?.split(' ')[0]}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          <Outlet context={{ refreshUnread: () => notificationAPI.list().then(({ data }) => setUnreadCount(data.filter((n) => !n.isRead).length)) }} />
        </main>
      </div>
    </div>
  );
}
