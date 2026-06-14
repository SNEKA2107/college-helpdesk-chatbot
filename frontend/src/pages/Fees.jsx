import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../utils/format';

const fmtAmt = n => '₹' + Number(n).toLocaleString('en-IN');
const MODE_CLASS = { Online: 'badge-primary', DD: 'badge-muted', Cash: 'badge-warning', NEFT: 'badge-success' };
const PAYMENT_MODES = ['Online', 'UPI', 'NEFT', 'DD', 'Cash'];

export default function Fees() {
  const showToast = useToast();
  const [fees, setFees] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', mode: 'Online', txn: '' });
  const [recording, setRecording] = useState(false);

  function loadFees() {
    apiCall('/fees').then(res => { if (res.ok) setFees(res.data.fees); });
  }
  useEffect(() => { loadFees(); }, []);

  async function recordPayment() {
    const amount = Number(payForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { showToast('Enter a valid payment amount', 'error'); return; }
    // Map the UPI label onto the schema's 'Online' mode (gateway-agnostic).
    const mode = payForm.mode === 'UPI' ? 'Online' : payForm.mode;
    setRecording(true);
    const res = await apiCall('/fees/payment', { method: 'POST', body: JSON.stringify({ amount, mode, txn: payForm.txn.trim() || undefined }) });
    setRecording(false);
    if (res.ok) {
      setPayForm({ amount: '', mode: 'Online', txn: '' });
      loadFees();
      showToast(res.data.message || 'Payment recorded — pending verification', 'success');
    } else {
      showToast(res.error || 'Failed to record payment', 'error');
    }
  }

  const isPaid = fees?.status === 'Paid';

  return (
    <Layout title="Fee Information">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Fee Information</h2>
          <p>Semester fee breakdown, payment status and history</p>
        </div>
        <button className="btn btn-primary" onClick={() => (fees ? window.print() : showToast('No fee record to print yet', 'info'))}>⬇ Download Receipt</button>
      </div>

      <div className="stats-grid mb-6">
        <div className="stat-card"><div className="stat-icon si-blue">💰</div><div className="stat-info"><h3>{fees ? fmtAmt(fees.total) : '—'}</h3><p>Total Fee Amount</p></div></div>
        <div className="stat-card"><div className="stat-icon si-green">✅</div><div className="stat-info"><h3>{fees ? fmtAmt(fees.amountPaid) : '—'}</h3><p>Amount Paid</p></div></div>
        <div className="stat-card"><div className="stat-icon si-orange">⏳</div><div className="stat-info"><h3>{fees ? fmtAmt(fees.balance) : '—'}</h3><p>Balance Due</p></div></div>
        <div className="stat-card"><div className="stat-icon si-purple">📅</div><div className="stat-info"><h3>{fees ? new Date(fees.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</h3><p>Next Due Date</p></div></div>
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header">
            <div className="card-title">💳 Semester Fee Breakdown</div>
            <span className={`badge ${isPaid ? 'badge-success' : 'badge-danger'}`}>{isPaid ? '✅ Fully Paid' : '⏳ Due'}</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Fee Component</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {!fees && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
                {(fees?.components || []).map(c => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>{fmtAmt(c.amount)}</td>
                    <td><span className={`badge ${isPaid ? 'badge-success' : 'badge-warning'}`}>{isPaid ? 'Paid' : 'Pending'}</span></td>
                  </tr>
                ))}
                {fees && (
                  <tr style={{ fontWeight: 700, background: 'var(--primary-bg,#eef2ff)' }}>
                    <td><strong>Total</strong></td>
                    <td><strong>{fmtAmt(fees.total)}</strong></td>
                    <td><span className={`badge ${isPaid ? 'badge-success' : 'badge-danger'}`}>{isPaid ? '✅ Cleared' : '⏳ Pending'}</span></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {fees && (isPaid ? (
            <div className="alert alert-success mt-4">
              <span>🎉</span>
              <div>All fees for this semester have been paid successfully. No dues outstanding.</div>
            </div>
          ) : (
            <div className="alert alert-warning mt-4">
              <span>⚠️</span>
              <div>Fee balance of {fmtAmt(fees.balance)} is due by <strong>{formatDate(fees.dueDate)}</strong>. Late payment attracts a fine of ₹{fees.lateFine}.</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">📜 Payment History</div></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Mode</th><th>Status</th></tr></thead>
              <tbody>
                {!fees && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
                {fees && !fees.history?.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No payments recorded yet</td></tr>}
                {(fees?.history || []).map((p, i) => (
                  <tr key={i}>
                    <td>{formatDate(p.date)}</td>
                    <td>{p.description}</td>
                    <td style={{ color: 'var(--secondary)', fontWeight: 600 }}>{fmtAmt(p.amount)}</td>
                    <td><span className={`badge ${MODE_CLASS[p.mode] || 'badge-muted'}`}>{p.mode}</span></td>
                    <td><span className={`badge ${p.verified ? 'badge-success' : 'badge-warning'}`}>{p.verified ? '✅ Verified' : '⏳ Pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fees && (
            <div className="alert alert-warning mt-4">
              <span>⚠️</span>
              <div>Fee payment deadline: <strong>{formatDate(fees.dueDate)}</strong>. Late payment attracts a fine of ₹{fees.lateFine}.</div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">💳 Record a Payment</div>
          <span className="badge badge-primary">Verified by admin</span>
        </div>
        {fees && isPaid ? (
          <div className="alert alert-success">
            <span>🎉</span>
            <div>All fees for this semester are cleared. No payment to record.</div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              Record a fee payment you have made. It will appear as <strong>Pending</strong> until the admin office verifies it.
              {fees && <> Balance due: <strong>{fmtAmt(fees.balance)}</strong>.</>}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input type="number" className="form-input" placeholder="e.g. 25000" min="1"
                  value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Mode</label>
                <select className="form-select" style={{ paddingLeft: 14 }}
                  value={payForm.mode} onChange={e => setPayForm(f => ({ ...f, mode: e.target.value }))}>
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Transaction / Ref ID</label>
                <input type="text" className="form-input" placeholder="Optional"
                  value={payForm.txn} onChange={e => setPayForm(f => ({ ...f, txn: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-primary btn-full" onClick={recordPayment} disabled={recording || !fees}>
              {recording ? 'Recording…' : 'Record Payment'}
            </button>
          </>
        )}
      </div>
    </Layout>
  );
}
