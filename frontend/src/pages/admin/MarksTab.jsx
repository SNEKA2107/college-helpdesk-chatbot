import { useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';

const GRADE_BADGE = { O: 'badge-success', 'A+': 'badge-success', A: 'badge-success', 'B+': 'badge-primary', B: 'badge-warning', RA: 'badge-danger' };
const emptyForm = { semester: '', subject: '', subjectCode: '', credits: '', internalMarks: '', externalMarks: '' };

// CRIT-01: admin enters/edits/deletes marks. Students only view (see Cgpa page).
export default function MarksTab() {
  const showToast = useToast();
  const [lookupId, setLookupId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [marks, setMarks] = useState(null);
  const [cgpa, setCgpa] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load(id) {
    const sid = (id || lookupId).trim().toUpperCase();
    if (!sid) { showToast('Enter a student ID', 'error'); return; }
    const [mRes, cRes] = await Promise.all([
      apiCall(`/marks?studentId=${encodeURIComponent(sid)}`),
      apiCall(`/marks/cgpa?studentId=${encodeURIComponent(sid)}`),
    ]);
    if (mRes.ok) { setStudentId(sid); setMarks(mRes.data.marks || []); setCgpa(cRes.ok ? cRes.data : null); }
    else { showToast(mRes.error || 'Lookup failed', 'error'); }
  }

  async function addMarks() {
    if (!studentId) { showToast('Look up a student first', 'error'); return; }
    if (!form.semester.trim() || !form.subject.trim()) { showToast('Semester and subject are required', 'error'); return; }
    setSaving(true);
    const res = await apiCall('/marks', {
      method: 'POST',
      body: JSON.stringify({
        studentId, semester: form.semester.trim(), subject: form.subject.trim(),
        subjectCode: form.subjectCode.trim(), credits: Number(form.credits),
        internalMarks: Number(form.internalMarks), externalMarks: Number(form.externalMarks),
      }),
    });
    setSaving(false);
    if (res.ok) { setForm(f => ({ ...emptyForm, semester: f.semester })); load(studentId); showToast(res.data.message || 'Saved', 'success'); }
    else showToast(res.error || 'Failed to save marks', 'error');
  }

  async function removeMarks(id) {
    if (!window.confirm('Delete this marks record?')) return;
    const res = await apiCall(`/marks/${id}`, { method: 'DELETE' });
    if (res.ok) { load(studentId); showToast('Deleted', 'info'); }
    else showToast(res.error || 'Delete failed', 'error');
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Marks Management</h2><p>Enter and manage student marks · Anna University 10-point scale</p></div>
      </div>

      <div className="card mb-6">
        <div className="card-header"><div className="card-title">🔎 Look up Student</div></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="text" className="form-input" placeholder="Student ID (e.g. 192221001)" style={{ maxWidth: 320 }}
            value={lookupId} onChange={e => setLookupId(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
          <button className="btn btn-primary" onClick={() => load()}>Load Marks</button>
        </div>
      </div>

      {studentId && (
        <div className="grid-2 mb-6">
          <div className="card">
            <div className="card-header"><div className="card-title">➕ Add / Update Marks</div></div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              For <strong>{studentId}</strong>. Re-entering the same semester + subject updates it. Internal max 40, external max 60.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="form-label">Semester *</label>
                <input className="form-input" placeholder="e.g. 5" value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Credits</label>
                <input className="form-input" type="number" min="0" max="12" placeholder="e.g. 4" value={form.credits} onChange={e => setForm(f => ({ ...f, credits: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Subject *</label>
                <input className="form-input" placeholder="e.g. Database Systems" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Subject Code</label>
                <input className="form-input" placeholder="e.g. CS8492" value={form.subjectCode} onChange={e => setForm(f => ({ ...f, subjectCode: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Internal (/40)</label>
                <input className="form-input" type="number" min="0" max="40" value={form.internalMarks} onChange={e => setForm(f => ({ ...f, internalMarks: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">External (/60)</label>
                <input className="form-input" type="number" min="0" max="60" value={form.externalMarks} onChange={e => setForm(f => ({ ...f, externalMarks: e.target.value }))} /></div>
            </div>
            <button className="btn btn-primary btn-full" onClick={addMarks} disabled={saving}>{saving ? 'Saving…' : 'Save Marks'}</button>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">📊 {studentId} — Results</div>
              {cgpa && <span className="badge badge-primary">CGPA {cgpa.cgpa.toFixed(2)}</span>}
            </div>
            <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="table">
                <thead><tr><th>Sem</th><th>Subject</th><th>Total</th><th>Grade</th><th></th></tr></thead>
                <tbody>
                  {!marks && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
                  {marks && !marks.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No marks entered yet</td></tr>}
                  {(marks || []).map(m => (
                    <tr key={m._id}>
                      <td>{m.semester}</td>
                      <td>{m.subject}{m.subjectCode ? ` (${m.subjectCode})` : ''}</td>
                      <td>{m.total}</td>
                      <td><span className={`badge ${GRADE_BADGE[m.grade] || 'badge-muted'}`}>{m.grade}</span></td>
                      <td><button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', padding: '2px 8px', fontSize: 11 }} onClick={() => removeMarks(m._id)}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
