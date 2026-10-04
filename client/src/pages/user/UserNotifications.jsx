import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { notificationAPI } from '../../api/api';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/user/PageHeader';
import EmptyState from '../../components/user/EmptyState';
import Alert from '../../components/user/Alert';

const typeIcons = {
  event_update: '📢',
  schedule_change: '📅',
  cancellation: '❌',
  reminder: '⏰',
  conflict_alert: '⚠️',
  registration: '🎫',
  ai_recommendation: '✨',
  general: '📬',
};

export default function UserNotifications() {
  const { refreshUnread } = useOutletContext() || {};
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: 'info', text: '' });

  const load = () => {
    setLoading(true);
    notificationAPI.list().then(({ data }) => {
      setNotifications(data);
      refreshUnread?.();
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = async (id) => {
    await notificationAPI.markRead(id);
    load();
  };

  const markAllRead = async () => {
    await notificationAPI.markAllRead();
    setMsg({ type: 'success', text: 'All notifications marked as read.' });
    load();
  };

  const deleteNotification = async (id) => {
    await notificationAPI.remove(id);
    setMsg({ type: 'success', text: 'Notification deleted.' });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread of ${notifications.length} total`}
        breadcrumb="Alerts"
        actions={
          unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary">Mark All Read</button>
          )
        }
      />

      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: 'Unread' },
          { key: 'read', label: 'Read' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-4 py-2 text-sm capitalize ${filter === f.key ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : filtered.length ? (
        <div className="space-y-3">
          {filtered.map((n) => (
            <div
              key={n._id}
              className={`card transition ${!n.isRead ? 'border-brand-500/30 bg-brand-500/5' : 'opacity-80'}`}
            >
              <div className="flex gap-4">
                <span className="text-2xl">{typeIcons[n.type] || '📬'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-white">{n.title}</h3>
                    <Badge>{n.type?.replace(/_/g, ' ')}</Badge>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{n.message}</p>
                  <p className="mt-2 text-xs text-slate-600">{new Date(n.createdAt).toLocaleString()}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!n.isRead && (
                      <button onClick={() => markRead(n._id)} className="btn-secondary text-xs">Mark Read</button>
                    )}
                    {n.link && (
                      <Link to={n.link} className="btn-primary text-xs">View</Link>
                    )}
                    <button onClick={() => deleteNotification(n._id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🔔"
          title="No notifications"
          description={filter === 'unread' ? "You're all caught up!" : 'Notifications will appear here when there are updates.'}
        />
      )}
    </div>
  );
}
