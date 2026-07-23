import { useEffect, useMemo, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import '../../styles/faculty.css';

const norm = v => (v == null ? '' : String(v).trim().toLowerCase());

export default function FacultyMarks() {
  const showToast = useToast();
  const [subjects, setSubjects] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [subIdx, setSubIdx] = useState('');
  const [rows, setRows] = useState({}); // studentId -> { internal, external, credits }
  const [q, setQ] = useState('');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    apiCall('/faculty-portal/subjects').then(res => { if (res.ok) setSubjects(res.data.subjects || []); });
    apiCall('/faculty-portal/students').then(res => { if (res.ok) setAllStudents(res.data.students || []); });
  }, []);

  const subject = subIdx !== '' ? subjects[Number(subIdx)] : null;

  const classStudents = useMemo(() => {
    if (!subject) return [];
    return allStudents.filter(s =>
      norm(s.department) === norm(subject.department) &&
      (norm(subject.semester) === '' || norm(s.semester) === norm(subject.semester)) &&
      (norm(subject.section) === '' || norm(s.section) === norm(subject.section)));
  }, [subject, allStudents]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return classStudents.filter(x => !s || x.name.toLowerCase().includes(s) || (x.studentId || '').toLowerCase().includes(s));
  }, [classStudents, q]);

  // Prefill from existing marks for this subject/semester.
  useEffect(() => {
    if (!subject) { setRows({}); return; }
    const init = {};
    classStudents.forEach(s => { init[s.studentId] = { internal: '', external: '', credits: '3' }; });
    apiCall(`/faculty-portal/marks?subject=${encodeURIComponent(subject.name)}&semester=${encodeURIComponent(subject.semester)}&section=${encodeURIComponent(subject.section || '')}`)
      .then(res => {
        if (res.ok) (res.data.marks || []).forEach(m => {
          init[m.studentId] = { internal: String(m.internalMarks), external: String(m.externalMarks), credits: String(m.credits), published: m.published };
        });
        setRows(init);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subIdx, classStudents.length]);

  const setCell = (sid, k, v) => setRows(r => ({ ...r, [sid]: { ...r[sid], [k]: v } }));

  async function saveOne(s) {
    const row = rows[s.studentId] || {};
    if (row.internal === '' || row.external === '') { showToast('Enter internal and external/lab marks', 'error'); return; }
    const res = await apiCall('/faculty-portal/marks', {
      method: 'POST',
      body: JSON.stringify({
        studentId: s.studentId, semester: subject.semester, subject: subject.name, subjectCode: subject.code,
        section: subject.section || '', credits: Number(row.credits) || 3,
        internalMarks: Number(row.internal), externalMarks: Number(row.external),
      }),
    });
    showToast(res.ok ? `Saved ${s.studentId}` : (res.error || 'Save failed'), res.ok ? 'success' : 'error');
  }

  async function publish() {
    if (!subject) return;
    setPublishing(true);
    const res = await apiCall('/faculty-portal/marks/publish', {
      method: 'POST',
      body: JSON.stringify({ subject: subject.name, semester: subject.semester, section: subject.section || '' }),
    });
    setPublishing(false);
    showToast(res.ok ? (res.data.message || 'Published') : (res.error || 'Publish failed'), res.ok ? 'success' : 'error');
  }

  return (
    <FacultyShell title="Enter Marks">
      <div className="page-header">
        <div className="page-header-text"><h2>Marks</h2><p>Enter internal & lab/external marks, then publish results</p></div>
      </div>

      <div className="card mb-6">
        <div className="fac-controls">
          <div className="form-group">
            <label className="form-label">Subject *</label>
            <select className="form-select" value={subIdx} onChange={e => setSubIdx(e.target.value)}>
              <option value="">Choose subject…</option>
              {subjects.map((s, i) => <option key={i} value={i}>{s.name} — {s.department} Sem {s.semester}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Semester</label><input className="form-input" value={subject?.semester || ''} disabled /></div>
          <div className="form-group"><label className="form-label">Section</label><input className="form-input" value={subject?.section || 'All'} disabled /></div>
        </div>
      </div>

      {subject && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📝 {subject.name} — {classStudents.length} students</div>
            <button className="btn btn-sm btn-primary" onClick={publish} disabled={publishing}>{publishing ? 'Publishing…' : '📢 Publish Results'}</button>
          </div>
          <p className="fac-muted" style={{ fontSize: 12, marginBottom: 10 }}>Internal /40 · Lab or External /60 · marks stay hidden from students until you publish.</p>
          <input className="fac-search" placeholder="🔍 Search student…" value={q} onChange={e => setQ(e.target.value)} />
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table">
              <thead><tr><th>Student</th><th>Internal /40</th><th>Lab/Ext /60</th><th>Credits</th><th></th><th></th></tr></thead>
              <tbody>
                {!filtered.length && <tr><td colSpan={6} className="fac-center">No students in this class.</td></tr>}
                {filtered.map(s => {
                  const row = rows[s.studentId] || {};
                  return (
                    <tr key={s._id}>
                      <td><div style={{ fontWeight: 600 }}>{s.name}</div><div className="fac-muted" style={{ fontSize: 12 }}>{s.studentId}</div></td>
                      <td><input type="number" min="0" max="40" className="fac-mark-input" value={row.internal ?? ''} onChange={e => setCell(s.studentId, 'internal', e.target.value)} /></td>
                      <td><input type="number" min="0" max="60" className="fac-mark-input" value={row.external ?? ''} onChange={e => setCell(s.studentId, 'external', e.target.value)} /></td>
                      <td><input type="number" min="0" max="12" className="fac-mark-input" style={{ width: 60 }} value={row.credits ?? '3'} onChange={e => setCell(s.studentId, 'credits', e.target.value)} /></td>
                      <td>{row.published === false ? <span className="badge badge-warning">Unpublished</span> : row.published ? <span className="badge badge-success">Published</span> : null}</td>
                      <td><button className="btn btn-sm btn-outline" onClick={() => saveOne(s)}>Save</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FacultyShell>
  );
}
