import { Outlet } from 'react-router-dom';
import { RequireAdmin } from '../routes/guards';

/**
 * Admin portal layout route (/admin/*).
 *
 * Enforces the ADMIN role at the route boundary — students are bounced to
 * /student/dashboard, unauthenticated users to /login. Hosts the admin control
 * panel (pages/Admin), which renders its own admin sidebar + topbar and never
 * exposes any student-portal navigation.
 */
export default function AdminLayout() {
  return (
    <RequireAdmin>
      <Outlet />
    </RequireAdmin>
  );
}
