import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { timeAgo } from '../../utils/format';
import { emptyCellStyle, loadingCellStyle } from './shared';

export default function MessagesTab({ data, setData, loaded, reload }) {
  const showToast = useToast();

  async function resolveMessage(id) {
    const res = await apiCall(`/contact/${id}/resolve`, { method: 'PUT' });
    if (res.ok) {
      setData(d => ({ ...d, messages: d.messages.map(m => (m._id === id ? { ...m, status: 'Resolved' } : m)) }));
      showToast('Marked as resolved', 'success');
    } else {
      showToast(res.error || 'Action failed', 'error');
    }
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Student Messages</h2><p>Contact messages sent by students to college offices</p></div>
        <button className="btn btn-outline" onClick={reload}>↺ Refresh</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Student</th><th>To Department</th><th>Subject &amp; Message</th><th>Received</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {!loaded && <tr><td colSpan={6} style={loadingCellStyle}>Loading…</td></tr>}
              {loaded && !data.messages.length && <tr><td colSpan={6} style={emptyCellStyle}>No messages from students yet</td></tr>}
              {loaded && data.messages.map(m => (
                <tr key={m._id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.name || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.studentId || ''} · {m.email || ''}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{m.department}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.subject}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 220 }}>{(m.message || '').slice(0, 80)}{m.message?.length > 80 ? '…' : ''}</div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{timeAgo(m.createdAt)}</td>
                  <td><span className={`badge ${m.status === 'Resolved' ? 'badge-success' : 'badge-warning'}`}>{m.status}</span></td>
                  <td>
                    {m.status === 'Open'
                      ? <button className="btn btn-secondary btn-sm" onClick={() => resolveMessage(m._id)}>Mark Resolved</button>
                      : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Resolved</span>}
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
