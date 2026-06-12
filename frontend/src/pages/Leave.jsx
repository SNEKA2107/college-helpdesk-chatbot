import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { getUser } from '../services/auth';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../utils/format';

const LEAVE_TYPES = ['Medical Leave', 'Personal Leave', 'On Duty (OD) – Event', 'On Duty (OD) – Training', 'Emergency Leave', 'Family Function'];
const DEPTS = ['IT', 'CSE', 'ECE', 'EEE', 'MECH'];
const SEMS = ['5th', '1st', '2nd', '3rd', '4th', '6th', '7th', '8th'];

const LEAVE_BADGE = {
  Pending:  <span className="badge badge-warning">⏳ Pending</span>,
  Approved: <span className="badge badge-success">✅ Approved</span>,
  Rejected: <span className="badge badge-danger">❌ Rejected</span>,
};

export default function Leave() {
  const showToast = useToast();
  const user = getUser();
  const todayStr = new Date().toISOString().split('T')[0];

  const [leaves, setLeaves] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '', regNo: user?.studentId || '',
    dept: DEPTS[0], sem: SEMS[0],
    leaveType: '', fromDate: '', toDate: '', reason: '',
  });
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  async function loadHistory() {
    const result = await apiCall('/leave');
    if (result.ok) setLeaves(result.data.leaves);
    else setLoadError(true);
  }
  useEffect(() => { loadHistory(); }, []);

  async function submitLeave() {
    const { leaveType, fromDate, toDate, reason } = form;
    if (!leaveType) { showToast('Please select a leave type', 'error'); return; }
    if (!fromDate)  { showToast('Please select From Date', 'error'); return; }
    if (!toDate)    { showToast('Please select To Date', 'error'); return; }
    if (!reason.trim()) { showToast('Please enter a reason', 'error'); return; }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(0, 0, 0, 0);
    if (from < today) { showToast('From Date cannot be in the past', 'error'); return; }
    if (to < from)    { showToast('To Date cannot be before From Date', 'error'); return; }

    setSubmitting(true);
    const result = await apiCall('/leave', {
      method: 'POST',
      body: JSON.stringify({ leaveType, fromDate, toDate, reason: reason.trim() }),
    });
    setSubmitting(false);
    if (result.ok) {
      setSubmitted(true);
      loadHistory();
    } else {
      showToast(result.error || 'Failed to submit leave application', 'error');
    }
  }

  function resetForm() {
    setForm(f => ({ ...f, leaveType: '', fromDate: '', toDate: '', reason: '' }));
    setSubmitted(false);
  }

  const dayCount = l => Math.ceil((new Date(l.toDate) - new Date(l.fromDate)) / 86400000) + 1;

  return (
    <Layout title="Leave Application">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Leave Application</h2>
          <p>Apply for leave or on-duty and track approval status</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><div className="card-title">📝 Apply for Leave / OD</div></div>

          {!submitted ? (
            <div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Student Name</label>
                  <input type="text" className="form-input" placeholder="Your full name" value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Register Number</label>
                  <input type="text" className="form-input" placeholder="e.g. 22IT101" value={form.regNo} onChange={e => set('regNo', e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" style={{ paddingLeft: 14 }} value={form.dept} onChange={e => set('dept', e.target.value)}>
                    {DEPTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <select className="form-select" style={{ paddingLeft: 14 }} value={form.sem} onChange={e => set('sem', e.target.value)}>
                    {SEMS.map(sm => <option key={sm}>{sm}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Leave Type</label>
                <select className="form-select" style={{ paddingLeft: 14 }} value={form.leaveType} onChange={e => set('leaveType', e.target.value)}>
                  <option value="">Select leave type</option>
                  {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">From Date</label>
                  <input type="date" className="form-input" min={todayStr} value={form.fromDate} onChange={e => set('fromDate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date</label>
                  <input type="date" className="form-input" min={form.fromDate || todayStr} value={form.toDate} onChange={e => set('toDate', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Leave</label>
                <textarea className="form-textarea" placeholder="Describe your reason clearly…" value={form.reason} onChange={e => set('reason', e.target.value)}></textarea>
              </div>

              <div className="form-group">
                <label className="form-label">Supporting Document (optional)</label>
                <input type="file" className="form-input" accept=".pdf,.jpg,.png" style={{ padding: 8 }} />
              </div>

              <div className="alert alert-warning mb-4">
                <span>⚠️</span>
                <div>Applications submitted after the leave period will not be accepted. Medical leave requires a doctor's certificate.</div>
              </div>

              <button className="btn btn-primary btn-full" onClick={submitLeave} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Application →'}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--dark)', marginBottom: 8 }}>Leave Application Submitted!</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>Your application has been submitted and is pending approval from your class advisor.</p>
              <button className="btn btn-primary" onClick={resetForm}>Apply for Another Leave</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">📋 My Leave History</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loadError && <p style={{ color: 'var(--danger)', textAlign: 'center', padding: '20px 0' }}>Failed to load leave history.</p>}
            {!leaves && !loadError && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading leave history…</p>}
            {leaves && !leaves.length && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No leave applications yet.</p>}
            {(leaves || []).map(l => (
              <div key={l._id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{l.leaveType}</span>
                  {LEAVE_BADGE[l.status] || null}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {formatDate(l.fromDate)} – {formatDate(l.toDate)} ({dayCount(l)} day{dayCount(l) > 1 ? 's' : ''})
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 4 }}>{l.reason}</div>
                {l.remarks && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>Remarks: {l.remarks}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
