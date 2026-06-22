import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { RingGauge, LineChart, BarList } from '../features/charts/Charts';
import { timeAgo } from '../utils/format';
import '../styles/success.css';
import '../styles/home.css';

const gradeColor = (g) => ({
  'Excellent': '#22c55e', 'On Track': 'var(--primary)',
  'Needs Attention': '#f59e0b', 'At Risk': '#ef4444',
}[g] || 'var(--primary)');

const riskColor = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e', unknown: 'var(--text-muted)' };
const priorityColor = { urgent: '#ef4444', high: '#f59e0b', medium: 'var(--primary)', low: '#22c55e' };

const QUICK_ACTIONS = [
  { to: '/chat',    icon: '💬', label: 'Ask Copilot',      bg: 'linear-gradient(135deg,#4f46e5,#818cf8)' },
  { to: '/success', icon: '🚀', label: 'Success Dashboard', bg: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  { to: '/placement', icon: '💼', label: 'View Placements', bg: 'linear-gradient(135deg,#10b981,#34d399)' },
  { to: '/notices', icon: '🔔', label: 'View Notices',      bg: 'linear-gradient(135deg,#f59e0b,#facc15)' },
];

function Countdown({ days }) {
  if (days == null) return <span className="exam-count exam-count-muted">TBA</span>;
  const cls = days <= 3 ? 'exam-count-urgent' : days <= 7 ? 'exam-count-soon' : 'exam-count-ok';
  return <span className={`exam-count ${cls}`}>{days === 0 ? 'Today' : `${days}d`}</span>;
}

export default function Home() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    apiCall('/home').then(r => r.ok ? setD(r.data) : setErr(true));
  }, []);

  if (err) return <Layout title="Home"><p className="home-msg home-msg-err">Could not load your home dashboard. Please try again.</p></Layout>;
  if (!d) return <Layout title="Home"><div className="home-msg"><span className="home-spinner" /> Preparing your personalized dashboard…</div></Layout>;

  const gc = gradeColor(d.grade);
  const att = d.attendance;
  const plc = d.placement;
  const br = d.briefing;
  const firstName = (d.student?.name || 'Student').split(' ')[0];

  return (
    <Layout title="Home" mainClassName="main-content home-page">
      {/* ── 1. Welcome Hero ── */}
      <section className="home-hero animate-card">
        <div className="home-hero-left">
          <div className="home-greeting">{d.greeting}, <span>{firstName}</span> 👋</div>
          <h1 className="home-hero-name">{d.student?.name}</h1>
          <div className="home-hero-meta">
            <span className="home-chip">{d.student?.department || 'Student'}</span>
            {d.student?.semester && <span className="home-chip">Semester {d.student.semester}</span>}
            {d.student?.year && <span className="home-chip">{d.student.year}</span>}
            <span className="home-chip home-chip-id">{d.student?.studentId}</span>
          </div>
          <p className="home-hero-tagline">Here's your AI-powered snapshot for today.</p>
        </div>
        <div className="home-hero-score">
          <RingGauge value={d.successScore} size={132} stroke={13} color={gc} sublabel="Success" />
          <span className="home-grade" style={{ background: `${gc}22`, color: gc }}>{d.grade}</span>
        </div>
      </section>

      {/* ── 2. AI Daily Briefing ── */}
      <section className="home-briefing animate-card">
        <div className="home-card-head">
          <h3>🧠 AI Daily Briefing</h3>
          <span className={`home-ai-badge${br.aiGenerated ? '' : ' home-ai-badge-fallback'}`}>
            {br.aiGenerated ? 'AI generated' : 'Smart summary'}
          </span>
        </div>
        <p className="home-briefing-summary">{br.summary}</p>
        <div className="home-briefing-grid">
          <div className="home-brief-item"><span className="home-brief-icon">🎓</span><div><b>Academic</b><p>{br.academicStatus}</p></div></div>
          <div className="home-brief-item"><span className="home-brief-icon">{br.attendanceWarning ? '⚠️' : '✅'}</span><div><b>Attendance</b><p>{br.attendanceWarning || 'All subjects above the 75% requirement.'}</p></div></div>
          <div className="home-brief-item"><span className="home-brief-icon">📘</span><div><b>Exams</b><p>{br.upcomingExam || 'No exam schedule published yet.'}</p></div></div>
          <div className="home-brief-item"><span className="home-brief-icon">💼</span><div><b>Placement</b><p>{br.placementOpportunity}</p></div></div>
        </div>
        {br.actions?.length > 0 && (
          <div className="home-actions-list">
            <span className="home-actions-title">Recommended actions</span>
            {br.actions.map((a, i) => <div key={i} className="home-action-row"><span>▸</span>{a}</div>)}
          </div>
        )}
      </section>

      {/* ── 9. Quick Actions ── */}
      <section className="home-quick">
        {QUICK_ACTIONS.map((q, i) => (
          <Link key={i} to={q.to} className="home-quick-card animate-card" style={{ background: q.bg }}>
            <span className="home-quick-icon">{q.icon}</span>
            <span className="home-quick-label">{q.label}</span>
          </Link>
        ))}
      </section>

      {/* ── Widgets grid ── */}
      <div className="home-grid">
        {/* 3. Upcoming Exams */}
        <section className="home-widget animate-card">
          <div className="home-card-head"><h3>📘 Upcoming Exams</h3><Link to="/exam" className="home-link">View all</Link></div>
          {att && d.exams.upcoming.length === 0 && <p className="home-empty">No upcoming exams scheduled.</p>}
          {d.exams.upcoming.map((e, i) => (
            <div key={i} className="exam-row">
              <div className="exam-info">
                <span className="exam-subject">{e.subject}</span>
                <span className="exam-sub">{e.code}{e.session ? ` · ${e.session}` : ''}{e.date ? ` · ${e.date}` : ''}</span>
              </div>
              <Countdown days={e.daysUntil} />
            </div>
          ))}
        </section>

        {/* 4. Attendance Alert */}
        <section className="home-widget animate-card">
          <div className="home-card-head"><h3>✅ Attendance Alert</h3><Link to="/attendance" className="home-link">Details</Link></div>
          {!att.hasData ? <p className="home-empty">No attendance records yet.</p> : (
            <>
              <div className="att-overview">
                <RingGauge value={att.overall ?? 0} size={84} stroke={9} color={riskColor[att.riskLevel]} label="%" />
                <div className="att-meta">
                  <div className="att-risk" style={{ color: riskColor[att.riskLevel] }}>
                    ● {att.riskLevel === 'low' ? 'Healthy' : att.riskLevel === 'medium' ? 'Watch closely' : 'At risk'}
                  </div>
                  <div className="att-pred">Predicted: <b>{att.prediction ?? '—'}%</b></div>
                  <div className="att-pred">Min required: <b>75%</b></div>
                </div>
              </div>
              {att.belowThreshold.length > 0 ? (
                <div className="att-below">
                  <span className="att-below-title">⚠️ Below 75%</span>
                  {att.belowThreshold.map((s, i) => (
                    <div key={i} className="att-below-row"><span>{s.subject}</span><span className="att-below-pct">{s.pct}%</span></div>
                  ))}
                </div>
              ) : <div className="att-ok">🟢 All subjects above the 75% threshold.</div>}
            </>
          )}
        </section>

        {/* 5. Placement Opportunities */}
        <section className="home-widget animate-card">
          <div className="home-card-head"><h3>💼 Placement Opportunities</h3></div>
          <div className="plc-top">
            <RingGauge value={plc.readiness} size={84} stroke={9} color={riskColor[plc.riskLevel]} sublabel="Ready" />
            <div className="plc-meta">
              <div><b>{plc.eligibleCount}</b> eligible companies</div>
              <div className="plc-sub">{plc.skills} skills · {plc.projects} projects</div>
              <div className="plc-sub">{plc.eligibleFor}</div>
            </div>
          </div>
          <div className="plc-companies">
            {plc.companies.slice(0, 6).map((c, i) => (
              <div key={i} className={`plc-chip${c.eligible ? ' plc-chip-on' : ''}`} title={c.reason}>
                {c.eligible ? '✓' : '🔒'} {c.name}
              </div>
            ))}
          </div>
          {plc.recommendedSkills.length > 0 && (
            <div className="plc-skills">
              <span className="att-below-title">Recommended skills</span>
              <div className="plc-skill-tags">
                {plc.recommendedSkills.map((s, i) => <span key={i} className="plc-skill-tag">{s}</span>)}
              </div>
            </div>
          )}
        </section>

        {/* 6. Smart Notice Feed */}
        <section className="home-widget animate-card">
          <div className="home-card-head"><h3>🔔 Smart Notice Feed</h3><Link to="/notices" className="home-link">View all</Link></div>
          {d.notices.length === 0 && <p className="home-empty">No notices for you right now.</p>}
          {d.notices.map((n) => (
            <div key={n.id} className="notice-row">
              <div className="notice-head">
                <span className="notice-dot" style={{ background: priorityColor[n.aiPriority] }} />
                <span className="notice-title">{n.pinned && '📌 '}{n.title}</span>
                <span className="notice-time">{timeAgo(n.publishedAt)}</span>
              </div>
              <p className="notice-summary">{n.summary}</p>
              {n.actionItems.length > 0 && (
                <div className="notice-actions">{n.actionItems.map((a, i) => <span key={i} className="notice-action">✔ {a}</span>)}</div>
              )}
            </div>
          ))}
        </section>

        {/* 7. Recent Copilot Activity */}
        <section className="home-widget animate-card">
          <div className="home-card-head"><h3>💬 Recent Copilot Activity</h3><Link to="/chat" className="home-link">Open</Link></div>
          {d.copilot.conversations.length === 0
            ? <p className="home-empty">No conversations yet — ask Campus Copilot anything.</p>
            : d.copilot.conversations.map((c) => (
              <Link key={c.id} to="/chat" className="convo-row">
                <span className="convo-icon">💭</span>
                <span className="convo-title">{c.title}</span>
                <span className="convo-time">{timeAgo(c.lastMessageAt)}</span>
              </Link>
            ))}
          <div className="convo-suggest">
            <span className="att-below-title">Suggested questions</span>
            <div className="convo-pills">
              {d.copilot.suggestedQuestions.map((q, i) => (
                <Link key={i} to="/chat" className="convo-pill">{q}</Link>
              ))}
            </div>
          </div>
        </section>

        {/* 8. Personalized Recommendations */}
        <section className="home-widget animate-card">
          <div className="home-card-head"><h3>🎯 Personalized Recommendations</h3></div>
          {[
            { key: 'academic', icon: '🎓', label: 'Academic' },
            { key: 'attendance', icon: '✅', label: 'Attendance' },
            { key: 'placement', icon: '💼', label: 'Placement' },
          ].map(group => (
            d.recommendations[group.key]?.length > 0 && (
              <div key={group.key} className="rec-group">
                <span className="rec-group-label">{group.icon} {group.label}</span>
                {d.recommendations[group.key].map((r, i) => (
                  <div key={i} className="home-action-row"><span>▸</span>{r}</div>
                ))}
              </div>
            )
          ))}
          {['academic', 'attendance', 'placement'].every(k => !d.recommendations[k]?.length) && (
            <p className="home-empty">You're on track across the board — keep it up! 🎉</p>
          )}
        </section>
      </div>

      {/* ── 10. Dashboard Insights ── */}
      <h2 className="home-section-title">📈 Dashboard Insights</h2>
      <div className="home-insights">
        <div className="chart-card animate-card">
          <h4>🚀 Success Trend</h4>
          <LineChart data={d.insights.successTrend} color="#a855f7" yMax={100} />
        </div>
        <div className="chart-card animate-card">
          <h4>📊 Attendance Trend</h4>
          <LineChart data={d.insights.attendanceTrend} color="#22c55e" yMax={100} />
        </div>
        <div className="chart-card animate-card">
          <h4>💼 Placement Growth</h4>
          <LineChart data={d.insights.placementTrend} color="var(--primary)" yMax={100} />
        </div>
      </div>
      {att.perSubject?.length > 0 && (
        <div className="chart-card animate-card" style={{ marginTop: 16 }}>
          <h4>📉 Attendance by Subject</h4>
          <BarList data={att.perSubject.map(s => ({ label: s.subject, value: s.pct }))} color="var(--primary)" unit="%" />
        </div>
      )}
    </Layout>
  );
}
