import { useEffect, useMemo, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import '../../styles/faculty.css';

const norm = v => (v == null ? '' : String(v).trim().toLowerCase());
const todayISO = () => new Date().toISOString().split('T')[0];

export default function FacultyAttendance() {
  const showToast = useToast();
  const [subjects, setSubjects] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [subIdx, setSubIdx] = useState('');
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState({}); // studentId -> 'Present'|'Absent'|'Late'
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiCall('/faculty-portal/subjects').then(res => { if (res.ok) setSubjects(res.data.subjects || []); });
    apiCall('/faculty-portal/students').then(res => { if (res.ok) setAllStudents(res.data.students || []); });
  }, []);

  const subject = subIdx !== '' ? subjects[Number(subIdx)] : null;

  // Students in the selected subject's class (dept + semester + optional section).
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

  // Load existing attendance for the chosen subject+date (edit mode) — default Present.
  useEffect(() => {
    if (!subject || !date) { setStatus({}); return; }
    const init = {};
    classStudents.forEach(s => { init[s.studentId] = 'Present'; });
    apiCall(`/faculty-portal/attendance?subject=${encodeURIComponent(subject.name)}&section=${encodeURIComponent(subject.section || '')}&date=${date}`)
      .then(res => {
        if (res.ok) (res.data.records || []).forEach(r => { init[r.studentId] = r.status; });
        setStatus(init);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subIdx, date, classStudents.length]);

  const setOne = (sid, v) => setStatus(m => ({ ...m, [sid]: v }));
  const markAll = v => setStatus(() => Object.fromEntries(classStudents.map(s => [s.studentId, v])));

  async function save() {
    if (!subject) { showToast('Choose a subject first', 'error'); return; }
    const records = classStudents.map(s => ({ studentId: s.studentId, status: status[s.studentId] || 'Present' }));
    if (!records.length) { showToast('No students in this class', 'error'); return; }
    setSaving(true);
    const res = await apiCall('/faculty-portal/attendance', {
      method: 'POST',
      body: JSON.stringify({ subject: subject.name, section: subject.section || '', date, records }),
    });
    setSaving(false);
    showToast(res.ok ? (res.data.message || 'Attendance saved') : (res.error || 'Failed to save'), res.ok ? 'success' : 'error');
  }

  const presentCount = classStudents.filter(s => (status[s.studentId] || 'Present') === 'Present').length;

  return (
    <FacultyShell title="Mark Attendance">
      <div className="page-header">
        <div className="page-header-text"><h2>Attendance</h2><p>Mark or edit attendance for your assigned classes</p></div>
      </div>

      <div className="card mb-6">
        <div className="fac-controls">
          <div className="form-group">
            <label className="form-label">Subject *</label>
            <select className="form-select" value={subIdx} onChange={e => setSubIdx(e.target.value)}>
              <option value="">Choose subject…</option>
              {subjects.map((s, i) => <option key={i} value={i}>{s.name} — {s.department} Sem {s.semester}{s.section ? ` (${s.section})` : ''}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Section</label>
            <input className="form-input" value={subject?.section || 'All'} disabled />
          </div>
        </div>
      </div>

      {subject && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">🧑‍🎓 {subject.name} — {classStudents.length} students · {presentCount} present</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-outline" onClick={() => markAll('Present')}>All Present</button>
              <button className="btn btn-sm btn-outline" onClick={() => markAll('Absent')}>All Absent</button>
            </div>
          </div>
          <input className="fac-search" placeholder="🔍 Search student…" value={q} onChange={e => setQ(e.target.value)} />
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table">
              <thead><tr><th>Student ID</th><th>Name</th><th>Status</th></tr></thead>
              <tbody>
                {!filtered.length && <tr><td colSpan={3} className="fac-center">No students in this class.</td></tr>}
                {filtered.map(s => {
                  const st = status[s.studentId] || 'Present';
                  return (
                    <tr key={s._id}>
                      <td style={{ fontWeight: 600 }}>{s.studentId}</td>
                      <td>{s.name}</td>
                      <td>
                        <div className="fac-att-toggle">
                          {['Present', 'Absent', 'Late'].map(v => (
                            <button key={v} className={`fac-att-btn${st === v ? ` active ${v.toLowerCase()}` : ''}`} onClick={() => setOne(s.studentId, v)}>{v}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary btn-full" style={{ marginTop: 14 }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Attendance'}
          </button>
        </div>
      )}
    </FacultyShell>
  );
}
