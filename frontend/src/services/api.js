import { clearSession } from './auth';

const PROD_API = 'https://college-helpdesk-chatbot-l4bk.onrender.com/api';

function resolveApiBase() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // Native (Capacitor) builds have no same-origin backend — talk to the hosted API
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    return PROD_API;
  }
  const { protocol, hostname, port } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  // Capacitor WebViews serve the app at https://localhost (Android) or capacitor://localhost (iOS)
  // with no local backend — never point those at http://localhost:5000 (blocked as mixed content)
  if (isLocal && (protocol === 'https:' || protocol === 'capacitor:')) return PROD_API;
  // Vite dev/preview server → local backend; production web build is served by the backend itself
  if (isLocal && port !== '5000') return 'http://localhost:5000/api';
  return '/api';
}

export const API_BASE = resolveApiBase();

export async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('ca_token');
  try {
    const res = await fetch(API_BASE + endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    });
    if (res.status === 401) {
      clearSession();
      window.location.href = '/login';
      return { ok: false, error: 'Session expired. Please log in again.' };
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
