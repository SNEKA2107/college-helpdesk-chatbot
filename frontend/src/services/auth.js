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

export function logout() {
  clearSession();
  window.location.href = '/login';
}
