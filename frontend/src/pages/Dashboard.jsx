import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { getUser } from '../services/auth';
import { timeAgo, formatDate } from '../utils/format';

// Priority/category badge for the notice list (reuses existing badge classes).
const NOTICE_BADGE = { urgent: 'badge-danger', exam: 'badge-primary', fee: 'badge-warning', holiday: 'badge-info', general: 'badge-muted' };
// Date a notice went live — publishedAt when present, else the legacy createdAt.
const noticeDate = n => n.publishedAt || n.createdAt;

const QUICK_ACCESS = [
  { to: '/exam',       icon: '📘', label: 'Exam Info',        bg: 'linear-gradient(135deg,#2563eb,#60a5fa)' },
  { to: '/fees',       icon: '💳', label: 'Fee Information',  bg: 'linear-gradient(135deg,#10b981,#34d399)' },
  { to: '/status',     icon: '📄', label: 'Marksheet Status', bg: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  { to: '/timetable',  icon: '📅', label: 'Timetable',        bg: 'linear-gradient(135deg,#f97316,#fbbf24)' },
  { to: '/leave',      icon: '📝', label: 'Leave Application',bg: 'linear-gradient(135deg,#ec4899,#fb7185)' },
  { to: '/notices',    icon: '🔔', label: 'Notices',          bg: 'linear-gradient(135deg,#f59e0b,#facc15)' },
  { to: '/library',    icon: '📚', label: 'Library',          bg: 'linear-gradient(135deg,#06b6d4,#22d3ee)' },
  { to: '/chat',       icon: '💬', label: 'Campus HelpDesk',  bg: 'linear-gradient(135deg,#4f46e5,#818cf8)' },
  { to: '/attendance', icon: '✅', label: 'Attendance',       bg: 'linear-gradient(135deg,#0d9488,#2dd4bf)' },
  { to: '/cgpa',       icon: '🎯', label: 'Marks & CGPA',     bg: 'linear-gradient(135deg,#4338ca,#a5b4fc)' },
  { to: '/od',         icon: '🏅', label: 'OD Request',       bg: 'linear-gradient(135deg,#ea580c,#fb923c)' },
  { to: '/events',     icon: '🎉', label: 'Events',           bg: 'linear-gradient(135deg,#be185d,#f472b6)' },
  { to: '/calendar',   icon: '📆', label: 'Academic Calendar', bg: 'linear-gradient(135deg,#0891b2,#67e8f9)' },
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

// Per-row accent palette — preserves the original 3-row Upcoming Events look (blue / green / amber)
const EVENT_ACCENTS = [
  { box: 'rgba(78,133,191,0.12)', color: '#89AACC' },
  { box: 'rgba(74,222,128,0.1)',  color: '#4ade80' },
  { box: 'rgba(245,158,11,0.1)',  color: '#fbbf24' },
];

// Event category → existing badge class (only classes present in the stylesheet)
const EV_BADGE = {
  Technical: 'badge-primary', Cultural: 'badge-warning', Sports: 'badge-success',
  Workshop: 'badge-warning', Seminar: 'badge-muted', Other: 'badge-muted',
};

// Marksheet stepper — driven by the real Request.status enum (no schema change)
const STATUS_ORDER = ['Submitted', 'Under Review', 'Processing', 'Ready for Collection', 'Completed'];
const MARKSHEET_STEPS = [
  { label: 'Application Received', reachedAt: 0 },
  { label: 'Under Verification',   reachedAt: 1 },
  { label: 'Processing',           reachedAt: 2 },
  { label: 'Ready for Collection', reachedAt: 3 },
];

function marksheetSteps(status) {
  const rejected = status === 'Rejected';
  const cur = STATUS_ORDER.indexOf(status);
  return MARKSHEET_STEPS.map((step, idx) => {
    if (rejected) {
      if (idx === 0) return { ...step, dot: 'dot-success', badge: 'badge-success', text: 'Done' };
      if (idx === MARKSHEET_STEPS.length - 1) return { ...step, dot: 'dot-muted', badge: 'badge-danger', text: 'Rejected' };
      return { ...step, dot: 'dot-muted', badge: 'badge-muted', text: 'Pending' };
    }
    if (cur > step.reachedAt) return { ...step, dot: 'dot-success', badge: 'badge-success', text: 'Done' };
    if (cur === step.reachedAt) return { ...step, dot: 'dot-primary', badge: 'badge-primary', text: 'In Progress' };
    return { ...step, dot: 'dot-muted', badge: 'badge-muted', text: 'Pending' };
  });
}

export default function Dashboard() {
  const user = getUser();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Student';
  const [stats, setStats] = useState(null);
  const [notices, setNotices] = useState(null);
  const [events, setEvents] = useState(null);
  const [requests, setRequests] = useState(null);

  useEffect(() => {
    apiCall('/requests/stats').then(res => { if (res.ok) setStats(res.data.stats); });
    apiCall('/notices').then(res => { if (res.ok) setNotices(res.data.notices || []); });
    apiCall('/events').then(res => { if (res.ok) setEvents(res.data.events || []); });
    apiCall('/requests').then(res => { if (res.ok) setRequests(res.data.requests || []); });
  }, []);

  const statVal = key => (stats ? stats[key] : '—');
  const noticeCount = notices ? notices.length : '—';

  // Upcoming events from the Event collection — today onward, soonest first, max 3
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcomingEvents = (events || [])
    .filter(e => new Date(e.date) >= startOfToday)
    .slice(0, 3);

  // Latest marksheet request for the (now real) status stepper — student's own data
  const latestMarksheet = (requests || []).find(r => r.type === 'Marksheet') || null;

  const mobileExtras = (
    <>
      <div className="mobile-header" style={{ display: 'none' }}>
        <div className="mobile-header-top">
          <div>
            <div className="mobile-greeting">
              {greeting()}, <span style={{ color: 'var(--primary-light)' }}>{firstName}</span> 👋
            </div>
            <div className="mobile-subtitle">Welcome to Campus HelpDesk</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/notices" className="mobile-notif">🔔</Link>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--dark)' }}>{n.title}</div>
              {n.category && <span className={`badge ${NOTICE_BADGE[n.category] || 'badge-muted'}`} style={{ fontSize: 10 }}>{n.category}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(noticeDate(n))} · {timeAgo(noticeDate(n))}</div>
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
          <div className="card-header"><div><div className="card-title">🎉 Upcoming Events</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Campus-wide</div></div><Link to="/events" className="link text-sm">View All</Link></div>
          {!events && <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>Loading…</div>}
          {events && !upcomingEvents.length && (
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No upcoming events.</p>
          )}
          {upcomingEvents.map((ev, i) => {
            const accent = EVENT_ACCENTS[i % EVENT_ACCENTS.length];
            const d = new Date(ev.date);
            const isLast = i === upcomingEvents.length - 1;
            return (
              <div key={ev._id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                <div style={{ width: 50, height: 50, background: accent.box, borderRadius: 10, textAlign: 'center', paddingTop: 6, flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: accent.color }}>{d.getDate()}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</div>
                </div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{ev.title}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.venue}{ev.time ? ` · ${ev.time}` : ''}</div></div>
                <span className={`badge ${EV_BADGE[ev.category] || 'badge-primary'}`}>{ev.category}</span>
              </div>
            );
          })}
        </div>

        {/* Marksheet Status sits directly in the grid — it used to share a stacked
            column with a "Recent Notifications" card, which was removed. The
            /notices page and the topbar bell remain the entry points for notices. */}
        <div className="card">
          <div className="card-header"><div className="card-title">📄 Marksheet Status</div></div>
          {!requests && <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>Loading…</div>}
          {requests && !latestMarksheet && (
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No marksheet request yet.</p>
          )}
          {latestMarksheet && marksheetSteps(latestMarksheet.status).map(s => (
            <div className="step-row" key={s.label}><div className="step-left"><div className={`step-dot ${s.dot}`}></div><span style={{ fontSize: 13.5 }}>{s.label}</span></div><span className={`badge ${s.badge}`}>{s.text}</span></div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
