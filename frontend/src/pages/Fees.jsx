import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../utils/format';

const fmtAmt = n => '₹' + Number(n).toLocaleString('en-IN');
const MODE_CLASS = { Online: 'badge-primary', DD: 'badge-muted' };

const PAYMENT_METHODS = [
  { icon: '🏦', name: 'Net Banking', desc: 'All major banks supported' },
  { icon: '📱', name: 'UPI', desc: 'GPay, PhonePe, Paytm' },
  { icon: '💳', name: 'Card Payment', desc: 'Debit & Credit cards' },
];

export default function Fees() {
  const showToast = useToast();
  const [fees, setFees] = useState(null);

  useEffect(() => {
    apiCall('/fees').then(res => { if (res.ok) setFees(res.data.fees); });
  }, []);

  const isPaid = fees?.status === 'Paid';

  return (
    <Layout title="Fee Information">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Fee Information</h2>
          <p>Semester fee breakdown, payment status and history</p>
        </div>
        <button className="btn btn-primary" onClick={() => showToast('Receipt download coming soon', 'info')}>⬇ Download Receipt</button>
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
              <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Mode</th></tr></thead>
              <tbody>
                {!fees && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
                {(fees?.history || []).map((p, i) => (
                  <tr key={i}>
                    <td>{formatDate(p.date)}</td>
                    <td>{p.description}</td>
                    <td style={{ color: 'var(--secondary)', fontWeight: 600 }}>{fmtAmt(p.amount)}</td>
                    <td><span className={`badge ${MODE_CLASS[p.mode] || 'badge-muted'}`}>{p.mode}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="alert alert-warning mt-4">
            <span>⚠️</span>
            <div>Next semester fee payment deadline: <strong>25 May 2026</strong>. Late payment attracts a fine of ₹500.</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">💳 Online Payment Options</div>
          <span className="badge badge-primary">Secure</span>
        </div>
        <div className="grid-3">
          {PAYMENT_METHODS.map(m => (
            <div key={m.name} style={{ textAlign: 'center', padding: 20, borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{m.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{m.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={() => showToast('Payment portal will open when backend is connected', 'info')}>
            Pay Fees Online →
          </button>
        </div>
      </div>
    </Layout>
  );
}
