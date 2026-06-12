import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { getUser } from '../services/auth';
import { timeAgo } from '../utils/format';

const QUICK_ACCESS = [
  { to: '/exam',       icon: '📘', label: 'Exam Info',        bg: 'linear-gradient(135deg,#2563eb,#60a5fa)' },
  { to: '/fees',       icon: '💳', label: 'Fee Information',  bg: 'linear-gradient(135deg,#10b981,#34d399)' },
  { to: '/status',     icon: '📄', label: 'Marksheet Status', bg: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  { to: '/timetable',  icon: '📅', label: 'Timetable',        bg: 'linear-gradient(135deg,#f97316,#fbbf24)' },
  { to: '/leave',      icon: '📝', label: 'Leave Application',bg: 'linear-gradient(135deg,#ec4899,#fb7185)' },
  { to: '/notices',    icon: '🔔', label: 'Notices',          bg: 'linear-gradient(135deg,#f59e0b,#facc15)' },
  { to: '/library',    icon: '📚', label: 'Library',          bg: 'linear-gradient(135deg,#06b6d4,#22d3ee)' },
  { to: '/chat',       icon: '💬', label: 'Chat with Bot',    bg: 'linear-gradient(135deg,#4f46e5,#818cf8)' },
  { to: '/attendance', icon: '✅', label: 'Attendance',       bg: 'linear-gradient(135deg,#0d9488,#2dd4bf)' },
  { to: '/cgpa',       icon: '🎯', label: 'CGPA Calculator',  bg: 'linear-gradient(135deg,#4338ca,#a5b4fc)' },
  { to: '/od',         icon: '🏅', label: 'OD Request',       bg: 'linear-gradient(135deg,#ea580c,#fb923c)' },
  { to: '/events',     icon: '🎉', label: 'Events',           bg: 'linear-gradient(135deg,#be185d,#f472b6)' },
];

const MOBILE_ACTIONS = [
  { to: '/exam',       icon: '📘', label: 'Exam Info',  bg: 'linear-gradient(135deg,#1a3a6b,#2563eb)' },
  { to: '/fees',       icon: '💳', label: 'Fee Details',bg: 'linear-gradient(135deg,#064e3b,#10b981)' },
  { to: '/leave',      icon: '📝', label: 'Leave',      bg: 'linear-gradient(135deg,#7c1d6f,#ec4899)' },
  { to: '/timetable',  icon: '📅', label: 'Timetable',  bg: 'linear-gradient(135deg,#7c2d12,#f97316)' },
  { to: '/library',    icon: '📚', label: 'Library',    bg: 'linear-gradient(135deg,#0c4a6e,#06b6d4)' },
  { to: '/attendance', icon: '✅', label: 'Attendance', bg: 'linear-gradient(135deg,#064e3b,#0d9488)' },
  { to: '/status',     icon: '📄', label: 'Marksheet',  bg: 'linear-gradient(135deg,#3b0764,#7c3aed)' },
  { to: '/cgpa',       icon: '🎯', label: 'CGPA',       bg: 'linear-gradient(135deg,#1e1b4b,#4338ca)' },
  { to: '/od',         icon: '🏅', label: 'OD Request', bg: 'linear-gradient(135deg,#7c2d12,#ea580c)' },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}

export default function Dashboard() {
  const user = getUser();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Student';
  const [stats, setStats] = useState(null);
  const [notices, setNotices] = useState(null);

  useEffect(() => {
    apiCall('/requests/stats').then(res => { if (res.ok) setStats(res.data.stats); });
    apiCall('/notices').then(res => { if (res.ok) setNotices(res.data.notices || []); });
  }, []);

  const statVal = key => (stats ? stats[key] : '—');
  const noticeCount = notices ? notices.length : '—';

  const mobileExtras = (
    <>
      <div className="mobile-header" style={{ display: 'none' }}>
        <div className="mobile-header-top">
          <div>
            <div className="mobile-greeting">
              {greeting()}, <span style={{ color: 'var(--primary-light)' }}>{firstName}</span> 👋
            </div>
            <div className="mobile-subtitle">Welcome to CampusAssist</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/notices" className="mobile-notif">🔔<span className="notif-dot"></span></Link>
            <Link to="/profile" className="mobile-avatar">{(user?.name || 'S')[0].toUpperCase()}</Link>
          </div>
        </div>
      </div>

      <div className="mobile-stats" style={{ display: 'none' }}>
        <div className="mobile-stat-card ms-blue"><span className="stat-emoji">📋</span><div className="stat-num">{statVal('total')}</div><div className="stat-lbl">My Requests</div></div>
        <div className="mobile-stat-card ms-green"><span className="stat-emoji">✅</span><div className="stat-num">{statVal('completed')}</div><div className="stat-lbl">Completed</div></div>
        <div className="mobile-stat-card ms-orange"><span className="stat-emoji">⏳</span><div className="stat-num">{statVal('inProgress')}</div><div className="stat-lbl">In Progress</div></div>
        <div className="mobile-stat-card ms-purple"><span className="stat-emoji">🔔</span><div className="stat-num">{noticeCount}</div><div className="stat-lbl">Notices</div></div>
      </div>

      <div className="mobile-section-title" style={{ display: 'none' }}>Quick Actions</div>
      <div className="mobile-actions" style={{ display: 'none' }}>
        {MOBILE_ACTIONS.map(a => (
          <Link key={a.to} to={a.to} className="mobile-action-card" style={{ background: a.bg }}>
            <div className="mobile-action-icon">{a.icon}</div>
            <div className="mobile-action-label">{a.label}</div>
          </Link>
        ))}
      </div>

      <div className="mobile-section-title" style={{ display: 'none' }}>Recent Notices</div>
      <div
        className="mobile-notices-panel"
        style={{
          padding: '0 20px', flexDirection: 'column', gap: 8,
          display: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'flex' : 'none',
        }}
      >
        {notices && !notices.length && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No notices.</p>}
        {(notices || []).slice(0, 3).map(n => (
          <div key={n._id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--dark)', marginBottom: 4 }}>{n.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(n.createdAt)}</div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <Layout title="Dashboard" mobileExtras={mobileExtras} mainClassName="main-content desktop-only">
      <div className="card mb-6" style={{ background: 'linear-gradient(135deg,#0d1a2a,#0a1e30)', border: '1px solid rgba(78,133,191,0.2)', padding: '28px 32px' }}>
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginBottom: 4 }}>Welcome back,</p>
            <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>{user?.name || 'Student'}</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 6 }}>Here's what's happening on campus today.</p>
          </div>
          <div style={{ fontSize: 72, lineHeight: 1 }}>🏫</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon si-blue">📋</div><div className="stat-info"><h3>{statVal('total')}</h3><p>My Requests</p></div></div>
        <div className="stat-card"><div className="stat-icon si-green">✅</div><div className="stat-info"><h3>{statVal('completed')}</h3><p>Completed</p></div></div>
        <div className="stat-card"><div className="stat-icon si-orange">⏳</div><div className="stat-info"><h3>{statVal('inProgress')}</h3><p>In Progress</p></div></div>
        <div className="stat-card"><div className="stat-icon si-purple">🔔</div><div className="stat-info"><h3>{noticeCount}</h3><p>Notices</p></div></div>
      </div>

      <h2 className="section-title">Quick Access</h2>
      <div className="grid-4 mb-8">
        {QUICK_ACCESS.map(q => (
          <Link
            key={q.to} to={q.to} className="card"
            style={{ textAlign: 'center', padding: 24, textDecoration: 'none', background: q.bg, color: '#fff', border: 'none', transition: 'transform 0.2s ease' }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = ''; }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>{q.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{q.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">🎉 Upcoming Events</div></div><Link to="/events" className="link text-sm">View All</Link></div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 50, height: 50, background: 'rgba(78,133,191,0.12)', borderRadius: 10, textAlign: 'center', paddingTop: 6, flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#89AACC' }}>15</div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>JUN</div>
            </div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>Tech Symposium 2026</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Main Auditorium · 10:00 AM</div></div>
            <span className="badge badge-primary">Upcoming</span>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 50, height: 50, background: 'rgba(74,222,128,0.1)', borderRadius: 10, textAlign: 'center', paddingTop: 6, flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#4ade80' }}>20</div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>JUN</div>
            </div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>Cultural Fest</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Open Ground · 11:00 AM</div></div>
            <span className="badge badge-success">Open</span>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0' }}>
            <div style={{ width: 50, height: 50, background: 'rgba(245,158,11,0.1)', borderRadius: 10, textAlign: 'center', paddingTop: 6, flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>25</div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>JUN</div>
            </div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>Placement Training</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Seminar Hall · 09:30 AM</div></div>
            <span className="badge badge-warning">Register</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">🔔 Recent Notifications</div><Link to="/notices" className="link text-sm">View All</Link></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!notices && <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>Loading…</div>}
              {notices && !notices.length && (
                <p style={{ fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No notices at this time.</p>
              )}
              {(notices || []).slice(0, 3).map(n => (
                <div key={n._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 10, background: 'var(--bg2)', borderRadius: 8 }}>
                  <p style={{ fontSize: 13.5, margin: 0 }}>{n.title}</p>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 10 }}>{timeAgo(n.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">📄 Marksheet Status</div></div>
            <div className="step-row"><div className="step-left"><div className="step-dot dot-success"></div><span style={{ fontSize: 13.5 }}>Application Received</span></div><span className="badge badge-success">Done</span></div>
            <div className="step-row"><div className="step-left"><div className="step-dot dot-success"></div><span style={{ fontSize: 13.5 }}>Under Verification</span></div><span className="badge badge-success">Done</span></div>
            <div className="step-row"><div className="step-left"><div className="step-dot dot-primary"></div><span style={{ fontSize: 13.5 }}>Processing</span></div><span className="badge badge-primary">In Progress</span></div>
            <div className="step-row"><div className="step-left"><div className="step-dot dot-muted"></div><span style={{ fontSize: 13.5 }}>Ready for Collection</span></div><span className="badge badge-muted">Pending</span></div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
