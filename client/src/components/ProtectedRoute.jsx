import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader';

export default function ProtectedRoute({ children, admin = false }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loader message="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  // This only controls what the UI shows; every admin API also enforces the role on the server.
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}
