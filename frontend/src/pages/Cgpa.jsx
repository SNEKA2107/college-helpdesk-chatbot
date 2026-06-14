import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import '../styles/cgpa.css';

// CRIT-01: real marks view. Data is entered by admins and read-only for students —
// no manual entry, no localStorage. Everything comes from MongoDB via /api/marks.
const GRADE_REF = [
  ['O', 'Outstanding', 10, '#4ade80'], ['A+', 'Excellent', 9, '#4ade80'], ['A', 'Very Good', 8, '#86efac'],
  ['B+', 'Good', 7, '#fde047'], ['B', 'Above Average / Pass', 6, '#fbbf24'], ['RA', 'Reappear / Fail', 0, '#f87171'],
];
const CGPA_SCALE = [
  ['9.0 – 10.0', 'First Class with Distinction', '#4ade80'],
  ['7.5 – 8.99', 'First Class', '#86efac'],
  ['6.0 – 7.49', 'Second Class', '#fbbf24'],
  ['5.0 – 5.99', 'Pass', '#fb923c'],
  ['Below 5.0', 'Fail / Arrear', '#f87171'],
];
const GRADE_BADGE = { O: 'badge-success', 'A+': 'badge-success', A: 'badge-success', 'B+': 'badge-primary', B: 'badge-warning', RA: 'badge-danger' };

function cgpaGradeLabel(v) {
  if (v >= 9) return 'First Class with Distinction 🏆';
  if (v >= 7.5) return 'First Class 🎉';
  if (v >= 6) return 'Second Class';
  if (v >= 5) return 'Pass';
  return 'Arrear / Fail';
}

export default function Cgpa() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiCall('/marks/cgpa').then(res => {
      if (res.ok) setData(res.data);
      else setData({ cgpa: 0, totalCredits: 0, semesters: [] });
    });
  }, []);

  const semesters = data?.semesters || [];
  const hasMarks = semesters.length > 0;
  const cgpa = data?.cgpa ?? 0;

  return (
    <Layout title="Marks & CGPA">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Marks &amp; CGPA</h2>
          <p>Your semester results and cumulative CGPA (Anna University 10-point scale)</p>
        </div>
      </div>

      <div className="cgpa-display">
        <div className="cgpa-val">{!data ? '…' : hasMarks ? cgpa.toFixed(2) : '—'}</div>
        <div className="cgpa-grade">{!data ? 'Loading…' : hasMarks ? cgpaGradeLabel(cgpa) : 'No marks published yet'}</div>
        <div className="cgpa-label">Cumulative Grade Point Average{hasMarks ? ` · ${data.totalCredits} credits` : ''}</div>
      </div>

      <div className="grid-2">
        <div>
          {data && !hasMarks && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎓</div>
              <p>No marks have been published yet. Your results will appear here once the admin office enters them.</p>
            </div>
          )}
          {semesters.map(sem => (
            <div key={sem.semester} className="card" style={{ marginBottom: 16 }}>
              <div className="sem-header" style={{ cursor: 'default' }}>
                <span className="sem-title">Semester {sem.semester}</span>
                <span className="sem-gpa-pill">SGPA: {sem.sgpa.toFixed(2)}</span>
              </div>
              <div className="sem-body">
                <table className="grade-table">
                  <thead><tr><th>Subject</th><th>Cr.</th><th>Int.</th><th>Ext.</th><th>Total</th><th>Grade</th></tr></thead>
                  <tbody>
                    {sem.subjects.map(s => (
                      <tr key={s._id}>
                        <td>{s.subject}{s.subjectCode ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> ({s.subjectCode})</span> : ''}</td>
                        <td>{s.credits}</td>
                        <td>{s.internalMarks}</td>
                        <td>{s.externalMarks}</td>
                        <td style={{ fontWeight: 600 }}>{s.total}</td>
                        <td><span className={`badge ${GRADE_BADGE[s.grade] || 'badge-muted'}`}>{s.grade}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">📊 Semester Summary</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!hasMarks && <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No results yet</p>}
              {semesters.map(sem => (
                <div key={sem.semester} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, background: 'var(--bg2)', borderRadius: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Semester {sem.semester}</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>{sem.sgpa.toFixed(2)}</span>
                </div>
              ))}
              {hasMarks && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 10, background: 'rgba(79,70,229,.1)', borderRadius: 8, marginTop: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>CGPA</span>
                  <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: 16 }}>{cgpa.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">📋 Grade Reference</div></div>
            <div>
              {GRADE_REF.map(([g, label, pts, color]) => (
                <div key={g} className="grade-ref-row">
                  <span style={{ fontWeight: 700 }}>{g}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 700, color }}>{pts}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">🏆 CGPA Scale</div></div>
            <div>
              {CGPA_SCALE.map(([range, label, color]) => (
                <div key={range} className="grade-ref-row">
                  <span style={{ fontWeight: 700, color }}>{range}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
