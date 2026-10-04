import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicNavbar() {
  const { user, isAdmin } = useAuth();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold shadow-glow">
            MN
          </div>
          <div>
            <span className="font-display text-xl text-white">Metro Nexus</span>
            <span className="ml-2 hidden rounded-full bg-brand-500/20 px-2 py-0.5 text-xs text-brand-300 sm:inline">
              Festival OS
            </span>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-slate-400 transition hover:text-white">
            Features
          </a>
          <a href="#events" className="text-sm text-slate-400 transition hover:text-white">
            Events
          </a>
          <a href="#ai" className="text-sm text-slate-400 transition hover:text-white">
            AI Engine
          </a>
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <Link to={isAdmin ? '/admin' : '/user'} className="btn-primary text-sm">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="hidden text-sm text-slate-300 hover:text-white sm:block">
                Sign In
              </Link>
              <Link to="/register" className="btn-primary text-sm">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
