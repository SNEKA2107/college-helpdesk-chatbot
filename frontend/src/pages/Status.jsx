import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { formatDate } from '../utils/format';
import '../styles/status.css';

const STATUS_STEPS = ['Submitted', 'Under Review', 'Processing', 'Ready for Collection', 'Completed'];
const STATUS_PROGRESS = { Submitted: 20, 'Under Review': 40, Processing: 60, 'Ready for Collection': 85, Completed: 100, Rejected: 0 };
const STATUS_BADGE = {
  Submitted: 'badge-muted', 'Under Review': 'badge-warning', Processing: 'badge-primary',
  'Ready for Collection': 'badge-info', Completed: 'badge-success', Rejected: 'badge-danger',
};
const DOT_COLORS = { Completed: 'dot-success', Processing: 'dot-primary', 'Under Review': 'dot-warning', 'Ready for Collection': 'dot-primary', Submitted: 'dot-muted', Rejected: 'dot-danger' };

const DOC_SHORTCUTS = ['📄 Marksheet', '📜 Bonafide Certificate', '📋 Transfer Certificate', '🏅 Conduct Certificate', '📃 Provisional Certificate'];

function Timeline({ request }) {
  const stepIdx = STATUS_STEPS.indexOf(request.status);
  return (
    <div className="timeline">
      {STATUS_STEPS.map((step, i) => {
        const isDone = i < stepIdx || request.status === 'Completed';
        const isActive = i === stepIdx && request.status !== 'Completed' && request.status !== 'Rejected';
        return (
          <div key={step} className="tl-item">
            <div className={`tl-dot ${isDone ? 'done' : isActive ? 'active' : 'waiting'}`}>{isDone ? '✓' : isActive ? '●' : ''}</div>
            <div className={`tl-content ${isDone ? 'done-bg' : isActive ? 'active-bg' : ''}`}>
              <div style={{ fontWeight: 600, fontSize: 14, color: (!isDone && !isActive) ? 'var(--text-muted)' : undefined }}>{step}</div>
              <div className="tl-date">{isActive ? 'In Progress' : isDone ? 'Completed' : 'Pending'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Status() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    apiCall('/requests').then(res => {
      if (res.ok) setRequests(res.data.requests || []);
      else setLoadError(true);
    });
  }, []);

  const active = requests?.find(r => r.status !== 'Completed' && r.status !== 'Rejected');
  const current = active || requests?.[0];
  const prog = current ? (STATUS_PROGRESS[current.status] || 0) : 0;

  const alertClass = !current ? 'alert alert-info mb-6'
    : current.status === 'Completed' ? 'alert alert-success mb-6'
    : current.status === 'Rejected' ? 'alert alert-danger mb-6'
    : 'alert alert-info mb-6';

  return (
    <Layout title="Marksheet Status">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Marksheet Status</h2>
          <p>Track the progress of your document request</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/requests')}>+ New Request</button>
      </div>

      <div className={alertClass}>
        <span>ℹ️</span>
        <div>
          {loadError && 'Could not load requests. Please try again.'}
          {!requests && !loadError && 'Loading your document requests…'}
          {requests && !current && 'No document requests yet. Submit a request from My Requests page.'}
          {current && current.status === 'Completed' && <>Your <strong>{current.type}</strong> request is <strong>completed</strong> and ready for collection.</>}
          {current && current.status === 'Rejected' && <>Your <strong>{current.type}</strong> request was <strong>rejected</strong>. Please contact the office for details.</>}
          {current && current.status !== 'Completed' && current.status !== 'Rejected' && (
            <>Your <strong>{current.type}</strong> is currently being processed. Estimated completion: <strong>3–5 working days</strong>.</>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">📄 Current Request – {current ? current.type : 'Marksheet'}</div>
            <span className={`badge ${current ? (STATUS_BADGE[current.status] || 'badge-muted') : 'badge-primary'}`}>
              {current ? current.status : 'In Progress'}
            </span>
          </div>

          <div>
            {!requests && !loadError && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>}
            {(loadError || (requests && !current)) && (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>{loadError ? 'No Requests Found' : 'No Requests Yet'}</h3>
                <p>{loadError ? 'Submit a document request to track its progress.' : 'Click "New Request" to submit your first document request.'}</p>
              </div>
            )}
            {current && (
              <>
                <div style={{ marginBottom: 24, padding: 14, background: 'var(--bg2)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Request ID</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{current._id.slice(-8).toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Submitted On</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(current.createdAt || current.submittedAt)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Document Type</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{current.type}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Urgency</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{current.urgency || 'Normal'}</span>
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>Overall Progress</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{prog}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${prog}%`, background: 'linear-gradient(90deg,var(--primary),var(--primary-light))', borderRadius: 4, transition: 'width 1s ease' }}></div>
                  </div>
                </div>
                <Timeline request={current} />
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">📋 Request a Document</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DOC_SHORTCUTS.map(label => (
                <button key={label} className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 10 }} onClick={() => navigate('/requests')}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">📊 All Requests History</div></div>
            <div>
              {!requests && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading…</div>}
              {requests && !requests.length && <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>No requests yet.</p>}
              {(requests || []).slice(0, 5).map(r => (
                <div key={r._id} className="step-row">
                  <div className="step-left"><div className={`step-dot ${DOT_COLORS[r.status] || 'dot-muted'}`}></div><span style={{ fontSize: 13.5 }}>{r.type}</span></div>
                  <span className={`badge ${STATUS_BADGE[r.status] || 'badge-muted'}`}>{r.status}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <Link to="/requests" className="btn btn-outline btn-full btn-sm">View All Requests →</Link>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">🏫 Collection Information</div></div>
            <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--text)' }}>
              <div style={{ marginBottom: 8 }}><strong>Office Location:</strong> Administrative Block, Room 101</div>
              <div style={{ marginBottom: 8 }}><strong>Collection Hours:</strong> Mon–Fri, 9 AM – 4 PM</div>
              <div style={{ marginBottom: 8 }}><strong>Required:</strong> Original ID Card + Acknowledgment Slip</div>
              <div><strong>Contact:</strong> +91 98765 43210</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
