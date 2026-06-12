export function getUser() {
  try { return JSON.parse(localStorage.getItem('ca_user') || 'null'); }
  catch { return null; }
}

export function setSession(user, token) {
  localStorage.setItem('ca_user', JSON.stringify(user));
  localStorage.setItem('ca_token', token);
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

export function logout() {
  clearSession();
  window.location.href = '/login';
}
