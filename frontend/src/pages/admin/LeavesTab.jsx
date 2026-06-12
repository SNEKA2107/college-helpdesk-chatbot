import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/format';
import { LV_BADGE, emptyCellStyle, loadingCellStyle } from './shared';

export default function LeavesTab({ data, setData, loaded, reload }) {
  const showToast = useToast();

  async function updateStatus(id, status) {
    const res = await apiCall(`/leave/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (res.ok) {
      setData(d => ({ ...d, leaves: d.leaves.map(l => (l._id === id ? { ...l, status, approvedBy: 'Admin' } : l)) }));
      showToast(`Leave ${status.toLowerCase()} successfully`, 'success');
    } else {
      showToast(res.error || 'Action failed', 'error');
    }
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Leave Applications</h2><p>Approve or reject student leave applications</p></div>
        <button className="btn btn-outline" onClick={reload}>↺ Refresh</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Student</th><th>Leave Type</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {!loaded && <tr><td colSpan={7} style={loadingCellStyle}>Loading…</td></tr>}
              {loaded && !data.leaves.length && <tr><td colSpan={7} style={emptyCellStyle}>No leave applications yet</td></tr>}
              {loaded && data.leaves.map(l => (
                <tr key={l._id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.name || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.studentId || ''}</div>
                  </td>
                  <td>{l.leaveType}</td>
                  <td>{formatDate(l.fromDate)}</td>
                  <td>{formatDate(l.toDate)}</td>
                  <td style={{ maxWidth: 200, fontSize: 13 }}>{(l.reason || '').slice(0, 60)}{l.reason?.length > 60 ? '…' : ''}</td>
                  <td><span className={`badge ${LV_BADGE[l.status] || 'badge-muted'}`}>{l.status}</span></td>
                  <td>
                    {l.status === 'Pending' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm" style={{ background: 'var(--secondary)', color: '#fff', padding: '4px 10px' }} onClick={() => updateStatus(l._id, 'Approved')}>✓ Approve</button>
                        <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', padding: '4px 10px' }} onClick={() => updateStatus(l._id, 'Rejected')}>✗ Reject</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.status} by {l.approvedBy || 'Admin'}</span>
                    )}
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
