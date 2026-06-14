import { useState } from 'react';
import { emptyCellStyle, loadingCellStyle } from './shared';

const ACTION_BADGE = (action) => {
  if (action.endsWith('.publish') || action.endsWith('.approve')) return 'badge-success';
  if (action.endsWith('.archive') || action.endsWith('.reject')) return 'badge-danger';
  if (action.endsWith('.create')) return 'badge-primary';
  return 'badge-muted';
};

const ENTITIES = ['All', 'Timetable', 'Exam', 'User', 'Leave', 'Notice', 'Event'];

export default function AuditTab({ data, loaded, reload }) {
  const [entity, setEntity] = useState('All');
  const logs = entity === 'All' ? data.audit : data.audit.filter(l => l.entity === entity);

  const fmt = (ts) => new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const summarize = (d) => {
    if (!d || typeof d !== 'object') return '';
    return Object.entries(d).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}: ${v}`).join(' · ');
  };

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Admin Audit Log</h2><p>Trail of administrative actions (newest first)</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="form-select" style={{ paddingLeft: 14, width: 160 }} value={entity} onChange={e => setEntity(e.target.value)}>
            {ENTITIES.map(x => <option key={x}>{x}</option>)}
          </select>
          <button className="btn btn-outline" onClick={reload}>↺ Refresh</button>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th><th>Details</th></tr>
            </thead>
            <tbody>
              {!loaded && <tr><td colSpan={5} style={loadingCellStyle}>Loading…</td></tr>}
              {loaded && !logs.length && <tr><td colSpan={5} style={emptyCellStyle}>No audit entries yet</td></tr>}
              {loaded && logs.map(l => (
                <tr key={l._id}>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(l.timestamp)}</td>
                  <td style={{ fontSize: 13 }}>{l.actorName || '—'}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.actorId}</div></td>
                  <td><span className={`badge ${ACTION_BADGE(l.action)}`}>{l.action}</span></td>
                  <td style={{ fontSize: 13 }}>{l.entity}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 320 }}>{summarize(l.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
