import { useEffect, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import '../../styles/faculty.css';

// Horizontal CSS bar. tone: 'ok' | 'warn' | 'bad' | undefined (primary).
function Bar({ label, value, max, display, tone }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const cls = tone || (pct >= 75 ? 'ok' : pct >= 40 ? 'warn' : 'bad');
  return (
    <div className="fac-bar-row">
      <div className="fac-bar-label" title={label}>{label}</div>
      <div className="fac-bar-track"><div className={`fac-bar-fill ${cls}`} style={{ width: `${pct}%` }} /></div>
      <div className="fac-bar-val">{display ?? value}</div>
    </div>
  );
}

export default function FacultyAnalytics() {
  const [a, setA] = useState(null);
  const [err, setErr] = useState('');

  const load = () => {
    setErr('');
    apiCall('/faculty-portal/analytics').then(res => {
      if (res.ok) setA(res.data.analytics);
      else setErr(res.error || 'Could not load analytics.');
    });
  };
  useEffect(load, []);

  const ts = a?.teachingSummary;
  const summary = [
    { icon: '📚', cls: 'si-purple', value: ts?.subjects, label: 'Subjects' },
    { icon: '🏫', cls: 'si-blue',   value: ts?.classes, label: 'Classes' },
    { icon: '👥', cls: 'si-green',  value: ts?.students, label: 'Students' },
    { icon: '📄', cls: 'si-orange', value: ts?.assignments, label: 'Assignments' },
    { icon: '📁', cls: 'si-purple', value: ts?.materials, label: 'Materials' },
    { icon: '📝', cls: 'si-blue',   value: ts?.marksRecords, label: 'Marks Records' },
  ];

  const pf = a?.passFail || { pass: 0, fail: 0, total: 0 };
  const attPct = a?.attendancePercentage ?? 0;
  const attColor = attPct >= 75 ? '#22c55e' : attPct >= 50 ? '#eab308' : '#ef4444';

  return (
    <FacultyShell title="Analytics">
      <div className="page-header">
        <div className="page-header-text"><h2>Analytics</h2><p>Attendance, performance and assignment insights for your classes</p></div>
      </div>

      {err && (
        <div className="alert alert-danger mb-6"><span>⚠️</span><div style={{ flex: 1 }}>{err}</div><button className="btn btn-sm btn-outline" onClick={load}>Retry</button></div>
      )}

      {/* Faculty teaching summary */}
      <div className="stats-grid mb-6">
        {summary.map(s => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.cls}`}>{s.icon}</div>
            <div className="stat-info"><h3>{a ? (s.value ?? 0) : '—'}</h3><p>{s.label}</p></div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-6">
        {/* Attendance % ring */}
        <div className="card">
          <div className="card-header"><div className="card-title">✅ Attendance Percentage</div></div>
          {!a && <p className="fac-muted">Loading…</p>}
          {a && (
            <>
              <div className="fac-ring" style={{ background: `conic-gradient(${attColor} ${attPct * 3.6}deg, var(--surface2) 0deg)` }}>
                <div className="fac-ring-inner"><span className="fac-ring-pct">{attPct}%</span><span className="fac-muted" style={{ fontSize: 11 }}>Present</span></div>
              </div>
              <div className="fac-chip-row" style={{ justifyContent: 'center', marginTop: 14 }}>
                <span className="fac-chip">✅ {a.attendanceTotals.present} present</span>
                <span className="fac-chip">❌ {a.attendanceTotals.absent} absent</span>
                <span className="fac-chip">Σ {a.attendanceTotals.total} records</span>
              </div>
            </>
          )}
        </div>

        {/* Pass / Fail */}
        <div className="card">
          <div className="card-header"><div className="card-title">🎯 Pass / Fail Statistics</div></div>
          {!a && <p className="fac-muted">Loading…</p>}
          {a && !pf.total && <p className="fac-muted">No marks recorded yet.</p>}
          {a && !!pf.total && (
            <div style={{ marginTop: 8 }}>
              <Bar label="Pass (≥50)" value={pf.pass} max={pf.total} tone="ok" display={`${pf.pass} (${Math.round((pf.pass / pf.total) * 100)}%)`} />
              <Bar label="Fail (<50)" value={pf.fail} max={pf.total} tone="bad" display={`${pf.fail} (${Math.round((pf.fail / pf.total) * 100)}%)`} />
              <p className="fac-muted" style={{ fontSize: 12, marginTop: 6 }}>Based on {pf.total} published/entered mark records.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid-2 mb-6">
        {/* Subject-wise performance */}
        <div className="card">
          <div className="card-header"><div className="card-title">📊 Subject-wise Performance (avg /100)</div></div>
          {!a && <p className="fac-muted">Loading…</p>}
          {a && !a.subjectWise.length && <p className="fac-muted">No marks recorded yet.</p>}
          {a && a.subjectWise.map(s => (
            <Bar key={s.subject} label={s.subject} value={s.average} max={100} display={`${s.average}`} />
          ))}
        </div>

        {/* Marks distribution */}
        <div className="card">
          <div className="card-header"><div className="card-title">📝 Marks Distribution (by grade)</div></div>
          {!a && <p className="fac-muted">Loading…</p>}
          {a && !a.marksDistribution.length && <p className="fac-muted">No marks recorded yet.</p>}
          {a && (() => {
            const max = Math.max(1, ...a.marksDistribution.map(d => d.count));
            return a.marksDistribution.map(d => (
              <Bar key={d.grade} label={`Grade ${d.grade}`} value={d.count} max={max} tone={d.grade === 'RA' ? 'bad' : undefined} display={`${d.count}`} />
            ));
          })()}
        </div>
      </div>

      {/* Assignment completion */}
      <div className="card">
        <div className="card-header"><div className="card-title">📄 Assignment Completion</div></div>
        {!a && <p className="fac-muted">Loading…</p>}
        {a && !a.assignmentCompletion.length && <p className="fac-muted">No assignments created yet.</p>}
        {a && a.assignmentCompletion.map((c, i) => (
          <Bar key={i} label={c.title} value={c.pct} max={100} display={`${c.submitted}/${c.expected}`} />
        ))}
      </div>
    </FacultyShell>
  );
}
