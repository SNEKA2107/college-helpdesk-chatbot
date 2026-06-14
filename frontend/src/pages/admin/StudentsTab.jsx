import { useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { emptyCellStyle, loadingCellStyle } from './shared';

const APPROVAL_BADGE = { approved: 'badge-success', pending: 'badge-warning', rejected: 'badge-danger' };
const FILTERS = ['All', 'Pending', 'Approved', 'Rejected'];
const norm = (s) => (s.approvalStatus || 'approved'); // legacy rows w/o the field are approved

export default function StudentsTab({ data, loaded, reload }) {
  const showToast = useToast();
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const pendingCount = data.students.filter(s => norm(s) === 'pending').length;

  const q = applied.toLowerCase().trim();
  let list = data.students;
  if (statusFilter !== 'All') list = list.filter(s => norm(s) === statusFilter.toLowerCase());
  if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q));

  async function decide(id, action) {
    const res = await apiCall(`/students/${id}/${action}`, { method: 'PUT' });
    if (res.ok) {
      showToast(`Registration ${action === 'approve' ? 'approved' : 'rejected'}`, 'success');
      reload();
    } else {
      showToast(res.error || 'Action failed', 'error');
    }
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text">
          <h2>All Students</h2>
          <p>All registered students{pendingCount ? ` · ${pendingCount} awaiting approval` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="form-select" style={{ paddingLeft: 14, width: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {FILTERS.map(f => <option key={f} value={f}>{f}{f === 'Pending' && pendingCount ? ` (${pendingCount})` : ''}</option>)}
          </select>
          <input
            type="text" className="form-input" placeholder="Search by name or ID…" style={{ width: 200 }}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setApplied(query); }}
          />
          <button className="btn btn-secondary" onClick={() => setApplied(query)}>Search</button>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">{statusFilter} Students ({list.length})</div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Student</th><th>Register No.</th><th>Department</th><th>Year/Sec</th><th>Approval</th><th>Account</th><th>Action</th></tr>
            </thead>
            <tbody>
              {!loaded && <tr><td colSpan={7} style={loadingCellStyle}>Loading…</td></tr>}
              {loaded && !list.length && <tr><td colSpan={7} style={emptyCellStyle}>No students found</td></tr>}
              {loaded && list.map(s => {
                const status = norm(s);
                return (
                  <tr key={s._id || s.studentId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                          {(s.name || '?')[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.email || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.studentId}</td>
                    <td>{s.department || '—'} · {s.semester || '—'}</td>
                    <td>{(s.year || '—')}{s.section ? ` / ${s.section}` : ''}</td>
                    <td><span className={`badge ${APPROVAL_BADGE[status] || 'badge-muted'}`}>{status}</span></td>
                    <td><span className={`badge ${s.isActive ? 'badge-success' : 'badge-danger'}`}>{s.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      {status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm" style={{ background: 'var(--secondary)', color: '#fff', padding: '4px 10px' }} onClick={() => decide(s._id, 'approve')}>✓ Approve</button>
                          <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', padding: '4px 10px' }} onClick={() => decide(s._id, 'reject')}>✗ Reject</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
