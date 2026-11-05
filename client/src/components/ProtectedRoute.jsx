import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

export const ProtectedRoute = ({ adminOnly = false, adminOrOrganizer = false }) => {
  const { user, loading, isAdmin, isOrganizer } = useAuth();
  const location = useLocation();
  if (loading) return <Loading fullScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/user" replace />;
  if (adminOrOrganizer && !isAdmin && !isOrganizer) return <Navigate to="/user" replace />;
  return <Outlet />;
};

export const PublicOnlyRoute = () => {
  const { user, loading, isAdmin, isOrganizer } = useAuth();
  if (loading) return <Loading fullScreen />;
  if (user) return <Navigate to={isAdmin ? '/admin' : isOrganizer ? '/organizer' : '/user'} replace />;
  return <Outlet />;
};
