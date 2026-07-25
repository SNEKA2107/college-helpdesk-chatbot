import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { getUser } from '../services/auth';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../utils/format';
import { validateUploadFile, readFileAsDataURL, previewDataUrl } from '../utils/file';
import { useDepartments } from '../hooks/useDepartments';

const OD_TYPES = [
  'Technical Symposium', 'Hackathon / Coding Contest', 'Industrial Visit', 'Guest Lecture / Seminar',
  'Sports Event', 'Cultural Event', 'Paper Presentation', 'Workshop / Training',
  'NSS / NCC Activity', 'Internship', 'Other',
];
// Departments come from the Department collection (audit finding H-1).
const SEMS = ['5th', '1st', '2nd', '3rd', '4th', '6th', '7th', '8th'];

const STATUS_BADGE = {
  Pending:  <span className="badge badge-warning">⏳ Pending</span>,
  Approved: <span className="badge badge-success">✅ Approved</span>,
  Rejected: <span className="badge badge-danger">❌ Rejected</span>,
};

const GUIDELINES = [
  ['①', 'Apply minimum 2 days before the event date.'],
  ['②', 'Attach the official invitation / brochure as supporting document.'],
  ['③', 'OD is valid only for college-recognised events and activities.'],
  ['④', 'Submit proof of participation (certificate / photo) within 3 days after the event.'],
  ['⑤', 'OD does not count against your leave quota.'],
];

export default function Od() {
  const { codes: DEPTS } = useDepartments({ academicOnly: true });
  const showToast = useToast();
  const user = getUser();
  const todayStr = new Date().toISOString().split('T')[0];

  const [leaves, setLeaves] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '', regNo: user?.studentId || '',
    // Prefer the student's own department; the list now loads asynchronously so
    // it cannot be indexed at first render.
    dept: user?.department || '', sem: user?.semester || SEMS[0],
    odType: '', eventName: '', venue: '', fromDate: '', toDate: '', reason: '',
  });

  // Once departments arrive, fall back to the first one if the student has none.
  useEffect(() => {
    if (!form.dept && DEPTS.length) setForm(f => (f.dept ? f : { ...f, dept: DEPTS[0] }));
  }, [DEPTS, form.dept]);
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const [doc, setDoc] = useState(null); // { document, documentName, documentType }

  async function onPickDocument(e) {
    const file = e.target.files?.[0];
    if (!file) { setDoc(null); return; }
    const check = validateUploadFile(file);
    if (!check.ok) { showToast(check.error, 'error'); e.target.value = ''; setDoc(null); return; }
    try {
      const dataUrl = await readFileAsDataURL(file);
      setDoc({ document: dataUrl, documentName: file.name, documentType: file.type });
    } catch (err) {
      showToast(err.message || 'Could not read the file', 'error');
      e.target.value = '';
      setDoc(null);
    }
  }

  async function viewMyDocument(id) {
    const res = await apiCall(`/leave/${id}/document`);
    if (res.ok && res.data.document) previewDataUrl(res.data.document);
    else showToast(res.error || 'Document not available', 'error');
  }

  async function loadHistory() {
    const result = await apiCall('/leave');
    if (result.ok) setLeaves(result.data.leaves);
    else setLoadError(true);
  }
  useEffect(() => { loadHistory(); }, []);

  async function submitOD() {
    if (!form.odType) { showToast('Please select OD purpose', 'error'); return; }
    if (!form.eventName.trim()) { showToast('Please enter event name', 'error'); return; }
    if (!form.fromDate) { showToast('Please select From Date', 'error'); return; }
    if (!form.toDate) { showToast('Please select To Date', 'error'); return; }

    setSubmitting(true);
    const fullReason = `${form.odType} — ${form.eventName.trim()} at ${form.venue.trim()}. ${form.reason.trim()}`.trim();
    const result = await apiCall('/leave', {
      method: 'POST',
      body: JSON.stringify({ leaveType: 'On Duty (OD) – Event', fromDate: form.fromDate, toDate: form.toDate, reason: fullReason, ...(doc || {}) }),
    });
    setSubmitting(false);
    if (result.ok) {
      setSubmitted(true);
      loadHistory();
    } else {
      showToast(result.error || 'Failed to submit OD request', 'error');
    }
  }

  function resetOD() {
    setForm(f => ({ ...f, odType: '', eventName: '', venue: '', fromDate: '', toDate: '', reason: '' }));
    setDoc(null);
    setSubmitted(false);
  }

  const odLeaves = (leaves || []).filter(l => l.leaveType && l.leaveType.startsWith('On Duty'));
  const dayCount = l => Math.ceil((new Date(l.toDate) - new Date(l.fromDate)) / 86400000) + 1;

  return (
    <Layout title="OD Request">
      <div className="page-header">
        <div className="page-header-text">
          <h2>On Duty (OD) Request</h2>
          <p>Apply for OD for competitions, seminars, industrial visits and more</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><div className="card-title">🏅 Apply for OD</div></div>

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
                <label className="form-label">OD Purpose</label>
                <select className="form-select" style={{ paddingLeft: 14 }} value={form.odType} onChange={e => set('odType', e.target.value)}>
                  <option value="">Select purpose</option>
                  {OD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Event / Activity Name</label>
                <input type="text" className="form-input" placeholder="e.g. CodeFest 2025, Tata Steel Industrial Visit"
                  value={form.eventName} onChange={e => set('eventName', e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Organized By / Venue</label>
                <input type="text" className="form-input" placeholder="e.g. Anna University, Chennai"
                  value={form.venue} onChange={e => set('venue', e.target.value)} />
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
                <label className="form-label">Additional Details</label>
                <textarea className="form-textarea" placeholder="Describe the event, your role, and why OD is required…"
                  value={form.reason} onChange={e => set('reason', e.target.value)}></textarea>
              </div>

              <div className="form-group">
                <label className="form-label">Supporting Document (invitation / brochure)</label>
                <input type="file" className="form-input" accept=".pdf,.jpg,.jpeg,.png" style={{ padding: 8 }} onChange={onPickDocument} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {doc ? `📎 ${doc.documentName} attached` : 'PDF, JPG or PNG · max 3 MB. Attach the official invitation / brochure.'}
                </div>
              </div>

              <div className="alert alert-warning mb-4">
                <span>⚠️</span>
                <div>OD must be applied at least 2 days before the event. Late applications may not be approved.</div>
              </div>

              <button className="btn btn-primary btn-full" onClick={submitOD} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit OD Request →'}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--dark)', marginBottom: 8 }}>OD Request Submitted!</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>Your OD request is pending approval from your class advisor.</p>
              <button className="btn btn-primary" onClick={resetOD}>Apply for Another OD</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">📋 My OD History</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loadError && <p style={{ color: 'var(--danger)', textAlign: 'center', padding: '20px 0' }}>Failed to load OD history.</p>}
              {!leaves && !loadError && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading OD history…</p>}
              {leaves && !odLeaves.length && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No OD requests yet.</p>}
              {odLeaves.map(l => (
                <div key={l._id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{l.leaveType}</span>
                    {STATUS_BADGE[l.status] || null}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {formatDate(l.fromDate)} – {formatDate(l.toDate)} ({dayCount(l)} day{dayCount(l) > 1 ? 's' : ''})
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 4 }}>{l.reason}</div>
                  {l.remarks && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>Remarks: {l.remarks}</div>}
                  {l.documentName && (
                    <button className="btn btn-sm btn-outline" style={{ marginTop: 8, padding: '4px 10px', fontSize: 12 }} onClick={() => viewMyDocument(l._id)}>
                      📎 View document
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">ℹ️ OD Guidelines</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
              {GUIDELINES.map(([num, text]) => (
                <div key={num} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: 'var(--primary)' }}>{num}</span><span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
