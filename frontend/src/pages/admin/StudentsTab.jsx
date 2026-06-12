import { useState } from 'react';
import { emptyCellStyle, loadingCellStyle } from './shared';

export default function StudentsTab({ data, loaded }) {
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');

  // Like the legacy page, filtering only happens on Search click / Enter
  const q = applied.toLowerCase().trim();
  const list = q
    ? data.students.filter(s => s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q))
    : data.students;

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>All Students</h2><p>All registered students in the system</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text" className="form-input" placeholder="Search by name or ID…" style={{ width: 220 }}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setApplied(query); }}
          />
          <button className="btn btn-secondary" onClick={() => setApplied(query)}>Search</button>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">All Students ({list.length})</div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Student</th><th>Register No.</th><th>Department</th><th>Semester</th><th>Email</th><th>Account</th></tr>
            </thead>
            <tbody>
              {!loaded && <tr><td colSpan={6} style={loadingCellStyle}>Loading…</td></tr>}
              {loaded && !list.length && <tr><td colSpan={6} style={emptyCellStyle}>No students found</td></tr>}
              {loaded && list.map(s => (
                <tr key={s._id || s.studentId}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {(s.name || '?')[0]}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{s.studentId}</td>
                  <td>{s.department || '—'}</td>
                  <td>{s.semester || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.email || '—'}</td>
                  <td><span className={`badge ${s.isActive ? 'badge-success' : 'badge-danger'}`}>{s.isActive ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
