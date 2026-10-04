import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/user', label: 'Dashboard', icon: '📊', end: true },
  { to: '/user/events', label: 'Browse Events', icon: '🎭' },
  { to: '/user/registrations', label: 'My Registrations', icon: '🎫' },
  { to: '/user/personal-schedule', label: 'Personal Schedule', icon: '📋' },
  { to: '/user/schedule', label: 'Festival Schedule', icon: '📅' },
  { to: '/user/recommendations', label: 'AI Recommendations', icon: '✨' },
  { to: '/user/feedback', label: 'My Feedback', icon: '💬' },
  { to: '/user/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/user/profile', label: 'Profile & Settings', icon: '⚙️' },
];

export default function UserSidebar({ open, onClose, unreadCount = 0 }) {
  const { user, logout } = useAuth();

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800 bg-slate-950 transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold shadow-glow">
              MN
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Metro Nexus</p>
              <p className="text-xs text-slate-500">Participant Portal</p>
            </div>
          </Link>
        </div>

        <div className="border-b border-slate-800 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-900/80 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600/20 text-sm font-bold text-brand-300">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-600/15 text-brand-300'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`
                  }
                >
                  <span>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.to === '/user/notifications' && unreadCount > 0 && (
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">{unreadCount}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="flex gap-2">
            <Link to="/" className="btn-secondary flex-1 text-center text-xs">Home</Link>
            <button onClick={logout} className="btn-danger flex-1 text-xs">Logout</button>
          </div>
        </div>
      </aside>
    </>
  );
}
