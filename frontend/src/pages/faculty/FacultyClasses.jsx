import { useEffect, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import '../../styles/faculty.css';

export default function FacultyClasses() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiCall('/faculty-portal/subjects').then(res => { if (res.ok) setData(res.data); });
  }, []);

  const subjects = data?.subjects || [];
  const classes = data?.classes || [];

  return (
    <FacultyShell title="My Classes">
      <div className="page-header">
        <div className="page-header-text">
          <h2>My Classes</h2>
          <p>Subjects and class sections assigned to you</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header"><div className="card-title">📚 Assigned Subjects</div><span className="badge badge-primary">{subjects.length}</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Subject</th><th>Code</th><th>Department</th><th>Semester</th><th>Section</th></tr></thead>
            <tbody>
              {!data && <tr><td colSpan={5} className="fac-center">Loading…</td></tr>}
              {data && !subjects.length && <tr><td colSpan={5} className="fac-center">No subjects assigned.</td></tr>}
              {subjects.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.code || '—'}</td>
                  <td>{s.department}</td>
                  <td>{s.semester || '—'}</td>
                  <td>{s.section || 'All'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">🏫 Assigned Classes</div><span className="badge badge-primary">{classes.length}</span></div>
        <div className="fac-class-grid">
          {classes.map((c, i) => (
            <div key={i} className="fac-class-card">
              <div className="fac-class-dept">{c.department}</div>
              <div className="fac-muted">Semester {c.semester || '—'}{c.section ? ` · Section ${c.section}` : ' · All sections'}</div>
            </div>
          ))}
          {data && !classes.length && <p className="fac-muted">No classes assigned.</p>}
        </div>
      </div>
    </FacultyShell>
  );
}
