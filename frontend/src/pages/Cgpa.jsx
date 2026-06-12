import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import '../styles/cgpa.css';

const GRADES = { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, RA: 0, F: 0 };

const GRADE_REF = [
  ['O', 'Outstanding', 10, '#4ade80'], ['A+', 'Excellent', 9, '#4ade80'], ['A', 'Very Good', 8, '#86efac'],
  ['B+', 'Good', 7, '#fde047'], ['B', 'Above Average', 6, '#fbbf24'], ['C', 'Average', 5, '#fb923c'],
  ['RA / F', 'Fail', 0, '#f87171'],
];
const CGPA_SCALE = [
  ['9.0 – 10.0', 'First Class with Distinction', '#4ade80'],
  ['7.5 – 8.99', 'First Class', '#86efac'],
  ['6.0 – 7.49', 'Second Class', '#fbbf24'],
  ['5.0 – 5.99', 'Pass', '#fb923c'],
  ['Below 5.0', 'Fail / Arrear', '#f87171'],
];

const gradePoints = g => (GRADES[g] !== undefined ? GRADES[g] : parseFloat(g) || 0);
const validSubjects = subjects => subjects.filter(s => s.name && s.credits > 0 && s.grade);

function calcGPA(subjects) {
  const filtered = validSubjects(subjects);
  if (!filtered.length) return null;
  const totalCredits = filtered.reduce((a, s) => a + Number(s.credits), 0);
  const totalPoints = filtered.reduce((a, s) => a + gradePoints(s.grade) * Number(s.credits), 0);
  return totalCredits ? totalPoints / totalCredits : null;
}

function calcCGPA(semesters) {
  const all = semesters.filter(sem => calcGPA(sem.subjects) !== null);
  if (!all.length) return null;
  const totalC = all.reduce((a, sem) => a + validSubjects(sem.subjects).reduce((x, s) => x + Number(s.credits), 0), 0);
  const totalP = all.reduce((a, sem) => a + validSubjects(sem.subjects).reduce((x, s) => x + gradePoints(s.grade) * Number(s.credits), 0), 0);
  return totalC ? totalP / totalC : null;
}

function cgpaGradeLabel(v) {
  if (v >= 9) return 'First Class with Distinction 🏆';
  if (v >= 7.5) return 'First Class 🎉';
  if (v >= 6) return 'Second Class';
  if (v >= 5) return 'Pass';
  return 'Arrear / Fail';
}

const newSubject = () => ({ name: '', credits: '', grade: '' });

export default function Cgpa() {
  const [semesters, setSemesters] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('cgpa_data') || '[]');
    return saved.length ? saved : [{ num: 1, subjects: [newSubject()] }];
  });
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => {
    localStorage.setItem('cgpa_data', JSON.stringify(semesters));
  }, [semesters]);

  const addSemester = () => setSemesters(s => [...s, { num: s.length + 1, subjects: [newSubject()] }]);
  const deleteSem = si => setSemesters(s => s.filter((_, i) => i !== si).map((sem, i) => ({ ...sem, num: i + 1 })));
  const addSubject = si => setSemesters(s => s.map((sem, i) => (i === si ? { ...sem, subjects: [...sem.subjects, newSubject()] } : sem)));
  const deleteSub = (si, xi) => setSemesters(s => s.map((sem, i) => (i === si ? { ...sem, subjects: sem.subjects.filter((_, x) => x !== xi) } : sem)));
  const updateSub = (si, xi, field, val) => setSemesters(s => s.map((sem, i) =>
    i === si ? { ...sem, subjects: sem.subjects.map((sub, x) => (x === xi ? { ...sub, [field]: val } : sub)) } : sem));

  function resetAll() {
    if (!window.confirm('Reset all semesters? This cannot be undone.')) return;
    setSemesters([{ num: 1, subjects: [newSubject()] }]);
    setCollapsed({});
  }

  const cgpa = calcCGPA(semesters);

  return (
    <Layout title="CGPA Calculator">
      <div className="page-header">
        <div className="page-header-text">
          <h2>CGPA Calculator</h2>
          <p>Enter your grades semester-wise to calculate your CGPA</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={resetAll}>🔄 Reset All</button>
          <button className="btn btn-primary" onClick={addSemester}>+ Add Semester</button>
        </div>
      </div>

      <div className="cgpa-display">
        <div className="cgpa-val">{cgpa !== null ? cgpa.toFixed(2) : '—'}</div>
        <div className="cgpa-grade">{cgpa !== null ? cgpaGradeLabel(cgpa) : 'Enter grades to calculate'}</div>
        <div className="cgpa-label">Cumulative Grade Point Average (10-point scale)</div>
      </div>

      <div className="grid-2">
        <div>
          {!semesters.length && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎓</div>
              <p>Click <strong>+ Add Semester</strong> to start calculating your CGPA</p>
            </div>
          )}
          {semesters.map((sem, si) => {
            const gpa = calcGPA(sem.subjects);
            return (
              <div key={si} className="card" style={{ marginBottom: 16 }}>
                <div className="sem-header" onClick={() => setCollapsed(c => ({ ...c, [si]: !c[si] }))}>
                  <span className="sem-title">Semester {sem.num}</span>
                  <span className="sem-gpa-pill">{gpa !== null ? `GPA: ${gpa.toFixed(2)}` : 'Incomplete'}</span>
                </div>
                {!collapsed[si] && (
                  <div className="sem-body">
                    <table className="grade-table">
                      <thead><tr><th>Subject</th><th>Credits</th><th>Grade</th><th></th></tr></thead>
                      <tbody>
                        {sem.subjects.map((s, xi) => (
                          <tr key={xi}>
                            <td><input className="grade-input" placeholder="Subject name" value={s.name || ''} onChange={e => updateSub(si, xi, 'name', e.target.value)} /></td>
                            <td><input className="grade-input" type="number" min="1" max="6" placeholder="Credits" value={s.credits || ''} style={{ width: 70 }} onChange={e => updateSub(si, xi, 'credits', e.target.value)} /></td>
                            <td>
                              <select className="grade-input" style={{ width: 80 }} value={s.grade || ''} onChange={e => updateSub(si, xi, 'grade', e.target.value)}>
                                <option value="">--</option>
                                {Object.keys(GRADES).map(g => <option key={g} value={g}>{g}</option>)}
                              </select>
                            </td>
                            <td><button className="del-row" onClick={() => deleteSub(si, xi)}>×</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
                      <button className="add-sub-btn" onClick={() => addSubject(si)}>+ Add Subject</button>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => deleteSem(si)}>🗑 Remove Semester</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">📊 Semester Summary</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!semesters.length && <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Add semesters to see summary</p>}
              {semesters.map((sem, si) => {
                const g = calcGPA(sem.subjects);
                return (
                  <div key={si} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, background: 'var(--bg2)', borderRadius: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Semester {sem.num}</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>{g !== null ? g.toFixed(2) : '—'}</span>
                  </div>
                );
              })}
              {cgpa !== null && (
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
