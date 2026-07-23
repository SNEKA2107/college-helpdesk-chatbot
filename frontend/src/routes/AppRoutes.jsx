import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { RedirectIfAuthed } from './guards';
import StudentLayout from '../layouts/StudentLayout';
import AdminLayout from '../layouts/AdminLayout';
import FacultyLayout from '../layouts/FacultyLayout';

const Landing    = lazy(() => import('../pages/Landing'));
const Login      = lazy(() => import('../pages/Login'));
const FacultyLogin = lazy(() => import('../pages/FacultyLogin'));
const Register   = lazy(() => import('../pages/Register'));
const Dashboard  = lazy(() => import('../pages/Dashboard'));
const Chat       = lazy(() => import('../pages/Chat'));
const Requests   = lazy(() => import('../pages/Requests'));
const Attendance = lazy(() => import('../pages/Attendance'));
const Status     = lazy(() => import('../pages/Status'));
const Exam       = lazy(() => import('../pages/Exam'));
const Fees       = lazy(() => import('../pages/Fees'));
const Timetable  = lazy(() => import('../pages/Timetable'));
const Cgpa       = lazy(() => import('../pages/Cgpa'));
const Leave      = lazy(() => import('../pages/Leave'));
const Od         = lazy(() => import('../pages/Od'));
const Events     = lazy(() => import('../pages/Events'));
const Notices    = lazy(() => import('../pages/Notices'));
const Library    = lazy(() => import('../pages/Library'));
const Contact    = lazy(() => import('../pages/Contact'));
const Profile    = lazy(() => import('../pages/Profile'));
const Calendar   = lazy(() => import('../pages/Calendar'));
const Settings   = lazy(() => import('../pages/Settings'));
const StudentCoursework = lazy(() => import('../pages/StudentCoursework'));
const Admin      = lazy(() => import('../pages/Admin'));

// Faculty portal pages (path relative to /faculty).
const FacultyDashboard    = lazy(() => import('../pages/faculty/FacultyDashboard'));
const FacultyClasses      = lazy(() => import('../pages/faculty/FacultyClasses'));
const FacultyStudents     = lazy(() => import('../pages/faculty/FacultyStudents'));
const FacultyAttendance   = lazy(() => import('../pages/faculty/FacultyAttendance'));
const FacultyMarks        = lazy(() => import('../pages/faculty/FacultyMarks'));
const FacultyAssignments  = lazy(() => import('../pages/faculty/FacultyAssignments'));
const FacultyMaterials    = lazy(() => import('../pages/faculty/FacultyMaterials'));
const FacultyAnalytics    = lazy(() => import('../pages/faculty/FacultyAnalytics'));
const FacultyLeaveOD      = lazy(() => import('../pages/faculty/FacultyLeaveOD'));
const FacultyNotices      = lazy(() => import('../pages/faculty/FacultyNotices'));
const FacultyNotifications = lazy(() => import('../pages/faculty/FacultyNotifications'));
const FacultyTimetable    = lazy(() => import('../pages/faculty/FacultyTimetable'));
const FacultyProfile      = lazy(() => import('../pages/faculty/FacultyProfile'));

const facultyPages = [
  ['dashboard', FacultyDashboard], ['classes', FacultyClasses], ['students', FacultyStudents],
  ['attendance', FacultyAttendance], ['marks', FacultyMarks],
  ['assignments', FacultyAssignments], ['materials', FacultyMaterials], ['analytics', FacultyAnalytics],
  ['leave-od', FacultyLeaveOD], ['notices', FacultyNotices], ['notifications', FacultyNotifications],
  ['timetable', FacultyTimetable], ['profile', FacultyProfile],
];

// Student portal pages — path is RELATIVE to /student.
const studentPages = [
  ['dashboard', Dashboard],
  ['chat', Chat], ['requests', Requests], ['attendance', Attendance], ['status', Status],
  ['exam', Exam], ['fees', Fees], ['timetable', Timetable], ['cgpa', Cgpa],
  ['leave', Leave], ['od', Od], ['events', Events], ['notices', Notices],
  ['coursework', StudentCoursework],
  ['library', Library], ['contact', Contact], ['profile', Profile], ['settings', Settings],
  ['calendar', Calendar],
];

/**
 * Map legacy static-site URLs (e.g. /login.html, /admin-requests.html) onto React
 * routes in the new portal namespaces.
 */
function LegacyRedirect() {
  const { pathname } = useLocation();
  const m = pathname.match(/^\/([\w-]+)\.html$/);
  let target = '/';
  if (m) {
    const raw = m[1];
    if (raw === 'index') target = '/';
    else if (raw === 'login' || raw === 'register') target = '/' + raw;
    else if (raw.startsWith('admin')) target = '/admin/dashboard';
    else if (studentPages.some(([p]) => p === raw)) target = '/student/' + raw;
  }
  return <Navigate to={target} replace />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}>
      <Routes>
        {/* ── Public ── */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
        <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />

        {/* ── Student portal (/student/*) — role-gated by StudentLayout ── */}
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          {studentPages.map(([path, Page]) => (
            <Route key={path} path={path} element={<Page />} />
          ))}
        </Route>

        {/* ── Admin portal (/admin/*) — role-gated by AdminLayout ── */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Admin />} />
          {/* Admin control-panel sections are tabs within the dashboard; any other
              /admin/* deep link falls through to the panel rather than 404-ing. */}
          <Route path="*" element={<Admin />} />
        </Route>

        {/* ── Faculty login (public, email-based) — must precede the guarded block ── */}
        <Route path="/faculty/login" element={<RedirectIfAuthed><FacultyLogin /></RedirectIfAuthed>} />

        {/* ── Faculty portal (/faculty/*) — role-gated by FacultyLayout ── */}
        <Route path="/faculty" element={<FacultyLayout />}>
          <Route index element={<Navigate to="/faculty/dashboard" replace />} />
          {facultyPages.map(([path, Page]) => (
            <Route key={path} path={path} element={<Page />} />
          ))}
        </Route>

        {/* ── Backward-compat: old flat student URLs → /student/* ── */}
        {studentPages.map(([path]) => (
          <Route key={'legacy-' + path} path={'/' + path} element={<Navigate to={'/student/' + path} replace />} />
        ))}

        <Route path="*" element={<LegacyRedirect />} />
      </Routes>
    </Suspense>
  );
}
