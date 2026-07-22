import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useUnreadNotices } from '../hooks/useUnreadNotices';
import { getUser, logout } from '../services/auth';

export default function Topbar({ title, onMenuClick }) {
  const { current, next, cycle } = useTheme();
  const unread = useUnreadNotices();
  const user = getUser();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="menu-btn" onClick={onMenuClick} aria-label="Toggle navigation menu">☰</button>
        <h1 className="page-title">{title}</h1>
      </div>
      <div className="topbar-right">
        <button className="theme-btn" onClick={cycle} title={`Switch to ${next.label} mode`}>
          {current.icon} <span className="theme-label">{current.label}</span>
        </button>
        <Link to="/student/notices" className="notif-btn" style={{ position: 'relative' }} title={unread > 0 ? `${unread} unread notice${unread > 1 ? 's' : ''}` : 'Notices'}>
          🔔
          {unread > 0 && (
            <span className="notif-count" style={{
              position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff',
              borderRadius: 10, minWidth: 18, height: 18, fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1,
            }}>{unread > 9 ? '9+' : unread}</span>
          )}
        </Link>
        <Link to="/student/profile" className="topbar-profile" style={{ textDecoration: 'none' }}>
          <div className="topbar-avatar">{(user?.name || 'S')[0].toUpperCase()}</div>
          <span className="topbar-name">{user?.name || 'Student'}</span>
        </Link>
        <button
          className="topbar-logout-btn"
          title="Logout"
          onClick={logout}
          style={{
            background: 'var(--danger)', color: '#fff', border: 'none', padding: '6px 14px',
            borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 8,
          }}
        >🚪 Logout</button>
      </div>
    </header>
  );
}
