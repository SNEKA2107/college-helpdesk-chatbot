import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { RequireAuth, RequireAdmin, RedirectIfAuthed } from './guards';

const Landing    = lazy(() => import('../pages/Landing'));
const Login      = lazy(() => import('../pages/Login'));
const Register   = lazy(() => import('../pages/Register'));
const Home       = lazy(() => import('../pages/Home'));
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
const Success    = lazy(() => import('../pages/Success'));
const Placement  = lazy(() => import('../pages/Placement'));
const Admin      = lazy(() => import('../pages/Admin'));

const studentPages = [
  ['/home', Home], ['/dashboard', Dashboard], ['/chat', Chat], ['/requests', Requests],
  ['/attendance', Attendance], ['/status', Status], ['/exam', Exam],
  ['/fees', Fees], ['/timetable', Timetable], ['/cgpa', Cgpa],
  ['/leave', Leave], ['/od', Od], ['/events', Events],
  ['/notices', Notices], ['/library', Library], ['/contact', Contact],
  ['/profile', Profile], ['/calendar', Calendar], ['/success', Success],
  ['/placement', Placement],
];

/** Map legacy static-site URLs (e.g. /login.html, /admin-requests.html) onto React routes. */
function LegacyRedirect() {
  const { pathname } = useLocation();
  const m = pathname.match(/^\/([\w-]+)\.html$/);
  let target = '/';
  if (m) {
    const name = m[1] === 'index' ? '' : m[1].startsWith('admin') ? 'admin' : m[1];
    const known = ['login', 'register', 'admin', ...studentPages.map(([p]) => p.slice(1))];
    if (known.includes(name)) target = '/' + name;
  }
  return <Navigate to={target} replace />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
        <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
        {studentPages.map(([path, Page]) => (
          <Route key={path} path={path} element={<RequireAuth><Page /></RequireAuth>} />
        ))}
        <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="*" element={<LegacyRedirect />} />
      </Routes>
    </Suspense>
  );
}
