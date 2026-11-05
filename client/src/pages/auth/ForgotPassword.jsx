import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../../api/api';

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authAPI.forgotPassword(email);
      setResult(data);
    } catch (err) {
      setResult({ message: err.response?.data?.message || 'Error', error: true });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authAPI.resetPassword({ token, password });
      setResult(data);
    } catch (err) {
      setResult({ message: err.response?.data?.message || 'Error', error: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl text-white">{token ? 'Choose a New Password' : 'Reset Password'}</h1>
          <p className="mt-2 text-sm text-slate-400">
            {token ? 'The reset link expires after 15 minutes.' : 'Enter your email to receive a secure reset link.'}
          </p>
        </div>
        {!token && <form onSubmit={handleForgot} className="card mb-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">Email</label>
            <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            Send Reset Link
          </button>
        </form>}
        {token && <form onSubmit={handleReset} className="card space-y-4">
            <input type="password" className="input-field" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} autoComplete="new-password" required />
            <p className="text-xs text-slate-500">Use 12–128 characters with lowercase, uppercase, a number, and a symbol.</p>
            <button type="submit" className="btn-primary w-full">Reset Password</button>
          </form>}
        {result?.message && (
          <p className={`mt-4 text-center text-sm ${result.error ? 'text-red-400' : 'text-emerald-400'}`}>{result.message}</p>
        )}
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-brand-400">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
