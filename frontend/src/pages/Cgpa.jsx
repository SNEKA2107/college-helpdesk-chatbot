import { useEffect, useMemo, useState } from 'react';
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

// ── What-If CGPA Calculator ────────────────────────────────────────────────
// Purely client-side estimator. It shares the official Anna University 10-point
// grade scale (from GRADE_REF) but NEVER touches admin marks, calls an API, or
// writes to the database. The only persistence is this browser's localStorage.
// Grade scale for the estimator — kept independent of the official GRADE_REF so
// it can offer the full Anna University scale (incl. C) without touching the
// official Academic Record view or its Grade Reference card.
const WHATIF_GRADES = [['O', 10], ['A+', 9], ['A', 8], ['B+', 7], ['B', 6], ['C', 5], ['RA', 0]];
const GRADE_POINTS = Object.fromEntries(WHATIF_GRADES.map(([g, pts]) => [g, pts]));
const WHATIF_KEY = 'cgpa_whatif';
const emptySubject = () => ({ name: '', credits: '', grade: '' });
const emptySemester = () => ({ subjects: [emptySubject()] });

// Credit-weighted SGPA for one semester's rows (ignores incomplete rows).
function semStats(subjects) {
  let credits = 0, points = 0;
  for (const s of subjects) {
    const c = Number(s.credits);
    if (!Number.isFinite(c) || c <= 0 || !(s.grade in GRADE_POINTS)) continue;
    credits += c;
    points += c * GRADE_POINTS[s.grade];
  }
  return { credits, points, sgpa: credits ? points / credits : 0 };
}

function WhatIfCalculator() {
  const [sems, setSems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WHATIF_KEY) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch { /* ignore corrupt storage */ }
    return [emptySemester()];
  });

  // Optional persistence — local to this browser only.
  useEffect(() => {
    try { localStorage.setItem(WHATIF_KEY, JSON.stringify(sems)); } catch { /* ignore */ }
  }, [sems]);

  const addSemester    = () => setSems(s => [...s, emptySemester()]);
  const removeSemester = i  => setSems(s => (s.length > 1 ? s.filter((_, idx) => idx !== i) : s));
  const addSubject     = si => setSems(s => s.map((sem, i) => (i === si ? { ...sem, subjects: [...sem.subjects, emptySubject()] } : sem)));
  const removeSubject  = (si, xi) => setSems(s => s.map((sem, i) => (i === si ? { ...sem, subjects: sem.subjects.length > 1 ? sem.subjects.filter((_, j) => j !== xi) : sem.subjects } : sem)));
  const updateSubject  = (si, xi, field, val) => setSems(s => s.map((sem, i) => (i === si ? { ...sem, subjects: sem.subjects.map((sub, j) => (j === xi ? { ...sub, [field]: val } : sub)) } : sem)));
  const reset = () => { if (window.confirm('Clear all What-If entries? This only resets the estimator — your official records are unaffected.')) setSems([emptySemester()]); };

  const { cgpa, totalCredits } = useMemo(() => {
    let credits = 0, points = 0;
    for (const sem of sems) { const r = semStats(sem.subjects); credits += r.credits; points += r.points; }
    return { cgpa: credits ? points / credits : 0, totalCredits: credits };
  }, [sems]);

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-header">
        <div className="card-title">🎯 What-If CGPA Calculator</div>
        <span className="badge badge-muted">Estimate only</span>
      </div>
      <p className="whatif-note">This calculator is for estimation only and does not affect your official academic records.</p>

      {sems.map((sem, si) => {
        const r = semStats(sem.subjects);
        return (
          <div key={si} className="whatif-sem">
            <div className="sem-header" style={{ cursor: 'default' }}>
              <span className="sem-title">Semester {si + 1}</span>
              <span className="sem-gpa-pill">SGPA: {r.sgpa.toFixed(2)}</span>
            </div>
            <table className="grade-table">
              <thead><tr><th>Subject</th><th style={{ width: 90 }}>Credits</th><th style={{ width: 110 }}>Grade</th><th style={{ width: 40 }}></th></tr></thead>
              <tbody>
                {sem.subjects.map((sub, xi) => (
                  <tr key={xi}>
                    <td><input className="grade-input" placeholder="Subject name" value={sub.name} onChange={e => updateSubject(si, xi, 'name', e.target.value)} /></td>
                    <td><input className="grade-input" type="number" min="0" max="12" placeholder="Cr." value={sub.credits} onChange={e => updateSubject(si, xi, 'credits', e.target.value)} /></td>
                    <td>
                      <select className="grade-input" value={sub.grade} onChange={e => updateSubject(si, xi, 'grade', e.target.value)}>
                        <option value="">—</option>
                        {WHATIF_GRADES.map(([g, pts]) => <option key={g} value={g}>{g} ({pts})</option>)}
                      </select>
                    </td>
                    <td><button className="del-row" title="Remove subject" onClick={() => removeSubject(si, xi)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="whatif-sem-actions">
              <button className="add-sub-btn" onClick={() => addSubject(si)}>+ Add Subject</button>
              {sems.length > 1 && <button className="btn btn-secondary btn-sm" onClick={() => removeSemester(si)}>🗑 Remove Semester</button>}
            </div>
          </div>
        );
      })}

      <div className="whatif-footer">
        <div className="whatif-actions">
          <button className="btn btn-secondary" onClick={addSemester}>+ Add Semester</button>
          <button className="btn btn-outline" onClick={reset}>↺ Reset</button>
        </div>
        <div className="whatif-result">
          <span className="whatif-result-lbl">Estimated CGPA</span>
          <span className="whatif-result-val">{totalCredits ? cgpa.toFixed(2) : '—'}</span>
          {totalCredits > 0 && <span className="whatif-result-sub">{cgpaGradeLabel(cgpa)} · {totalCredits} credits</span>}
        </div>
      </div>
    </div>
  );
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

      <WhatIfCalculator />
    </Layout>
  );
}
