import { Outlet } from 'react-router-dom';
import { RequireStudent } from '../routes/guards';

/**
 * Student portal layout route (/student/*).
 *
 * Enforces the STUDENT role at the route boundary — admins are bounced to
 * /admin/dashboard, unauthenticated users to /login. Every student page it hosts
 * renders the shared student chrome (sidebar + topbar + mobile bottom nav) via
 * components/Layout, so the student portal is fully self-contained and never
 * shares navigation with the admin portal.
 */
export default function StudentLayout() {
  return (
    <RequireStudent>
      <Outlet />
    </RequireStudent>
  );
}
