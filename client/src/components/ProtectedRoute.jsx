import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

export const ProtectedRoute = ({ adminOnly = false }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Loading fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/user" replace />;
  return <Outlet />;
};

export const PublicOnlyRoute = () => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Loading fullScreen />;
  if (user) return <Navigate to={isAdmin ? '/admin' : '/user'} replace />;
  return <Outlet />;
};
