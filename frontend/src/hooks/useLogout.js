import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession, LOGIN_PATH } from '../services/auth';

/**
 * Logout for components inside the router.
 *
 * Navigates client-side rather than doing a full page load. A hard
 * `window.location` hit asks the host for /login, which only resolves if the
 * static host is configured to fall back to index.html — that is what produced
 * the Vercel 404 after logout. Routing in-app keeps logout working regardless
 * of host config, and in the Capacitor APK, where there is no server at all.
 *
 * `replace` so the back button cannot return to the authenticated screen.
 */
export function useLogout() {
  const navigate = useNavigate();
  return useCallback(() => {
    clearSession();
    navigate(LOGIN_PATH, { replace: true });
  }, [navigate]);
}

export default useLogout;
