import { Link, NavLink } from 'react-router-dom';
import { getUser, logout } from '../services/auth';

// Student portal navigation. Every target lives under /student/* — this sidebar
// contains ONLY student features and never any admin navigation.
const NAV_SECTIONS = [
  {
    title: 'Main',
    links: [
      { to: '/student/home',      icon: '🏠', label: 'Home' },
      { to: '/student/dashboard', icon: '🗂️', label: 'Dashboard' },
      { to: '/student/success',   icon: '🚀', label: 'Success Dashboard' },
      { to: '/student/placement', icon: '💼', label: 'Placement Hub' },
      { to: '/student/chat',      icon: '💬', label: 'AI Assistant' },
      { to: '/student/requests',  icon: '📋', label: 'My Requests' },
    ],
  },
  {
    title: 'Academics',
    links: [
      { to: '/student/attendance', icon: '✅', label: 'Attendance' },
      { to: '/student/status',     icon: '📄', label: 'Marksheet Status' },
      { to: '/student/exam',       icon: '📘', label: 'Exam Info' },
      { to: '/student/fees',       icon: '💳', label: 'Fee Information' },
      { to: '/student/timetable',  icon: '📅', label: 'Timetable' },
      { to: '/student/cgpa',       icon: '🎯', label: 'CGPA Calculator' },
    ],
  },
  {
    title: 'Services',
    links: [
      { to: '/student/leave',   icon: '📝', label: 'Leave Application' },
      { to: '/student/od',      icon: '🏅', label: 'OD Request' },
      { to: '/student/events',  icon: '🎉', label: 'Events' },
      { to: '/student/notices', icon: '🔔', label: 'Notices' },
      { to: '/student/library', icon: '📚', label: 'Library' },
      { to: '/student/contact', icon: '☎',  label: 'Contact Office' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/student/profile',  icon: '👤', label: 'Profile' },
      { to: '/student/settings', icon: '⚙️', label: 'Settings' },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const user = getUser();
  return (
    <aside className={`sidebar${open ? ' open' : ''}`} id="sidebar">
      <div className="sidebar-header">
        <Link to="/student/home" className="logo-wrap">
          <div className="logo-icon">🎓</div>
          <div className="logo-text"><h2>CampusAssist</h2><span>Smart Helpdesk</span></div>
        </Link>
      </div>
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map(section => (
          <div key={section.title}>
            <p className="nav-section-title">{section.title}</p>
            {section.links.map(l => (
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
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{(user?.name || 'S')[0].toUpperCase()}</div>
          <div className="user-info">
            <h4>{user?.name || 'Student'}</h4>
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
