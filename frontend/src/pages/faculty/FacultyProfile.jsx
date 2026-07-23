import { useEffect, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import '../../styles/faculty.css';

export default function FacultyProfile() {
  const [f, setF] = useState(null);

  useEffect(() => {
    apiCall('/faculty-portal/me').then(res => { if (res.ok) setF(res.data.faculty); });
  }, []);

  const rows = [
    ['Faculty ID', f?.studentId],
    ['Department', f?.department],
    ['Designation', f?.designation || 'Faculty'],
    ['Email', f?.email],
    ['Phone', f?.phone || '—'],
  ];
  const subjects = f?.assignedSubjects || [];
  const classKey = s => `${s.department} · Sem ${s.semester}${s.section ? ` · Sec ${s.section}` : ''}`;
  const classes = [...new Set(subjects.map(classKey))];

  return (
    <FacultyShell title="My Profile">
      <div className="page-header">
        <div className="page-header-text"><h2>Faculty Profile</h2><p>Your account and teaching assignments</p></div>
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">👤 Details</div></div>
          <div className="fac-profile-head">
            <div className="fac-avatar-lg">{(f?.name || 'F')[0].toUpperCase()}</div>
            <div>
              <h3 style={{ margin: 0 }}>{f?.name || 'Faculty'}</h3>
              <p className="fac-muted" style={{ margin: '4px 0 0' }}>{f?.designation || 'Faculty'}</p>
            </div>
          </div>
          <table className="table" style={{ marginTop: 14 }}>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}><td className="fac-muted" style={{ width: 140 }}>{k}</td><td style={{ fontWeight: 600 }}>{v || (f ? '—' : '…')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">📚 Assigned Subjects</div></div>
          {!f && <p className="fac-muted">Loading…</p>}
          {f && !subjects.length && <p className="fac-muted">No subjects assigned.</p>}
          {subjects.map((s, i) => (
            <div key={i} className="fac-row">
              <div className="fac-row-title">{s.name}{s.code ? <span className="fac-muted"> · {s.code}</span> : ''}</div>
              <span className="badge badge-muted">{s.department} · Sem {s.semester}</span>
            </div>
          ))}
          <div className="card-header" style={{ marginTop: 16 }}><div className="card-title">🏫 Assigned Classes</div></div>
          <div className="fac-chip-row">
            {classes.map((c, i) => <span key={i} className="fac-chip">{c}</span>)}
            {f && !classes.length && <span className="fac-muted">None</span>}
          </div>
        </div>
      </div>
    </FacultyShell>
  );
}
