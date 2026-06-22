import { Navigate } from 'react-router-dom';
import { isLoggedIn, isAdmin } from '../services/auth';

export function RequireAuth({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return children;
}

export function RequireAdmin({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Login/register: bounce already-authenticated users to their home page. */
export function RedirectIfAuthed({ children }) {
  if (isLoggedIn()) return <Navigate to={isAdmin() ? '/admin' : '/home'} replace />;
  return children;
}
