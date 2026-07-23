import { Navigate } from 'react-router-dom';
import { isLoggedIn, isAdmin, isFaculty, homePath } from '../services/auth';

/** Any authenticated user (role-agnostic). */
export function RequireAuth({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Student portal guard. Admins/faculty have NO student UI — they are redirected to
 * their own portal. Unauthenticated users go to login.
 */
export function RequireStudent({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (isAdmin() || isFaculty()) return <Navigate to={homePath()} replace />;
  return children;
}

/**
 * Admin portal guard. Non-admins are redirected to their own portal.
 * Unauthenticated users go to login.
 */
export function RequireAdmin({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to={homePath()} replace />;
  return children;
}

/**
 * Faculty portal guard. Non-faculty (students/admins) are redirected to their own
 * portal. Unauthenticated users go to login.
 */
export function RequireFaculty({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (!isFaculty()) return <Navigate to={homePath()} replace />;
  return children;
}

/** Login/register: bounce already-authenticated users to their own portal home. */
export function RedirectIfAuthed({ children }) {
  if (isLoggedIn()) return <Navigate to={homePath()} replace />;
  return children;
}
