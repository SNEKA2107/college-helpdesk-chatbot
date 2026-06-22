import { Link, NavLink } from 'react-router-dom';
import { getUser, logout } from '../services/auth';

const NAV_SECTIONS = [
  {
    title: 'Main',
    links: [
      { to: '/home',      icon: '🏠', label: 'Home' },
      { to: '/dashboard', icon: '🗂️', label: 'Dashboard' },
      { to: '/success',   icon: '🚀', label: 'Success Dashboard' },
      { to: '/placement', icon: '💼', label: 'Placement Hub' },
      { to: '/chat',      icon: '💬', label: 'Campus Copilot' },
      { to: '/requests',  icon: '📋', label: 'My Requests' },
    ],
  },
  {
    title: 'Academics',
    links: [
      { to: '/attendance', icon: '✅', label: 'Attendance' },
      { to: '/status',     icon: '📄', label: 'Marksheet Status' },
      { to: '/exam',       icon: '📘', label: 'Exam Info' },
      { to: '/fees',       icon: '💳', label: 'Fee Information' },
      { to: '/timetable',  icon: '📅', label: 'Timetable' },
      { to: '/cgpa',       icon: '🎯', label: 'CGPA Calculator' },
    ],
  },
  {
    title: 'Services',
    links: [
      { to: '/leave',   icon: '📝', label: 'Leave Application' },
      { to: '/od',      icon: '🏅', label: 'OD Request' },
      { to: '/events',  icon: '🎉', label: 'Events' },
      { to: '/notices', icon: '🔔', label: 'Notices' },
      { to: '/library', icon: '📚', label: 'Library' },
      { to: '/contact', icon: '☎',  label: 'Contact Office' },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const user = getUser();
  return (
    <aside className={`sidebar${open ? ' open' : ''}`} id="sidebar">
      <div className="sidebar-header">
        <Link to="/home" className="logo-wrap">
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
