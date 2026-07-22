import { Navigate } from 'react-router-dom';
import { isLoggedIn, isAdmin } from '../services/auth';

/** Any authenticated user (role-agnostic). */
export function RequireAuth({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Student portal guard. Admins have NO student UI — they are redirected to their
 * own portal. Unauthenticated users go to login.
 */
export function RequireStudent({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (isAdmin()) return <Navigate to="/admin/dashboard" replace />;
  return children;
}

/**
 * Admin portal guard. Students are redirected to their own portal.
 * Unauthenticated users go to login.
 */
export function RequireAdmin({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to="/student/dashboard" replace />;
  return children;
}

/** Login/register: bounce already-authenticated users to their own portal home. */
export function RedirectIfAuthed({ children }) {
  if (isLoggedIn()) return <Navigate to={isAdmin() ? '/admin/dashboard' : '/student/dashboard'} replace />;
  return children;
}
