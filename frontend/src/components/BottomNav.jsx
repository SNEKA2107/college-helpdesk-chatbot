import { NavLink, Link } from 'react-router-dom';

const ITEMS = [
  { to: '/student/home', icon: '🏠', label: 'Home' },
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
      <Link to="/student/chat" className="bn-fab" title="AI Assistant">💬</Link>
      {ITEMS_AFTER.map(item)}
    </nav>
  );
}
