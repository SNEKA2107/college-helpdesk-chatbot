import { useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { DEPARTMENTS, SEMESTERS } from './shared';

const today = () => new Date().toISOString().split('T')[0];
const pctBadge = p => (p >= 75 ? 'badge-success' : p >= 60 ? 'badge-warning' : 'badge-danger');

export default function AttendanceTab({ data }) {
  const showToast = useToast();
  const [dept, setDept] = useState('IT');
  const [sem, setSem] = useState('2nd');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(today);
  const [loadedStudents, setLoadedStudents] = useState(null); // null until "Load Students"
  const [statuses, setStatuses] = useState({});               // studentId → Present/Absent/Late
  const [saving, setSaving] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [lookup, setLookup] = useState(null); // { loading } | { error } | { summary, overall, totalClasses }

  function loadStudents() {
    const list = data.students.filter(s => s.department === dept && s.semester === sem && s.isActive !== false);
    setLoadedStudents(list);
    setStatuses(Object.fromEntries(list.map(s => [s.studentId, 'Present'])));
  }

  const setAll = status => setStatuses(st => Object.fromEntries(Object.keys(st).map(id => [id, status])));

  async function saveAttendance() {
    if (!subject.trim()) { showToast('Subject is required', 'error'); return; }
    if (!date) { showToast('Date is required', 'error'); return; }
    const records = (loadedStudents || []).map(s => ({ studentId: s.studentId, subject: subject.trim(), date, status: statuses[s.studentId] }));
    if (!records.length) { showToast('No students loaded', 'error'); return; }

    setSaving(true);
    const res = await apiCall('/attendance/bulk', { method: 'POST', body: JSON.stringify({ records }) });
    setSaving(false);
    if (res.ok) showToast(res.data.message || 'Attendance saved', 'success');
    else showToast(res.error || 'Failed to save attendance', 'error');
  }

  async function lookupAttendance() {
    const id = lookupId.trim();
    if (!id) { showToast('Enter a register number', 'error'); return; }
    setLookup({ loading: true });
    const res = await apiCall(`/attendance/summary?studentId=${encodeURIComponent(id)}`);
    if (!res.ok) { setLookup({ error: res.error || 'Lookup failed' }); return; }
    setLookup(res.data);
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Attendance</h2><p>Mark attendance for a class and look up any student's summary</p></div>
      </div>

      <div className="card mb-6">
        <div className="card-header"><div className="card-title">✅ Mark Class Attendance</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
          <div className="form-group"><label className="form-label">Department *</label>
            <select className="form-select" style={{ paddingLeft: 14 }} value={dept} onChange={e => setDept(e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Semester *</label>
            <select className="form-select" style={{ paddingLeft: 14 }} value={sem} onChange={e => setSem(e.target.value)}>
              {SEMESTERS.map(s => <option key={s}>{s}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Subject *</label>
            <input type="text" className="form-input" placeholder="e.g. Java Programming" value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Date *</label>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <button className="btn btn-secondary" onClick={loadStudents}>Load Students</button>

        {loadedStudents !== null && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div className="card-title">{dept} · {sem} semester ({loadedStudents.length} students)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setAll('Present')}>All Present</button>
                <button className="btn btn-outline btn-sm" onClick={() => setAll('Absent')}>All Absent</button>
              </div>
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {!loadedStudents.length && <p style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No students found for this department &amp; semester</p>}
              {loadedStudents.map(s => (
                <div key={s.studentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.studentId}</div>
                  </div>
                  <select
                    className="form-select" style={{ padding: '4px 8px', fontSize: 12.5, height: 32, width: 110 }}
                    value={statuses[s.studentId] || 'Present'}
                    onChange={e => setStatuses(st => ({ ...st, [s.studentId]: e.target.value }))}
                  >
                    <option>Present</option><option>Absent</option><option>Late</option>
                  </select>
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-full" style={{ marginTop: 14 }} onClick={saveAttendance} disabled={saving}>
              {saving ? 'Saving…' : 'Save Attendance'}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">🔍 Student Attendance Summary</div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text" className="form-input" placeholder="Register No. e.g. 192221001" style={{ maxWidth: 240 }}
            value={lookupId}
            onChange={e => setLookupId(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') lookupAttendance(); }}
          />
          <button className="btn btn-secondary" onClick={lookupAttendance}>Check</button>
        </div>
        <div style={{ marginTop: 14 }}>
          {lookup?.loading && <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>Loading…</div>}
          {lookup?.error && <p style={{ color: 'var(--danger)', padding: 8 }}>{lookup.error}</p>}
          {lookup?.summary && !lookup.summary.length && (
            <p style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>No attendance records for this student yet</p>
          )}
          {lookup?.summary?.length > 0 && (
            <>
              <div style={{ marginBottom: 10, fontWeight: 600 }}>
                Overall: <span className={`badge ${pctBadge(lookup.overall)}`}>{lookup.overall}%</span>{' '}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>· {lookup.totalClasses} classes recorded</span>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Subject</th><th>Classes</th><th>Present</th><th>Absent</th><th>Late</th><th>%</th></tr></thead>
                  <tbody>
                    {lookup.summary.map(s => (
                      <tr key={s.subject}>
                        <td style={{ fontWeight: 600 }}>{s.subject}</td>
                        <td>{s.total}</td><td>{s.present}</td><td>{s.absent}</td><td>{s.late}</td>
                        <td><span className={`badge ${pctBadge(s.percentage)}`}>{s.percentage}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
