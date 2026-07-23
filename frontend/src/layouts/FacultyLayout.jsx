import { Outlet } from 'react-router-dom';
import { RequireFaculty } from '../routes/guards';

/**
 * Faculty portal layout route (/faculty/*).
 *
 * Enforces the FACULTY role at the route boundary — students/admins are bounced to
 * their own portal, unauthenticated users to /login. Each faculty page renders the
 * shared faculty chrome (FacultySidebar + topbar) via components/FacultyShell.
 */
export default function FacultyLayout() {
  return (
    <RequireFaculty>
      <Outlet />
    </RequireFaculty>
  );
}
