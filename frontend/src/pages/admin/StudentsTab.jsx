import { useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { emptyCellStyle, loadingCellStyle } from './shared';

const APPROVAL_BADGE = { approved: 'badge-success', pending: 'badge-warning', rejected: 'badge-danger' };
const FILTERS = ['All', 'Pending', 'Approved', 'Rejected'];
const norm = (s) => (s.approvalStatus || 'approved'); // legacy rows w/o the field are approved
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '—');

export default function StudentsTab({ data, loaded, reload }) {
  const showToast = useToast();
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [detail, setDetail] = useState(null);        // student shown in the details modal
  const [rejecting, setRejecting] = useState(false);  // reject-reason input open in modal
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const pendingCount = data.students.filter(s => norm(s) === 'pending').length;

  const q = applied.toLowerCase().trim();
  let list = data.students;
  if (statusFilter !== 'All') list = list.filter(s => norm(s) === statusFilter.toLowerCase());
  if (q) list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.studentId || '').toLowerCase().includes(q));

  function openDetail(s) { setDetail(s); setRejecting(false); setReason(''); }
  function closeDetail() { setDetail(null); setRejecting(false); setReason(''); }

  async function decide(id, action, rejectReason) {
    setBusy(true);
    const res = await apiCall(`/students/${id}/${action}`, {
      method: 'PUT',
      ...(action === 'reject' ? { body: JSON.stringify({ reason: rejectReason || '' }) } : {}),
    });
    setBusy(false);
    if (res.ok) {
      showToast(`Registration ${action === 'approve' ? 'approved' : 'rejected'}`, 'success');
      closeDetail();
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
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button className="btn btn-sm btn-secondary" style={{ padding: '4px 10px' }} onClick={() => openDetail(s)}>Details</button>
                        {status === 'pending' && (
                          <>
                            <button className="btn btn-sm" style={{ background: 'var(--secondary)', color: '#fff', padding: '4px 10px' }} onClick={() => decide(s._id, 'approve')}>✓ Approve</button>
                            <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', padding: '4px 10px' }} onClick={() => openDetail(s)}>✗ Reject</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={closeDetail}>
          <div className="card" style={{ width: 'min(560px, 92vw)', maxHeight: '88vh', overflow: 'auto', margin: 0 }} onClick={e => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">Registration Details</div>
              <button className="btn btn-sm btn-secondary" onClick={closeDetail} aria-label="Close details">✕</button>
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13.5 }}>
              <Field label="Name" value={detail.name} />
              <Field label="Register No." value={detail.studentId} />
              <Field label="Email" value={detail.email} />
              <Field label="Phone" value={detail.phone} />
              <Field label="Department" value={detail.department} />
              <Field label="Semester" value={detail.semester} />
              <Field label="Year" value={detail.year} />
              <Field label="Section" value={detail.section} />
              <Field label="Approval Status" value={norm(detail)} />
              <Field label="Account" value={detail.isActive ? 'Active' : 'Inactive'} />
              <Field label="Registered On" value={fmtDate(detail.createdAt)} />
              <Field label="Decided On" value={fmtDate(detail.approvedAt)} />
              {norm(detail) === 'rejected' && detail.rejectionReason && (
                <div style={{ gridColumn: '1 / -1' }}><Field label="Rejection Reason" value={detail.rejectionReason} /></div>
              )}
            </div>

            {norm(detail) === 'pending' && (
              <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
                {!rejecting ? (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn" disabled={busy} style={{ background: 'var(--secondary)', color: '#fff' }} onClick={() => decide(detail._id, 'approve')}>✓ Approve</button>
                    <button className="btn" disabled={busy} style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => setRejecting(true)}>✗ Reject</button>
                  </div>
                ) : (
                  <div>
                    <label className="form-label" style={{ fontSize: 13 }}>Rejection reason <span style={{ color: 'var(--text-muted)' }}>(optional — shown to the student)</span></label>
                    <textarea className="form-input" rows={2} style={{ width: '100%', resize: 'vertical' }} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Register number does not match college records" />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                      <button className="btn btn-secondary" disabled={busy} onClick={() => setRejecting(false)}>Cancel</button>
                      <button className="btn" disabled={busy} style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => decide(detail._id, 'reject', reason)}>Confirm Reject</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value || '—'}</div>
    </div>
  );
}
