import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'admin' ? '/admin' : '/user');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-900/20 via-slate-950 to-slate-950" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold">MN</div>
          </Link>
          <h1 className="mt-4 font-display text-3xl text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to your festival account</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">Email</label>
            <input
              type="email"
              className="input-field"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="admin@metronexus.com"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">Password</label>
            <input
              type="password"
              className="input-field"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm text-brand-400 hover:text-brand-300">
              Forgot password?
            </Link>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <p className="text-center text-sm text-slate-500">
            No account?{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300">
              Register
            </Link>
          </p>
          <div className="rounded-lg bg-slate-800/50 p-3 text-xs text-slate-500">
            <p>Demo Admin: admin@metronexus.com / admin123</p>
            <p>Demo User: sarah@example.com / user123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
