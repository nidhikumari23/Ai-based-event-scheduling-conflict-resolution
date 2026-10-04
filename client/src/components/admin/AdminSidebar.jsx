import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navGroups = [
  {
    label: 'Overview',
    items: [{ to: '/admin', label: 'Dashboard', icon: '📊', end: true }],
  },
  {
    label: 'Master Data',
    items: [
      { to: '/admin/categories', label: 'Categories', icon: '🏷️' },
      { to: '/admin/brands', label: 'Brands & Sponsors', icon: '🤝' },
      { to: '/admin/venues', label: 'Venues', icon: '🏛️' },
      { to: '/admin/resources', label: 'Resources', icon: '📦' },
      { to: '/admin/staff', label: 'Staff', icon: '👥' },
    ],
  },
  {
    label: 'Events & People',
    items: [
      { to: '/admin/events', label: 'Events', icon: '🎭' },
      { to: '/admin/participants', label: 'Participants', icon: '🎫' },
    ],
  },
  {
    label: 'AI & Scheduling',
    items: [
      { to: '/admin/ai-scheduling', label: 'AI Scheduling', icon: '🤖' },
      { to: '/admin/conflicts', label: 'Conflicts', icon: '⚠️' },
      { to: '/admin/schedule', label: 'Schedule', icon: '📅' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { to: '/admin/notifications', label: 'Notifications', icon: '🔔' },
      { to: '/admin/feedback', label: 'Feedback', icon: '💬' },
    ],
  },
  {
    label: 'Analytics',
    items: [{ to: '/admin/reports', label: 'Reports', icon: '📈' }],
  },
  {
    label: 'System',
    items: [{ to: '/admin/settings', label: 'Settings', icon: '⚙️' }],
  },
];

export default function AdminSidebar({ open, onClose }) {
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold shadow-glow">
            MN
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Metro Nexus</p>
            <p className="text-xs text-slate-500">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                          isActive ? 'bg-brand-600/15 text-brand-300' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                        }`
                      }
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-900/80 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600/20 text-sm font-bold text-brand-300">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/" className="btn-secondary flex-1 text-center text-xs">Site</Link>
            <button type="button" onClick={logout} className="btn-danger flex-1 text-xs">Logout</button>
          </div>
        </div>
      </aside>
    </>
  );
}
