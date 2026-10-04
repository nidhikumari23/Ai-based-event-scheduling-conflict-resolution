import { useEffect, useState } from 'react';
import { authAPI, registrationAPI, userPortalAPI, feedbackAPI } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import Badge, { formatDate } from '../../components/Badge';
import Loading from '../../components/Loading';
import PageHeader from '../../components/user/PageHeader';
import Alert from '../../components/user/Alert';

const interestOptions = ['Music', 'Dance', 'Drama', 'Technical', 'Sports', 'Food', 'Cultural', 'Art'];

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    interests: user?.interests || [],
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState({ type: 'info', text: '' });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    Promise.all([
      userPortalAPI.stats(),
      registrationAPI.my(),
      feedbackAPI.my(),
    ]).then(([s, regs, fb]) => {
      setStats({ ...s.data, registrations: regs.data, feedback: fb.data });
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        phone: user.phone || '',
        interests: user.interests || [],
      });
    }
  }, [user]);

  const toggleInterest = (interest) => {
    setProfile((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const { data } = await authAPI.updateProfile(profile);
      updateUser(data);
      setMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Update failed' });
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      setMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (passwords.newPassword.length < 6) {
      setMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    try {
      await authAPI.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMsg({ type: 'success', text: 'Password changed successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Password change failed' });
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Profile & Settings"
        subtitle="Manage your account, preferences, and security"
        breadcrumb="Account"
      />

      <Alert type={msg.type} message={msg.text} onClose={() => setMsg({ type: 'info', text: '' })} />

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-brand-950/30 to-slate-900/50">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-600/20 text-3xl font-bold text-brand-300">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-white">{user?.name}</h2>
            <p className="text-slate-400">{user?.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge type="approved">Active Participant</Badge>
              {profile.interests.slice(0, 3).map((i) => <Badge key={i}>{i}</Badge>)}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center sm:gap-6">
            <div>
              <p className="text-xl font-bold text-white">{stats?.registrations?.total || 0}</p>
              <p className="text-xs text-slate-500">Registrations</p>
            </div>
            <div>
              <p className="text-xl font-bold text-white">{stats?.personalScheduleCount || 0}</p>
              <p className="text-xs text-slate-500">Plan Items</p>
            </div>
            <div>
              <p className="text-xl font-bold text-white">{stats?.feedbackCount || 0}</p>
              <p className="text-xs text-slate-500">Reviews</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-800">
        {[
          { key: 'profile', label: 'Profile' },
          { key: 'interests', label: 'Interests' },
          { key: 'security', label: 'Security' },
          { key: 'activity', label: 'Activity' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
              activeTab === tab.key ? 'border-brand-500 text-brand-300' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <form onSubmit={saveProfile} className="card space-y-5">
          <h3 className="font-semibold text-white">Personal Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Full Name</label>
              <input className="input-field" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Email Address</label>
              <input className="input-field cursor-not-allowed opacity-60" value={user?.email} disabled />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Phone Number</label>
              <input className="input-field" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+1-555-0000" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Member Since</label>
              <input className="input-field cursor-not-allowed opacity-60" value={user?.createdAt ? formatDate(user.createdAt) : '—'} disabled />
            </div>
          </div>
          <button type="submit" className="btn-primary">Save Profile</button>
        </form>
      )}

      {activeTab === 'interests' && (
        <form onSubmit={saveProfile} className="card space-y-5">
          <div>
            <h3 className="font-semibold text-white">Event Interests</h3>
            <p className="mt-1 text-sm text-slate-500">Select categories you're interested in for better AI recommendations</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {interestOptions.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  profile.interests.includes(interest)
                    ? 'bg-brand-600 text-white'
                    : 'border border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
          <button type="submit" className="btn-primary">Save Interests</button>
        </form>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          <form onSubmit={changePassword} className="card space-y-4">
            <h3 className="font-semibold text-white">Change Password</h3>
            <input type="password" className="input-field" placeholder="Current password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} required />
            <input type="password" className="input-field" placeholder="New password (min 6 characters)" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} required />
            <input type="password" className="input-field" placeholder="Confirm new password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} required />
            <button type="submit" className="btn-primary">Update Password</button>
          </form>
          <div className="card">
            <h3 className="font-semibold text-white">Account Actions</h3>
            <p className="mt-2 text-sm text-slate-500">Sign out from your account on this device.</p>
            <button onClick={logout} className="btn-danger mt-4">Logout</button>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="mb-4 font-semibold text-white">Recent Registrations</h3>
            {stats?.registrations?.slice(0, 5).map((r) => (
              <div key={r._id} className="flex items-center justify-between border-b border-slate-800 py-3 last:border-0">
                <span className="text-sm text-white">{r.event?.title}</span>
                <Badge type={r.status}>{r.status}</Badge>
              </div>
            ))}
            {!stats?.registrations?.length && <p className="text-sm text-slate-500">No activity yet</p>}
          </div>
          <div className="card">
            <h3 className="mb-4 font-semibold text-white">Festival Info</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between py-2"><dt className="text-slate-500">Festival</dt><dd className="text-white">{stats?.festival?.name}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-slate-500">Starts</dt><dd className="text-white">{formatDate(stats?.festival?.startDate)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-slate-500">Ends</dt><dd className="text-white">{formatDate(stats?.festival?.endDate)}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
