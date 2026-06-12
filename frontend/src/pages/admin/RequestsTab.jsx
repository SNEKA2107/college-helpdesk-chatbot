import { useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/format';
import { REQ_BADGE, REQ_STATUSES, emptyCellStyle, loadingCellStyle } from './shared';

export default function RequestsTab({ data, setData, loaded, reload }) {
  const showToast = useToast();
  const [picked, setPicked] = useState({}); // requestId → status chosen in the dropdown

  async function updateStatus(id) {
    const status = picked[id] ?? data.requests.find(r => r._id === id)?.status;
    const res = await apiCall(`/requests/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (res.ok) {
      setData(d => ({ ...d, requests: d.requests.map(r => (r._id === id ? { ...r, status } : r)) }));
      showToast(`Status updated to "${status}"`, 'success');
    } else {
      showToast(res.error || 'Update failed', 'error');
    }
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Document Requests</h2><p>Review and update status for all student document requests</p></div>
        <button className="btn btn-outline" onClick={reload}>↺ Refresh</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Student</th><th>Document Type</th><th>Urgency</th><th>Submitted</th><th>Status</th><th>Update</th></tr>
            </thead>
            <tbody>
              {!loaded && <tr><td colSpan={6} style={loadingCellStyle}>Loading…</td></tr>}
              {loaded && !data.requests.length && <tr><td colSpan={6} style={emptyCellStyle}>No requests yet</td></tr>}
              {loaded && data.requests.map(r => (
                <tr key={r._id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.student?.name || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.student?.studentId || r.studentId || ''}</div>
                  </td>
                  <td>{r.type}</td>
                  <td><span className={`badge ${r.urgency === 'Urgent' ? 'badge-danger' : 'badge-muted'}`}>{r.urgency || 'Normal'}</span></td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td><span className={`badge ${REQ_BADGE[r.status] || 'badge-muted'}`}>{r.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <select
                        className="form-select"
                        style={{ padding: '4px 8px', fontSize: 12, height: 32, minWidth: 140 }}
                        value={picked[r._id] ?? r.status}
                        onChange={e => setPicked(p => ({ ...p, [r._id]: e.target.value }))}
                      >
                        {REQ_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(r._id)}>Update</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
