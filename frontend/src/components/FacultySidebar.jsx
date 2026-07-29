import { Link, NavLink } from 'react-router-dom';
import { getUser } from '../services/auth';
import { useLogout } from '../hooks/useLogout';

// Faculty portal navigation. Every target lives under /faculty/* — this sidebar
// contains ONLY faculty features and never any student or admin navigation.
const NAV_LINKS = [
  { to: '/faculty/dashboard',     icon: '🗂️', label: 'Dashboard' },
  { to: '/faculty/classes',       icon: '📚', label: 'My Classes' },
  { to: '/faculty/students',      icon: '👥', label: 'Students' },
  { to: '/faculty/attendance',    icon: '✅', label: 'Attendance' },
  { to: '/faculty/marks',         icon: '📝', label: 'Marks' },
  { to: '/faculty/assignments',   icon: '📄', label: 'Assignments' },
  { to: '/faculty/materials',     icon: '📁', label: 'Study Materials' },
  { to: '/faculty/analytics',     icon: '📊', label: 'Analytics' },
  { to: '/faculty/leave-od',      icon: '📩', label: 'Leave & OD' },
  { to: '/faculty/notices',       icon: '🔔', label: 'Notices' },
  { to: '/faculty/notifications', icon: '📬', label: 'Notifications' },
  { to: '/faculty/timetable',     icon: '📅', label: 'Timetable' },
  { to: '/faculty/profile',       icon: '👤', label: 'Profile' },
];

export default function FacultySidebar({ open, onClose }) {
  const user = getUser();
  const logout = useLogout();
  return (
    <aside className={`sidebar${open ? ' open' : ''}`} id="sidebar">
      <div className="sidebar-header">
        <Link to="/faculty/dashboard" className="logo-wrap">
          <div className="logo-icon">🎓</div>
          <div className="logo-text"><h2>CampusAssist</h2><span>Faculty Portal</span></div>
        </Link>
      </div>
      <nav className="sidebar-nav">
        <div>
          <p className="nav-section-title">Faculty</p>
          {NAV_LINKS.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={onClose}
            >
              <span className="nav-icon">{l.icon}</span> {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{(user?.name || 'F')[0].toUpperCase()}</div>
          <div className="user-info">
            <h4>{user?.name || 'Faculty'}</h4>
            <span>{user?.studentId || ''}</span>
          </div>
        </div>
        <a href="#" className="nav-link logout" onClick={e => { e.preventDefault(); logout(); }}>
          <span className="nav-icon">🚪</span> Logout
        </a>
      </div>
    </aside>
  );
}
