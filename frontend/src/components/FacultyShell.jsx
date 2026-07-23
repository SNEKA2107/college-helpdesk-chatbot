import { useState } from 'react';
import { Link } from 'react-router-dom';
import FacultySidebar from './FacultySidebar';
import { useTheme } from '../hooks/useTheme';
import { usePageAnimations } from '../hooks/usePageAnimations';
import { getUser, logout } from '../services/auth';

/**
 * Authenticated faculty page shell: FacultySidebar + topbar + content.
 * Mirrors components/Layout (the student shell) and reuses the same CSS classes
 * so the faculty portal looks and behaves like one application.
 */
export default function FacultyShell({ title, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { current, next, cycle } = useTheme();
  const user = getUser();
  usePageAnimations();

  return (
    <div className="app">
      <div className={`overlay${sidebarOpen ? ' show' : ''}`} onClick={() => setSidebarOpen(false)}></div>
      <FacultySidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle navigation menu">☰</button>
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="topbar-right">
            <button className="theme-btn" onClick={cycle} title={`Switch to ${next.label} mode`}>
              {current.icon} <span className="theme-label">{current.label}</span>
            </button>
            <Link to="/faculty/profile" className="topbar-profile" style={{ textDecoration: 'none' }}>
              <div className="topbar-avatar">{(user?.name || 'F')[0].toUpperCase()}</div>
              <span className="topbar-name">{user?.name || 'Faculty'}</span>
            </Link>
            <button
              className="topbar-logout-btn"
              title="Logout"
              onClick={logout}
              style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 8 }}
            >🚪 Logout</button>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
