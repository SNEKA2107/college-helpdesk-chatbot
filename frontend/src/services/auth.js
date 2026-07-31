export function getUser() {
  try { return JSON.parse(localStorage.getItem('ca_user') || 'null'); }
  catch { return null; }
}

export function setSession(user, token) {
  localStorage.setItem('ca_user', JSON.stringify(user));
  localStorage.setItem('ca_token', token);
}

/**
 * Merge fields into the cached user without touching the token.
 * Used when a server response changes something the UI keys off — e.g. clearing
 * `mustChangePassword` after the temporary password has been replaced.
 */
export function updateSessionUser(patch) {
  const user = getUser();
  if (!user) return null;
  const next = { ...user, ...patch };
  localStorage.setItem('ca_user', JSON.stringify(next));
  return next;
}

export function clearSession() {
  localStorage.removeItem('ca_user');
  localStorage.removeItem('ca_token');
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem('ca_token'));
}

export function isAdmin() {
  const user = getUser();
  return Boolean(user && user.role === 'admin');
}

export function isFaculty() {
  const user = getUser();
  return Boolean(user && user.role === 'faculty');
}

/** The portal home path for the logged-in user's role. */
export function homePath() {
  const user = getUser();
  if (user?.role === 'admin') return '/admin/dashboard';
  if (user?.role === 'faculty') return '/faculty/dashboard';
  return '/student/dashboard';
}

/** The one path a logged-out user belongs on. Keep call sites off string literals. */
export const LOGIN_PATH = '/login';

/**
 * Logout for callers that live OUTSIDE the React tree — currently just the 401
 * handler in services/api.js, which has no access to the router.
 *
 * This does a full page load, so it depends on the host serving index.html for
 * unknown paths (see frontend/vercel.json). Components must prefer
 * hooks/useLogout.js, which routes client-side and needs no such fallback.
 */
export function logout() {
  clearSession();
  window.location.assign(LOGIN_PATH);
}

/**
 * Ask the server to invalidate the current token.
 *
 * POST /api/auth/logout bumps the account's tokenVersion, which the auth
 * middleware compares against the claim in every token — so this revokes not
 * just this browser's copy but any other copy of the same token.
 *
 * Deliberately fetch() rather than the api client: the api client redirects to
 * /login on 401, which would fight with the caller's own navigation. Failures
 * are swallowed so an offline or already-expired session still logs out locally.
 *
 * API_BASE is imported lazily because services/api.js imports logout() from this
 * module — a static import here would close that cycle.
 */
export async function revokeServerSession() {
  const token = localStorage.getItem('ca_token');
  if (!token) return;
  try {
    const { API_BASE } = await import('./api');
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      keepalive: true,          // survives the navigation that follows
    });
  } catch {
    /* offline or unreachable — the local session is cleared regardless */
  }
}
