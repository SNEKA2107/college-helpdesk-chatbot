import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { apiCall } from '../services/api';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../utils/format';

const STATUS_BADGE = {
  'Submitted':            <span className="badge badge-warning">🕐 Submitted</span>,
  'Under Review':         <span className="badge badge-primary">🔍 Under Review</span>,
  'Processing':           <span className="badge badge-primary">⏳ Processing</span>,
  'Ready for Collection': <span className="badge badge-success">📦 Ready for Collection</span>,
  'Completed':            <span className="badge badge-success">✅ Completed</span>,
  'Rejected':             <span className="badge badge-danger">❌ Rejected</span>,
};

const REQUEST_TYPES = ['Marksheet', 'Bonafide Certificate', 'Transfer Certificate', 'Migration Certificate', 'Conduct Certificate', 'Provisional Certificate', 'Other'];
const URGENCIES = ['Normal (5-7 working days)', 'Urgent (2-3 working days)', 'Emergency (1 day)'];

const isInProgress = status => ['Under Review', 'Processing', 'Ready for Collection'].includes(status);

export default function Requests() {
  const showToast = useToast();
  const [requests, setRequests] = useState(null);
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ type: '', purpose: '', urgency: URGENCIES[0] });
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(false);

  async function loadRequests() {
    const result = await apiCall('/requests');
    if (result.ok) setRequests(result.data.requests);
    else setLoadError(true);
  }
  useEffect(() => { loadRequests(); }, []);

  async function submitRequest() {
    if (!form.type) { showToast('Please select a request type', 'error'); return; }
    if (!form.purpose.trim()) { showToast('Please provide a reason', 'error'); return; }
    setSubmitting(true);
    const result = await apiCall('/requests', {
      method: 'POST',
      body: JSON.stringify({ type: form.type, purpose: form.purpose.trim(), urgency: form.urgency.split(' ')[0] }),
    });
    setSubmitting(false);
    if (result.ok) {
      setModalOpen(false);
      setForm({ type: '', purpose: '', urgency: URGENCIES[0] });
      showToast('Request submitted successfully!', 'success');
      loadRequests();
    } else {
      showToast(result.error || 'Failed to submit request', 'error');
    }
  }

  const filtered = !requests ? []
    : filter === 'all' ? requests
    : filter === 'progress' ? requests.filter(r => isInProgress(r.status))
    : requests.filter(r => r.status === filter);

  const tabClass = key => `btn btn-sm ${filter === key ? 'btn-primary' : 'btn-secondary'}`;

  const statusOrder = ['Submitted', 'Under Review', 'Processing', 'Ready for Collection', 'Completed'];
  const detailIdx = detail ? statusOrder.indexOf(detail.status) : -1;
  const isRejected = detail?.status === 'Rejected';
  const verifyDone  = detailIdx >= 1 || isRejected;
  const processDone = detailIdx >= 2 || isRejected;
  const readyDone   = detailIdx >= 3;

  return (
    <Layout title="My Requests">
      <div className="page-header">
        <div className="page-header-text">
          <h2>My Requests</h2>
          <p>Track all your document and service requests</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)} disabled={!requests}>+ New Request</button>
      </div>

      <div className="flex gap-3 mb-6" style={{ flexWrap: 'wrap' }}>
        <button className={tabClass('all')} onClick={() => setFilter('all')}>All</button>
        <button className={tabClass('Completed')} onClick={() => setFilter('Completed')}>Completed</button>
        <button className={tabClass('progress')} onClick={() => setFilter('progress')}>In Progress</button>
        <button className={tabClass('Submitted')} onClick={() => setFilter('Submitted')}>Pending</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loadError && <p style={{ color: 'var(--danger)', textAlign: 'center', padding: '32px 0' }}>Failed to load requests. Please refresh.</p>}
        {!requests && !loadError && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>Loading requests…</p>}
        {requests && !filtered.length && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>No requests found. Click "+ New Request" to submit one.</p>
        )}
        {filtered.map(r => (
          <div key={r._id} className="req-card">
            <div className="req-left">
              <div className="req-icon si-blue">📄</div>
              <div className="req-info">
                <h3>{r.type}</h3>
                <p>Submitted {formatDate(r.createdAt)} · Ref: {r.refNumber || '—'}</p>
              </div>
            </div>
            <div className="req-right">
              {STATUS_BADGE[r.status] || null}
              <button className="btn btn-secondary btn-sm" onClick={() => setDetail(r)}>View Details</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Request" subtitle="Submit a new document or service request">
        <div className="form-group">
          <label className="form-label">Request Type</label>
          <select className="form-select" style={{ paddingLeft: 14 }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="">Select request type</option>
            {REQUEST_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Purpose / Reason</label>
          <textarea className="form-textarea" placeholder="Briefly describe why you need this document…"
            value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}></textarea>
        </div>
        <div className="form-group">
          <label className="form-label">Urgency</label>
          <select className="form-select" style={{ paddingLeft: 14 }} value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}>
            {URGENCIES.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <button className="btn btn-primary btn-full" onClick={submitRequest} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.type || 'Request Details'} subtitle="Current request status and information">
        <div className="step-row">
          <div className="step-left"><div className="step-dot dot-success"></div><span style={{ fontSize: 13.5 }}>Request Submitted</span></div>
          <span className="badge badge-success">Done</span>
        </div>
        <div className="step-row">
          <div className="step-left"><div className="step-dot dot-success"></div><span style={{ fontSize: 13.5 }}>Under Review</span></div>
          <span className={`badge ${verifyDone ? 'badge-success' : 'badge-muted'}`}>{verifyDone ? 'Done' : 'Pending'}</span>
        </div>
        <div className="step-row">
          <div className="step-left"><div className={`step-dot ${processDone ? 'dot-success' : 'dot-muted'}`}></div><span style={{ fontSize: 13.5 }}>Processing</span></div>
          <span className={`badge ${processDone ? 'badge-success' : 'badge-muted'}`}>{processDone ? 'Done' : 'Pending'}</span>
        </div>
        <div className="step-row">
          <div className="step-left"><div className={`step-dot ${readyDone ? 'dot-success' : 'dot-muted'}`}></div><span style={{ fontSize: 13.5 }}>Ready for Collection</span></div>
          <span className={`badge ${readyDone ? 'badge-success' : 'badge-muted'}`}>{readyDone ? 'Done' : 'Pending'}</span>
        </div>
        <div className="alert alert-info mt-4">
          {detail?.remarks || 'Your request is being processed. You will be notified of updates.'}
        </div>
      </Modal>
    </Layout>
  );
}
