import { NavLink, Link } from 'react-router-dom';

const ITEMS = [
  { to: '/dashboard', icon: '🏠', label: 'Home' },
  { to: '/requests',  icon: '📋', label: 'Requests' },
];
const ITEMS_AFTER = [
  { to: '/notices', icon: '🔔', label: 'Notices' },
  { to: '/profile', icon: '👤', label: 'Profile' },
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
      <Link to="/chat" className="bn-fab" title="Chat with Bot">💬</Link>
      {ITEMS_AFTER.map(item)}
    </nav>
  );
}
