import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import { formatDate } from '../../utils/format';
import '../../styles/faculty.css';

const QUICK_ACTIONS = [
  { to: '/faculty/attendance', icon: '✅', label: 'Mark Attendance' },
  { to: '/faculty/marks',      icon: '📝', label: 'Enter Marks' },
  { to: '/faculty/leave-od',   icon: '📩', label: 'Approve Leave' },
  { to: '/faculty/notices',    icon: '🔔', label: 'Post Notice' },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function FacultyDashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [timetables, setTimetables] = useState(null);

  const load = useCallback(() => {
    setErr('');
    apiCall('/faculty-portal/dashboard').then(res => {
      if (res.ok) setD(res.data.dashboard);
      else setErr(res.error || 'Could not load your dashboard. Please try again.');
    });
    // Today's Classes reuses the existing timetable endpoint (no backend change).
    apiCall('/faculty-portal/timetable').then(res => { if (res.ok) setTimetables(res.data.timetables || []); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Today's classes derived across all assigned timetables (same logic as the Timetable page).
  const todayClasses = useMemo(() => {
    const out = [];
    const day = DAYS[new Date().getDay()];
    (timetables || []).forEach(tt => {
      const row = tt.schedule?.[day];
      const details = tt.subjectDetails || {};
      if (Array.isArray(row)) {
        row.forEach((sub, i) => {
          if (sub && sub !== 'Lunch' && sub !== '-') {
            out.push({ slot: (tt.slots || [])[i], name: details[sub]?.name || sub, room: details[sub]?.room || '', cohort: `${tt.department} · Sem ${tt.semester}` });
          }
        });
      }
    });
    return out;
  }, [timetables]);

  const stats = [
    { icon: '👥', cls: 'si-blue',   value: d?.studentCount, label: 'Students' },
    { icon: '📚', cls: 'si-purple', value: d?.assignedSubjectCount, label: 'Assigned Subjects' },
    { icon: '✅', cls: 'si-orange', value: d?.pendingAttendance, label: 'Pending Attendance' },
    { icon: '📩', cls: 'si-green',  value: d?.pendingLeaves, label: 'Pending Leave/OD' },
  ];

  return (
    <FacultyShell title="Faculty Dashboard">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Welcome, {d ? d.facultyName : 'Faculty'} 👋</h2>
          <p>{d ? `${d.designation || 'Faculty'} · ${d.department} Department` : 'Loading your dashboard…'}</p>
        </div>
      </div>

      {err && !d && (
        <div className="alert alert-danger mb-6">
          <span>⚠️</span>
          <div style={{ flex: 1 }}>{err}</div>
          <button className="btn btn-sm btn-outline" onClick={load}>Retry</button>
        </div>
      )}

      <div className="stats-grid mb-6">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.cls}`}>{s.icon}</div>
            <div className="stat-info"><h3>{d ? (s.value ?? 0) : '—'}</h3><p>{s.label}</p></div>
          </div>
        ))}
      </div>

      <div className="card mb-6">
        <div className="card-header"><div className="card-title">📅 Today's Classes — {DAYS[new Date().getDay()]}</div></div>
        {!timetables && <p className="fac-muted">Loading…</p>}
        {timetables && !todayClasses.length && <p className="fac-muted">No classes scheduled for today.</p>}
        {todayClasses.map((c, i) => (
          <div key={i} className="fac-today-row">
            <div className="fac-today-slot">{c.slot}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
              <div className="fac-muted" style={{ fontSize: 12 }}>📍 {c.room || 'TBA'} · {c.cohort}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">📚 Assigned Subjects & Classes</div></div>
          {!d && <p className="fac-muted">Loading…</p>}
          {d && !d.assignedSubjects.length && <p className="fac-muted">No subjects assigned yet.</p>}
          {d && d.assignedSubjects.map((s, i) => (
            <div key={i} className="fac-row">
              <div>
                <div className="fac-row-title">{s.name}{s.code ? <span className="fac-muted"> · {s.code}</span> : ''}</div>
                <div className="fac-muted" style={{ fontSize: 12 }}>{s.department} · Sem {s.semester}{s.section ? ` · Sec ${s.section}` : ''}</div>
              </div>
              <span className="badge badge-primary">Assigned</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">🔔 Recent Notices</div></div>
          {!d && <p className="fac-muted">Loading…</p>}
          {d && !d.recentNotices.length && <p className="fac-muted">No recent notices.</p>}
          {d && d.recentNotices.map(n => (
            <div key={n._id} className="fac-row">
              <div>
                <div className="fac-row-title">{n.title}</div>
                <div className="fac-muted" style={{ fontSize: 12 }}>{formatDate(n.publishedAt || n.createdAt)}</div>
              </div>
              <span className="badge badge-muted">{n.category}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">⚡ Quick Actions</div></div>
        <div className="fac-quick-grid">
          {QUICK_ACTIONS.map(a => (
            <Link key={a.to} to={a.to} className="fac-quick">
              <span className="fac-quick-icon">{a.icon}</span>
              <span>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </FacultyShell>
  );
}
