import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { formatDate } from '../utils/format';

// CRIT-02: read-only academic calendar for students. Data comes from MongoDB (/api/calendar).
const TYPE_BADGE = { Holiday: 'badge-danger', Exam: 'badge-primary', Deadline: 'badge-warning', Semester: 'badge-success', Event: 'badge-muted' };
const TYPE_ICON  = { Holiday: '🏖️', Exam: '📝', Deadline: '⏰', Semester: '📅', Event: '🎉' };

export default function Calendar() {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    apiCall('/calendar').then(res => setEntries(res.ok ? res.data.entries || [] : []));
  }, []);

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const upcoming = (entries || []).filter(e => new Date(e.endDate || e.date) >= startOfToday);
  const past = (entries || []).filter(e => new Date(e.endDate || e.date) < startOfToday);

  function row(e) {
    const d = new Date(e.date);
    return (
      <div key={e._id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 50, height: 50, background: 'var(--bg2)', borderRadius: 10, textAlign: 'center', paddingTop: 6, flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{d.getDate()}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{TYPE_ICON[e.type] || ''} {e.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {formatDate(e.date)}{e.endDate ? ` → ${formatDate(e.endDate)}` : ''}{e.description ? ` · ${e.description}` : ''}
          </div>
        </div>
        <span className={`badge ${TYPE_BADGE[e.type] || 'badge-muted'}`}>{e.type}</span>
      </div>
    );
  }

  return (
    <Layout title="Academic Calendar">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Academic Calendar</h2>
          <p>Holidays, exam schedules, semester dates and academic events</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header"><div className="card-title">🗓️ Upcoming</div></div>
        {!entries && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading…</div>}
        {entries && !upcoming.length && <p style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No upcoming calendar entries.</p>}
        {upcoming.map(row)}
      </div>

      {past.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">📜 Past</div></div>
          <div style={{ opacity: 0.7 }}>{past.map(row)}</div>
        </div>
      )}
    </Layout>
  );
}
