import { NavLink, Link } from 'react-router-dom';

const ITEMS = [
  { to: '/student/dashboard', icon: '🗂️', label: 'Dashboard' },
  { to: '/student/requests',  icon: '📋', label: 'Requests' },
];
const ITEMS_AFTER = [
  { to: '/student/notices', icon: '🔔', label: 'Notices' },
  { to: '/student/profile', icon: '👤', label: 'Profile' },
];

export default function BottomNav() {
  const item = ({ to, icon, label }) => (
    <NavLink key={to} to={to} className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}>
      <span className="bn-icon">{icon}</span>
      <span className="bn-label">{label}</span>
    </NavLink>
  );
  return (
    <nav className="bottom-nav">
      {ITEMS.map(item)}
      <Link to="/student/chat" className="bn-fab" title="Campus HelpDesk">💬</Link>
      {ITEMS_AFTER.map(item)}
    </nav>
  );
}
