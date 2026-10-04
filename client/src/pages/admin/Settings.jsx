import { useEffect, useState } from 'react';
import { settingsAPI, authAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/Loading';
import PageHeader from '../../components/admin/PageHeader';
import Alert from '../../components/admin/Alert';

export default function Settings() {
  const { updateUser } = useAuth();
  const [settings, setSettings] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [tab, setTab] = useState('festival');

  useEffect(() => {
    settingsAPI.get().then(({ data }) => {
      setSettings(data);
    }).finally(() => setLoading(false));
    authAPI.getMe().then(({ data }) => setProfile({ name: data.name, phone: data.phone || '' }));
  }, []);

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      await settingsAPI.update(settings);
      setMsg({ type: 'success', text: 'Settings saved successfully.' });
    } catch {
      setMsg({ type: 'error', text: 'Failed to save settings.' });
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const { data } = await authAPI.updateProfile(profile);
    updateUser(data);
    setMsg({ type: 'success', text: 'Profile updated.' });
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      setMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    await authAPI.changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
    setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setMsg({ type: 'success', text: 'Password updated.' });
  };

  if (loading) return <Loading />;

  const tabs = [
    { key: 'festival', label: 'Festival' },
    { key: 'scheduling', label: 'Scheduling Rules' },
    { key: 'ai', label: 'OpenAI' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'account', label: 'Admin Account' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="System Settings" subtitle="Configure festival, AI, and admin preferences" breadcrumb="System" />
      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="flex flex-wrap gap-2 border-b border-slate-800">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === t.key ? 'border-brand-500 text-brand-300' : 'border-transparent text-slate-400'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'festival' && (
        <form onSubmit={saveSettings} className="card space-y-4">
          <h3 className="font-semibold text-white">Festival Configuration</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm text-slate-400">Festival Name</label><input className="input-field" value={settings.festivalName || ''} onChange={(e) => setSettings({ ...settings, festivalName: e.target.value })} /></div>
            <div><label className="mb-1 block text-sm text-slate-400">Contact Email</label><input className="input-field" value={settings.contactEmail || ''} onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })} /></div>
            <div><label className="mb-1 block text-sm text-slate-400">Contact Phone</label><input className="input-field" value={settings.contactPhone || ''} onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })} /></div>
            <div><label className="mb-1 block text-sm text-slate-400">Start Date</label><input type="date" className="input-field" value={settings.festivalStartDate ? new Date(settings.festivalStartDate).toISOString().split('T')[0] : ''} onChange={(e) => setSettings({ ...settings, festivalStartDate: e.target.value })} /></div>
            <div><label className="mb-1 block text-sm text-slate-400">End Date</label><input type="date" className="input-field" value={settings.festivalEndDate ? new Date(settings.festivalEndDate).toISOString().split('T')[0] : ''} onChange={(e) => setSettings({ ...settings, festivalEndDate: e.target.value })} /></div>
          </div>
          <button type="submit" className="btn-primary">Save Festival Settings</button>
        </form>
      )}

      {tab === 'scheduling' && (
        <form onSubmit={saveSettings} className="card space-y-4">
          <h3 className="font-semibold text-white">Scheduling Rules</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm text-slate-400">Min Gap Between Events (minutes)</label><input type="number" className="input-field" value={settings.schedulingRules?.minGapMinutes || 30} onChange={(e) => setSettings({ ...settings, schedulingRules: { ...settings.schedulingRules, minGapMinutes: Number(e.target.value) } })} /></div>
            <div><label className="mb-1 block text-sm text-slate-400">Max Events Per Venue Per Day</label><input type="number" className="input-field" value={settings.schedulingRules?.maxEventsPerVenuePerDay || 5} onChange={(e) => setSettings({ ...settings, schedulingRules: { ...settings.schedulingRules, maxEventsPerVenuePerDay: Number(e.target.value) } })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={settings.schedulingRules?.allowOverlapHighPriority || false} onChange={(e) => setSettings({ ...settings, schedulingRules: { ...settings.schedulingRules, allowOverlapHighPriority: e.target.checked } })} />
            Allow overlap for high-priority events
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm text-slate-400">Featured Event Priority Boost</label><input type="number" className="input-field" value={settings.priorityRules?.featuredBoost || 2} onChange={(e) => setSettings({ ...settings, priorityRules: { ...settings.priorityRules, featuredBoost: Number(e.target.value) } })} /></div>
            <div><label className="mb-1 block text-sm text-slate-400">Audience Weight Factor</label><input type="number" step="0.1" className="input-field" value={settings.priorityRules?.audienceWeight || 0.3} onChange={(e) => setSettings({ ...settings, priorityRules: { ...settings.priorityRules, audienceWeight: Number(e.target.value) } })} /></div>
          </div>
          <button type="submit" className="btn-primary">Save Scheduling Rules</button>
        </form>
      )}

      {tab === 'ai' && (
        <form onSubmit={saveSettings} className="card space-y-4">
          <h3 className="font-semibold text-white">OpenAI Configuration</h3>
          <p className="text-sm text-slate-500">Configure your OpenAI API key for AI scheduling and recommendations. Without a key, rule-based fallbacks are used.</p>
          <div><label className="mb-1 block text-sm text-slate-400">OpenAI API Key</label><input type="password" className="input-field" value={settings.openaiApiKey || ''} onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })} placeholder="sk-..." /></div>
          <button type="submit" className="btn-primary">Save API Key</button>
        </form>
      )}

      {tab === 'notifications' && (
        <form onSubmit={saveSettings} className="card space-y-4">
          <h3 className="font-semibold text-white">Notification Preferences</h3>
          <label className="flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={settings.notificationEmail !== false} onChange={(e) => setSettings({ ...settings, notificationEmail: e.target.checked })} />Enable email notifications</label>
          <label className="flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={settings.notificationPush !== false} onChange={(e) => setSettings({ ...settings, notificationPush: e.target.checked })} />Enable push notifications</label>
          <button type="submit" className="btn-primary">Save Preferences</button>
        </form>
      )}

      {tab === 'account' && (
        <div className="space-y-6">
          <form onSubmit={saveProfile} className="card space-y-4">
            <h3 className="font-semibold text-white">Admin Profile</h3>
            <div><label className="mb-1 block text-sm text-slate-400">Name</label><input className="input-field" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
            <div><label className="mb-1 block text-sm text-slate-400">Phone</label><input className="input-field" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
            <button type="submit" className="btn-primary">Update Profile</button>
          </form>
          <form onSubmit={changePassword} className="card space-y-4">
            <h3 className="font-semibold text-white">Change Password</h3>
            <input type="password" className="input-field" placeholder="Current password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} required />
            <input type="password" className="input-field" placeholder="New password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} required />
            <input type="password" className="input-field" placeholder="Confirm new password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} required />
            <button type="submit" className="btn-secondary">Update Password</button>
          </form>
        </div>
      )}
    </div>
  );
}
