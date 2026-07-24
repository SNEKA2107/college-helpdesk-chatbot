import { useEffect, useMemo, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import { timeAgo } from '../../utils/format';
import '../../styles/faculty.css';

const TABS = [
  { key: '', label: 'All' },
  { key: 'notice', label: '📢 Notices' },
  { key: 'submission', label: '📥 Submissions' },
  { key: 'leave', label: '📩 Leave/OD' },
  { key: 'timetable', label: '📅 Timetable' },
];

export default function FacultyNotifications() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('');

  const load = () => {
    setErr('');
    apiCall('/faculty-portal/notifications').then(res => {
      if (res.ok) setItems(res.data.notifications || []);
      else setErr(res.error || 'Could not load notifications.');
    });
  };
  useEffect(load, []);

  const filtered = useMemo(() => (items || []).filter(n => !tab || n.type === tab), [items, tab]);
  const countFor = key => (items || []).filter(n => !key || n.type === key).length;

  return (
    <FacultyShell title="Notifications">
      <div className="page-header">
        <div className="page-header-text"><h2>Notifications</h2><p>Assignment submissions, admin notices, leave requests & timetable changes</p></div>
      </div>

      {err && (
        <div className="alert alert-danger mb-6"><span>⚠️</span><div style={{ flex: 1 }}>{err}</div><button className="btn btn-sm btn-outline" onClick={load}>Retry</button></div>
      )}

      <div className="card">
        <div className="fac-tabs" style={{ marginBottom: 12 }}>
          {TABS.map(t => (
            <button key={t.key} className={`fac-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label} <span className="badge badge-muted" style={{ fontSize: 10 }}>{countFor(t.key)}</span>
            </button>
          ))}
          <button className="btn btn-sm btn-outline" style={{ marginLeft: 'auto' }} onClick={load}>↻ Refresh</button>
        </div>

        {!items && <p className="fac-muted">Loading…</p>}
        {items && !filtered.length && <p className="fac-center">You're all caught up — no notifications here.</p>}
        {filtered.map((n, i) => (
          <div key={i} className="fac-notice">
            <div className="fac-file-icon">{n.icon}</div>
            <div style={{ flex: 1 }}>
              <div className="fac-row-title">{n.title}</div>
              {n.detail && <div className="fac-muted" style={{ fontSize: 12 }}>{n.detail}</div>}
            </div>
            <span className="fac-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{timeAgo(n.date)}</span>
          </div>
        ))}
      </div>
    </FacultyShell>
  );
}
