import { useEffect, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/format';
import '../../styles/faculty.css';

const STATUS_BADGE = { Pending: 'badge-warning', Approved: 'badge-success', Rejected: 'badge-danger' };

export default function FacultyLeaveOD() {
  const showToast = useToast();
  const [leaves, setLeaves] = useState(null);
  const [tab, setTab] = useState('Pending');
  const [remarks, setRemarks] = useState({}); // id -> remark text

  function load() {
    apiCall('/faculty-portal/leaves').then(res => { if (res.ok) setLeaves(res.data.leaves || []); });
  }
  useEffect(load, []);

  async function decide(id, status) {
    const res = await apiCall(`/faculty-portal/leaves/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, remarks: remarks[id] || '' }),
    });
    if (res.ok) { showToast(`Request ${status.toLowerCase()}`, 'success'); load(); }
    else showToast(res.error || 'Action failed', 'error');
  }

  const shown = (leaves || []).filter(l => (tab === 'All' ? true : l.status === tab));

  return (
    <FacultyShell title="Leave & OD">
      <div className="page-header">
        <div className="page-header-text"><h2>Leave & OD Requests</h2><p>Approve or reject requests from your department</p></div>
      </div>

      <div className="card">
        <div className="fac-tabs">
          {['Pending', 'Approved', 'Rejected', 'All'].map(t => (
            <button key={t} className={`fac-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="table">
            <thead><tr><th>Student</th><th>Type</th><th>Dates</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {!leaves && <tr><td colSpan={6} className="fac-center">Loading…</td></tr>}
              {leaves && !shown.length && <tr><td colSpan={6} className="fac-center">No {tab.toLowerCase()} requests.</td></tr>}
              {shown.map(l => (
                <tr key={l._id}>
                  <td><div style={{ fontWeight: 600 }}>{l.name}</div><div className="fac-muted" style={{ fontSize: 12 }}>{l.studentId} · {l.department}</div></td>
                  <td>{l.leaveType}</td>
                  <td className="fac-muted" style={{ fontSize: 12 }}>{formatDate(l.fromDate)} → {formatDate(l.toDate)}</td>
                  <td style={{ maxWidth: 220 }}>{l.reason}</td>
                  <td><span className={`badge ${STATUS_BADGE[l.status] || 'badge-muted'}`}>{l.status}</span>{l.remarks ? <div className="fac-muted" style={{ fontSize: 11, marginTop: 4 }}>“{l.remarks}”</div> : null}</td>
                  <td>
                    {l.status === 'Pending' ? (
                      <div style={{ minWidth: 200 }}>
                        <input className="fac-mark-input" style={{ width: '100%', marginBottom: 6 }} placeholder="Remarks (optional)"
                          value={remarks[l._id] || ''} onChange={e => setRemarks(r => ({ ...r, [l._id]: e.target.value }))} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm" style={{ background: 'var(--secondary)', color: '#fff' }} onClick={() => decide(l._id, 'Approved')}>Approve</button>
                          <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => decide(l._id, 'Rejected')}>Reject</button>
                        </div>
                      </div>
                    ) : <span className="fac-muted" style={{ fontSize: 12 }}>by {l.approvedBy || '—'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </FacultyShell>
  );
}
