import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { apiCall } from '../services/api';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../utils/format';
import { downloadDataUrl, fileToDataUrl } from '../utils/download';
import '../styles/faculty.css';

const KIND_ICON = { PDF: '📕', PPT: '📊', DOC: '📄', Notes: '📝', Other: '📁' };

export default function StudentCoursework() {
  const showToast = useToast();
  const [tab, setTab] = useState('assignments');
  const [assignments, setAssignments] = useState(null);
  const [materials, setMaterials] = useState(null);
  // Submit modal
  const [subFor, setSubFor] = useState(null);
  const [subForm, setSubForm] = useState({ text: '', attachment: '', attachmentName: '', attachmentType: '' });
  const [submitting, setSubmitting] = useState(false);

  function loadAssignments() {
    apiCall('/coursework/assignments').then(res => { if (res.ok) setAssignments(res.data.assignments || []); });
  }
  function loadMaterials() {
    apiCall('/coursework/materials').then(res => { if (res.ok) setMaterials(res.data.materials || []); });
  }
  useEffect(() => { loadAssignments(); loadMaterials(); }, []);

  function openSubmit(a) {
    setSubFor(a);
    setSubForm({
      text: a.submission?.text || '', attachment: '',
      attachmentName: a.submission?.attachmentName || '', attachmentType: '',
    });
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const r = await fileToDataUrl(file); setSubForm(f => ({ ...f, attachment: r.dataUrl, attachmentName: r.name, attachmentType: r.type })); }
    catch (err) { showToast(err.message, 'error'); }
  }

  async function submitWork() {
    if (!subForm.text.trim() && !subForm.attachment) { showToast('Add a note or attach a file', 'error'); return; }
    setSubmitting(true);
    const res = await apiCall(`/coursework/assignments/${subFor._id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ text: subForm.text, attachment: subForm.attachment, attachmentName: subForm.attachmentName, attachmentType: subForm.attachmentType }),
    });
    setSubmitting(false);
    if (res.ok) { showToast(res.data.message || 'Submitted', 'success'); setSubFor(null); loadAssignments(); }
    else showToast(res.error || 'Submit failed', 'error');
  }

  async function downloadBrief(a) {
    const res = await apiCall(`/coursework/assignments/${a._id}/file`);
    if (res.ok) downloadDataUrl(res.data.attachment, res.data.attachmentName); else showToast(res.error || 'No file', 'error');
  }
  async function downloadMaterial(m) {
    const res = await apiCall(`/coursework/materials/${m._id}/file`);
    if (res.ok) downloadDataUrl(res.data.attachment, res.data.attachmentName); else showToast(res.error || 'No file', 'error');
  }

  const materialsBySubject = useMemo(() => {
    const g = {};
    (materials || []).forEach(m => { (g[m.subject] ||= []).push(m); });
    return g;
  }, [materials]);

  return (
    <Layout title="Coursework">
      <div className="page-header">
        <div className="page-header-text"><h2>Coursework</h2><p>Assignments to submit and study materials to download</p></div>
      </div>

      <div className="fac-tabs" style={{ marginBottom: 16 }}>
        <button className={`fac-tab${tab === 'assignments' ? ' active' : ''}`} onClick={() => setTab('assignments')}>📄 Assignments</button>
        <button className={`fac-tab${tab === 'materials' ? ' active' : ''}`} onClick={() => setTab('materials')}>📚 Study Materials</button>
      </div>

      {tab === 'assignments' && (
        <div className="card">
          <div className="card-header"><div className="card-title">📄 My Assignments</div><span className="badge badge-primary">{assignments ? assignments.length : '…'}</span></div>
          {!assignments && <p className="fac-muted">Loading…</p>}
          {assignments && !assignments.length && <p className="fac-muted">No assignments for your class yet.</p>}
          {(assignments || []).map(a => (
            <div key={a._id} className="fac-file">
              <div style={{ flex: 1 }}>
                <div className="fac-row-title">
                  {a.title}
                  {a.status === 'closed' ? <span className="badge badge-danger" style={{ marginLeft: 6 }}>Closed</span> : <span className="badge badge-success" style={{ marginLeft: 6 }}>Open</span>}
                  {a.submitted && <span className="badge badge-primary" style={{ marginLeft: 6 }}>Submitted</span>}
                </div>
                <div className="fac-muted" style={{ fontSize: 12, margin: '4px 0' }}>{a.subject} · out of {a.maxMarks} · by {a.facultyName || 'Faculty'}</div>
                {a.description && <div className="fac-muted" style={{ fontSize: 12 }}>{a.description.slice(0, 120)}</div>}
                <div className="fac-muted" style={{ fontSize: 11 }}>Due {formatDate(a.dueDate)}</div>
                {a.submission?.marks != null && (
                  <div style={{ fontSize: 12, marginTop: 4, color: 'var(--secondary)' }}>
                    ✅ Graded: <strong>{a.submission.marks}/{a.maxMarks}</strong>{a.submission.remarks ? ` — “${a.submission.remarks}”` : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {a.hasAttachment && <button className="btn btn-sm btn-outline" onClick={() => downloadBrief(a)}>📎 Brief</button>}
                <button className="btn btn-sm btn-primary" disabled={a.status === 'closed'} onClick={() => openSubmit(a)}>{a.submitted ? 'Re-submit' : 'Submit'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'materials' && (
        <div className="card">
          <div className="card-header"><div className="card-title">📚 Study Materials</div><span className="badge badge-primary">{materials ? materials.length : '…'}</span></div>
          {!materials && <p className="fac-muted">Loading…</p>}
          {materials && !materials.length && <p className="fac-muted">No study materials for your class yet.</p>}
          {Object.entries(materialsBySubject).map(([subject, items]) => (
            <div key={subject} style={{ marginBottom: 14 }}>
              <div className="fac-row-title" style={{ color: 'var(--primary)', marginBottom: 4 }}>{subject}</div>
              {items.map(m => (
                <div key={m._id} className="fac-file">
                  <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                    <div className="fac-file-icon">{KIND_ICON[m.kind] || '📁'}</div>
                    <div>
                      <div className="fac-row-title">{m.title} <span className="badge badge-muted" style={{ fontSize: 10 }}>{m.kind}</span></div>
                      {m.description && <div className="fac-muted" style={{ fontSize: 12 }}>{m.description.slice(0, 90)}</div>}
                      <div className="fac-muted" style={{ fontSize: 11 }}>{formatDate(m.createdAt)} · by {m.facultyName || 'Faculty'}</div>
                    </div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => downloadMaterial(m)}>⬇ Download</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!subFor} onClose={() => setSubFor(null)} title={subFor ? `Submit — ${subFor.title}` : ''} subtitle={subFor ? `${subFor.subject} · due ${formatDate(subFor.dueDate)}` : ''} maxWidth={560}>
        {subFor && (
          <div>
            <div className="form-group"><label className="form-label">Your answer / notes</label>
              <textarea className="form-textarea" placeholder="Type your submission or notes…" value={subForm.text} onChange={e => setSubForm(f => ({ ...f, text: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Attach file (optional)</label>
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,image/*,.zip" onChange={onFile} />
              {subForm.attachmentName && <div className="fac-muted" style={{ fontSize: 12, marginTop: 4 }}>📎 {subForm.attachmentName}</div>}
            </div>
            <button className="btn btn-primary btn-full" onClick={submitWork} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Assignment'}</button>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
