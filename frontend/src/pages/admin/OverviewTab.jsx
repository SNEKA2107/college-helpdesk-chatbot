import { formatDate } from '../../utils/format';
import { REQ_BADGE, LV_BADGE } from './shared';

const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 8, background: 'var(--bg2)', marginBottom: 6 };

export default function OverviewTab({ data, loaded, showTab }) {
  const pendingReq = data.requests.filter(r => !['Completed', 'Rejected'].includes(r.status)).length;
  const pendingLv = data.leaves.filter(l => l.status === 'Pending').length;

  return (
    <div>
      <div className="stats-grid mb-6">
        <div className="stat-card">
          <div className="stat-icon si-blue">👥</div>
          <div className="stat-info"><h3>{loaded ? data.students.length : '—'}</h3><p>Total Students</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-orange">📋</div>
          <div className="stat-info"><h3>{loaded ? pendingReq : '—'}</h3><p>Pending Requests</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-purple">📝</div>
          <div className="stat-info"><h3>{loaded ? pendingLv : '—'}</h3><p>Pending Leaves</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-green">🔔</div>
          <div className="stat-info"><h3>{loaded ? data.notices.filter(n => (n.status || 'published') === 'published').length : '—'}</h3><p>Active Notices</p></div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">📋 Recent Requests</div>
            <a href="#" className="link text-sm" onClick={e => { e.preventDefault(); showTab('requests'); }}>View All</a>
          </div>
          <div>
            {!loaded && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading…</div>}
            {loaded && !data.requests.length && <p style={{ color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>No requests yet</p>}
            {loaded && data.requests.slice(0, 5).map(r => (
              <div key={r._id} style={rowStyle}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.student?.name || r.studentId} — {r.type}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(r.createdAt)}</div>
                </div>
                <span className={`badge ${REQ_BADGE[r.status] || 'badge-muted'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">📝 Recent Leave Applications</div>
            <a href="#" className="link text-sm" onClick={e => { e.preventDefault(); showTab('leaves'); }}>View All</a>
          </div>
          <div>
            {!loaded && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading…</div>}
            {loaded && !data.leaves.length && <p style={{ color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>No leaves yet</p>}
            {loaded && data.leaves.slice(0, 5).map(l => (
              <div key={l._id} style={rowStyle}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.name || l.studentId} — {l.leaveType}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(l.fromDate)} → {formatDate(l.toDate)}</div>
                </div>
                <span className={`badge ${LV_BADGE[l.status] || 'badge-muted'}`}>{l.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
