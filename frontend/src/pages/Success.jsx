import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { RingGauge, LineChart, BarList } from '../features/charts/Charts';
import '../styles/success.css';

const scoreColor = (v) => v >= 75 ? '#22c55e' : v >= 50 ? 'var(--primary)' : v >= 35 ? '#f59e0b' : '#ef4444';
const gradeFor = (v) => v >= 85 ? { label: 'Excellent', color: '#22c55e' }
  : v >= 70 ? { label: 'On Track', color: 'var(--primary)' }
  : v >= 50 ? { label: 'Needs Attention', color: '#f59e0b' }
  : { label: 'At Risk', color: '#ef4444' };
const riskIcon = { high: '🔴', medium: '🟠', low: '🟢' };

export default function Success() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    apiCall('/success').then(r => r.ok ? setD(r.data) : setErr(true));
  }, []);

  if (err) return <Layout title="Student Success"><p style={{ color: 'var(--danger)', padding: 32, textAlign: 'center' }}>Could not load your success dashboard.</p></Layout>;
  if (!d) return <Layout title="Student Success"><p style={{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>Computing your success score…</p></Layout>;

  const b = d.breakdown;
  const grade = gradeFor(d.successScore);

  return (
    <Layout title="Student Success">
      {/* Hero */}
      <div className="success-hero">
        <RingGauge value={d.successScore} size={150} stroke={14} color={grade.color} sublabel="Success" />
        <div className="success-hero-text">
          <h2>{d.successScore}/100 Success Score</h2>
          <p>{d.student?.name} · {d.student?.studentId} · {d.student?.department}</p>
          <span className="success-grade" style={{ background: `${grade.color}22`, color: grade.color }}>{grade.label}</span>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="glass-grid">
        <div className="glass-card">
          <div className="glass-card-head"><span className="glass-card-title">📊 Attendance · 30%</span></div>
          <div className="gc-metric">
            <RingGauge value={b.attendance.score} size={92} stroke={9} color={scoreColor(b.attendance.score)} label="%" />
            <div className="gc-detail">
              <div>Current: <b>{b.attendance.currentPct ?? '—'}%</b></div>
              <div>Risk: <b style={{ textTransform: 'capitalize' }}>{b.attendance.riskLevel}</b></div>
              <div>Predicted: <b>{b.attendance.prediction ?? '—'}%</b></div>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <div className="glass-card-head"><span className="glass-card-title">🎓 Academics · 40%</span></div>
          <div className="gc-metric">
            <RingGauge value={b.academic.score} size={92} stroke={9} color={scoreColor(b.academic.score)} />
            <div className="gc-detail">
              <div>CGPA: <b>{b.academic.cgpa ?? '—'}</b></div>
              <div>Backlogs: <b>{b.academic.backlogs}</b></div>
              <div>Semesters: <b>{b.academic.semesters.length}</b></div>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <div className="glass-card-head"><span className="glass-card-title">💼 Placement · 20%</span></div>
          <div className="gc-metric">
            <RingGauge value={b.placement.score} size={92} stroke={9} color={scoreColor(b.placement.score)} />
            <div className="gc-detail">
              <div>Skills: <b>{b.placement.skills}</b></div>
              <div>Projects: <b>{b.placement.projects}</b></div>
              <div>Eligible: <b>{b.placement.eligibleFor}</b></div>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <div className="glass-card-head"><span className="glass-card-title">⚡ Engagement · 10%</span></div>
          <div className="gc-metric">
            <RingGauge value={b.engagement.score} size={92} stroke={9} color={scoreColor(b.engagement.score)} />
            <div className="gc-detail">
              <div>Copilot queries: <b>{b.engagement.queries}</b></div>
              <div>Active days: <b>{b.engagement.activeDays}</b></div>
            </div>
          </div>
        </div>
      </div>

      {/* Trends */}
      <div className="two-col">
        <div className="chart-card">
          <h4>📈 Academic Progress (SGPA by semester)</h4>
          <LineChart data={b.academic.semesters} color="var(--primary)" yMax={10} />
        </div>
        <div className="chart-card">
          <h4>📊 Attendance Trend (monthly %)</h4>
          <LineChart data={b.attendance.trend} color="#22c55e" yMax={100} />
        </div>
      </div>
      <div className="two-col">
        <div className="chart-card">
          <h4>🚀 Success Score Growth</h4>
          <LineChart data={d.successTrend} color="#a855f7" yMax={100} />
        </div>
        <div className="chart-card">
          <h4>📉 Attendance by Subject</h4>
          <BarList data={b.attendance.perSubject.map(s => ({ label: s.subject, value: s.pct }))} color="var(--primary)" unit="%" />
        </div>
      </div>

      {/* Risks + Recommendations */}
      <div className="two-col">
        <div className="chart-card">
          <h4>⚠️ Risk Indicators</h4>
          {d.risks.length === 0
            ? <div className="risk-row risk-low"><span className="risk-icon">🟢</span><span className="risk-msg">No active risks — you're on track. Keep it up!</span></div>
            : d.risks.map((r, i) => (
              <div key={i} className={`risk-row risk-${r.level}`}>
                <span className="risk-icon">{riskIcon[r.level]}</span>
                <span className="risk-msg"><b style={{ textTransform: 'capitalize' }}>{r.type}</b> — {r.message}</span>
              </div>
            ))}
        </div>
        <div className="chart-card">
          <h4>🤖 AI Recommendations</h4>
          {d.recommendations.map((r, i) => (
            <div key={i} className="rec-item"><span className="rec-bullet">▸</span><span>{r}</span></div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
