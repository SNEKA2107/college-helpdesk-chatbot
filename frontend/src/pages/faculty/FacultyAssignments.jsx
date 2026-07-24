import { useEffect, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import Modal from '../../components/Modal';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/format';
import { downloadDataUrl, fileToDataUrl } from '../../utils/download';
import '../../styles/faculty.css';

const EMPTY = { title: '', description: '', subIdx: '', dueDate: '', maxMarks: '100', attachment: '', attachmentName: '', attachmentType: '' };

export default function FacultyAssignments() {
  const showToast = useToast();
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  // Submissions modal
  const [subFor, setSubFor] = useState(null);      // assignment being viewed
  const [subs, setSubs] = useState(null);          // submissions list
  const [grade, setGrade] = useState({});          // studentId -> { marks, remarks }

  function load() {
    apiCall('/faculty-portal/assignments').then(res => { if (res.ok) setAssignments(res.data.assignments || []); });
  }
  useEffect(() => {
    apiCall('/faculty-portal/subjects').then(res => { if (res.ok) setSubjects(res.data.subjects || []); });
    load();
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const r = await fileToDataUrl(file); setForm(f => ({ ...f, attachment: r.dataUrl, attachmentName: r.name, attachmentType: r.type })); }
    catch (err) { showToast(err.message, 'error'); }
  }

  async function submit() {
    if (!form.title.trim() || form.subIdx === '' || !form.dueDate) { showToast('Title, subject and due date are required', 'error'); return; }
    setSaving(true);
    const sub = subjects[Number(form.subIdx)];
    const body = JSON.stringify({
      title: form.title, description: form.description, subject: sub.name, section: sub.section || '',
      dueDate: form.dueDate, maxMarks: Number(form.maxMarks) || 100,
      attachment: form.attachment, attachmentName: form.attachmentName, attachmentType: form.attachmentType,
    });
    const res = editId
      ? await apiCall(`/faculty-portal/assignments/${editId}`, { method: 'PUT', body })
      : await apiCall('/faculty-portal/assignments', { method: 'POST', body });
    setSaving(false);
    if (res.ok) { showToast(editId ? 'Assignment updated' : 'Assignment created', 'success'); setForm(EMPTY); setEditId(null); load(); }
    else showToast(res.error || 'Failed', 'error');
  }

  function edit(a) {
    const idx = subjects.findIndex(s => s.name === a.subject && (s.section || '') === (a.section || ''));
    setEditId(a._id);
    setForm({
      title: a.title, description: a.description || '', subIdx: idx >= 0 ? String(idx) : '',
      dueDate: a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 10) : '',
      maxMarks: String(a.maxMarks || 100), attachment: '', attachmentName: a.attachmentName || '', attachmentType: a.attachmentType || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggleStatus(a) {
    const res = await apiCall(`/faculty-portal/assignments/${a._id}`, { method: 'PUT', body: JSON.stringify({ status: a.status === 'closed' ? 'open' : 'closed' }) });
    if (res.ok) { showToast('Status updated', 'success'); load(); } else showToast(res.error || 'Failed', 'error');
  }

  async function del(id) {
    if (!window.confirm('Delete this assignment and all its submissions?')) return;
    const res = await apiCall(`/faculty-portal/assignments/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Assignment deleted', 'info'); load(); } else showToast(res.error || 'Delete failed', 'error');
  }

  function openSubmissions(a) {
    setSubFor(a); setSubs(null); setGrade({});
    apiCall(`/faculty-portal/assignments/${a._id}/submissions`).then(res => {
      if (res.ok) {
        setSubs(res.data.submissions || []);
        const g = {};
        (res.data.submissions || []).forEach(s => { g[s.studentId] = { marks: s.marks ?? '', remarks: s.remarks || '' }; });
        setGrade(g);
      } else showToast(res.error || 'Could not load submissions', 'error');
    });
  }

  async function saveGrade(s) {
    const g = grade[s.studentId] || {};
    const res = await apiCall(`/faculty-portal/assignments/${subFor._id}/submissions/${encodeURIComponent(s.studentId)}`, {
      method: 'PUT', body: JSON.stringify({ marks: g.marks, remarks: g.remarks }),
    });
    if (res.ok) { showToast(`Graded ${s.studentId}`, 'success'); openSubmissions(subFor); load(); }
    else showToast(res.error || 'Grade failed', 'error');
  }

  async function downloadSub(s) {
    const res = await apiCall(`/faculty-portal/assignments/${subFor._id}/submissions/${encodeURIComponent(s.studentId)}/file`);
    if (res.ok) downloadDataUrl(res.data.attachment, res.data.attachmentName); else showToast(res.error || 'No file', 'error');
  }

  const statusBadge = a => a.effectiveStatus === 'closed'
    ? <span className="badge badge-danger">Closed</span> : <span className="badge badge-success">Open</span>;

  return (
    <FacultyShell title="Assignments">
      <div className="page-header">
        <div className="page-header-text"><h2>Assignments</h2><p>Create assignments, track submissions and grade with remarks</p></div>
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">{editId ? '✏️ Edit Assignment' : '➕ Create Assignment'}</div></div>
          <div className="form-group"><label className="form-label">Title *</label>
            <input className="form-input" placeholder="e.g. Unit 2 — Problem Set" value={form.title} onChange={e => set('title', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Description</label>
            <textarea className="form-textarea" placeholder="Instructions for students…" value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Subject / Class *</label>
            <select className="form-select" value={form.subIdx} onChange={e => set('subIdx', e.target.value)} disabled={!!editId}>
              <option value="">Choose subject…</option>
              {subjects.map((s, i) => <option key={i} value={i}>{s.name} — {s.department} Sem {s.semester}{s.section ? ` · ${s.section}` : ''}</option>)}
            </select></div>
          <div className="fac-controls">
            <div className="form-group"><label className="form-label">Due Date *</label>
              <input type="date" className="form-input" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Max Marks</label>
              <input type="number" min="1" max="1000" className="form-input" value={form.maxMarks} onChange={e => set('maxMarks', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Attach brief</label>
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,image/*" onChange={onFile} />
              {form.attachmentName && <div className="fac-muted" style={{ fontSize: 12, marginTop: 4 }}>📎 {form.attachmentName}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button className="btn btn-primary btn-full" onClick={submit} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update Assignment' : 'Create Assignment'}</button>
            {editId && <button className="btn btn-outline" onClick={() => { setForm(EMPTY); setEditId(null); }}>Cancel</button>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">📋 My Assignments</div><span className="badge badge-primary">{assignments ? assignments.length : '…'}</span></div>
          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            {!assignments && <p className="fac-muted">Loading…</p>}
            {assignments && !assignments.length && <p className="fac-muted">No assignments yet.</p>}
            {(assignments || []).map(a => (
              <div key={a._id} className="fac-notice">
                <div style={{ flex: 1 }}>
                  <div className="fac-row-title">{a.title} {statusBadge(a)}</div>
                  <div className="fac-muted" style={{ fontSize: 12, margin: '4px 0' }}>{a.subject} · Sem {a.semester}{a.section ? ` · ${a.section}` : ''} · /{a.maxMarks}</div>
                  <div className="fac-muted" style={{ fontSize: 11 }}>Due {formatDate(a.dueDate)} · 📥 {a.submissionCount} submitted · ✅ {a.gradedCount} graded</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => openSubmissions(a)}>Submissions</button>
                  <button className="btn btn-sm btn-outline" onClick={() => edit(a)}>Edit</button>
                  <button className="btn btn-sm btn-outline" onClick={() => toggleStatus(a)}>{a.status === 'closed' ? 'Reopen' : 'Close'}</button>
                  <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => del(a._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={!!subFor} onClose={() => setSubFor(null)} title={subFor ? `Submissions — ${subFor.title}` : ''} subtitle={subFor ? `${subFor.subject} · out of ${subFor.maxMarks}` : ''} maxWidth={820}>
        {!subs && <p className="fac-center">Loading…</p>}
        {subs && !subs.length && <p className="fac-center">No submissions yet.</p>}
        {subs && !!subs.length && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Student</th><th>Submitted</th><th>Work</th><th>Marks</th><th>Remarks</th><th></th></tr></thead>
              <tbody>
                {subs.map(s => {
                  const g = grade[s.studentId] || {};
                  return (
                    <tr key={s.studentId}>
                      <td><div style={{ fontWeight: 600 }}>{s.studentName || s.studentId}</div><div className="fac-muted" style={{ fontSize: 12 }}>{s.studentId}</div></td>
                      <td className="fac-muted" style={{ fontSize: 12 }}>{formatDate(s.submittedAt)}</td>
                      <td>
                        {s.text ? <div style={{ fontSize: 12, maxWidth: 180, whiteSpace: 'pre-wrap' }}>{s.text}</div> : null}
                        {s.attachmentName ? <button className="btn btn-sm btn-outline" style={{ marginTop: 4 }} onClick={() => downloadSub(s)}>📎 {s.attachmentName.slice(0, 16)}</button> : null}
                        {!s.text && !s.attachmentName ? <span className="fac-muted">—</span> : null}
                      </td>
                      <td><input type="number" min="0" max={subFor.maxMarks} className="fac-mark-input" style={{ width: 70 }} value={g.marks ?? ''} onChange={e => setGrade(gr => ({ ...gr, [s.studentId]: { ...gr[s.studentId], marks: e.target.value } }))} /></td>
                      <td><input className="fac-mark-input" style={{ width: 150 }} placeholder="Remarks" value={g.remarks ?? ''} onChange={e => setGrade(gr => ({ ...gr, [s.studentId]: { ...gr[s.studentId], remarks: e.target.value } }))} /></td>
                      <td><button className="btn btn-sm btn-primary" onClick={() => saveGrade(s)}>Save</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </FacultyShell>
  );
}
