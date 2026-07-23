import { useEffect, useMemo, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import '../../styles/faculty.css';

export default function FacultyStudents() {
  const [students, setStudents] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    apiCall('/faculty-portal/students').then(res => { if (res.ok) setStudents(res.data.students); });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (students || []).filter(x =>
      !s || x.name.toLowerCase().includes(s) || (x.studentId || '').toLowerCase().includes(s));
  }, [students, q]);

  return (
    <FacultyShell title="Students">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Students</h2>
          <p>Students in your assigned classes (read-only)</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">👥 My Students</div>
          <span className="badge badge-primary">{students ? students.length : '…'}</span>
        </div>
        <input className="fac-search" placeholder="🔍 Search by name or ID…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="table">
            <thead><tr><th>Student ID</th><th>Name</th><th>Department</th><th>Semester</th><th>Email</th></tr></thead>
            <tbody>
              {!students && <tr><td colSpan={5} className="fac-center">Loading…</td></tr>}
              {students && !filtered.length && <tr><td colSpan={5} className="fac-center">No students found.</td></tr>}
              {filtered.map(s => (
                <tr key={s._id}>
                  <td style={{ fontWeight: 600 }}>{s.studentId}</td>
                  <td>{s.name}</td>
                  <td>{s.department}</td>
                  <td>{s.semester || '—'}</td>
                  <td className="fac-muted" style={{ fontSize: 12 }}>{s.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </FacultyShell>
  );
}
