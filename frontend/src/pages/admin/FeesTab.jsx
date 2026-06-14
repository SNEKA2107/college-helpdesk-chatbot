import { useEffect, useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';

const fmtAmt = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const sumAll = h => (h || []).reduce((s, p) => s + p.amount, 0);
const sumVerified = h => (h || []).reduce((s, p) => s + (p.verified ? p.amount : 0), 0);

// CRIT-05: Admin verifies student-recorded fee payments.
//   GET /api/fees/all
//   PUT /api/fees/:feeId/payments/:index/verify
export default function FeesTab() {
  const showToast = useToast();
  const [fees, setFees] = useState(null);
  const [busy, setBusy] = useState('');

  function load() {
    apiCall('/fees/all').then(res => setFees(res.ok ? res.data.fees || [] : []));
  }
  useEffect(() => { load(); }, []);

  async function verify(feeId, index, key) {
    setBusy(key);
    const res = await apiCall(`/fees/${feeId}/payments/${index}/verify`, { method: 'PUT' });
    setBusy('');
    if (res.ok) { load(); showToast('Payment verified', 'success'); }
    else showToast(res.error || 'Verification failed', 'error');
  }

  const pendingCount = (fees || []).reduce((n, f) => n + (f.history || []).filter(p => !p.verified).length, 0);

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Fee Verification</h2><p>Review and verify student-recorded fee payments</p></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">💳 Student Fee Records</div>
          <span className={`badge ${pendingCount ? 'badge-warning' : 'badge-success'}`}>
            {pendingCount ? `${pendingCount} pending` : 'All verified'}
          </span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Student</th><th>Total</th><th>Verified</th><th>Balance</th><th>Payments</th></tr></thead>
            <tbody>
              {!fees && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
              {fees && !fees.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No fee records found</td></tr>}
              {(fees || []).map(f => {
                const verified = sumVerified(f.history);
                const recorded = sumAll(f.history);
                return (
                  <tr key={f._id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{f.student?.name || f.studentId}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.student?.studentId || f.studentId} · Sem {f.semester}</div>
                    </td>
                    <td>{fmtAmt(f.total)}</td>
                    <td><span className={`badge ${verified >= f.total ? 'badge-success' : 'badge-muted'}`}>{fmtAmt(verified)}</span></td>
                    <td style={{ fontWeight: 600 }}>{fmtAmt(f.total - recorded)}</td>
                    <td>
                      {!f.history?.length && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>None</span>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(f.history || []).map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                            <span>{fmtAmt(p.amount)} · {p.mode} · {p.txn || 'MANUAL'}</span>
                            {p.verified
                              ? <span className="badge badge-success" style={{ fontSize: 10 }}>✅ Verified</span>
                              : (
                                <button className="btn btn-sm btn-primary" style={{ padding: '2px 10px', fontSize: 11 }}
                                  disabled={busy === `${f._id}-${i}`}
                                  onClick={() => verify(f._id, i, `${f._id}-${i}`)}>
                                  {busy === `${f._id}-${i}` ? '…' : 'Verify'}
                                </button>
                              )}
                          </div>
                        ))}
                      </div>
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
