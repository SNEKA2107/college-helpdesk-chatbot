import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { RingGauge, LineChart, BarList } from '../features/charts/Charts';
import '../styles/success.css';
import '../styles/home.css';
import '../styles/placement.css';

const riskColor = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e', unknown: 'var(--text-muted)' };
const tierColor = (t) => ({ 'Strong': '#22c55e', 'Competitive': 'var(--primary)', 'Developing': '#f59e0b', 'Needs work': '#ef4444' }[t] || 'var(--primary)');
const matchColor = (v) => v >= 75 ? '#22c55e' : v >= 55 ? 'var(--primary)' : '#f59e0b';

export default function Placement() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);
  const [onlyEligible, setOnlyEligible] = useState(false);

  useEffect(() => {
    apiCall('/placement').then(r => r.ok ? setD(r.data) : setErr(true));
  }, []);

  if (err) return <Layout title="Placement Hub"><p className="home-msg home-msg-err">Could not load the Placement Hub. Please try again.</p></Layout>;
  if (!d) return <Layout title="Placement Hub"><div className="home-msg"><span className="home-spinner" /> Analyzing your placement readiness…</div></Layout>;

  const r = d.readiness;
  const companies = onlyEligible ? d.eligibility.companies.filter(c => c.eligible) : d.eligibility.companies;

  return (
    <Layout title="Placement Hub" mainClassName="main-content home-page">
      {/* ── Hero / Readiness ── */}
      <section className="home-hero animate-card">
        <div className="home-hero-left">
          <div className="home-greeting">💼 Placement Hub</div>
          <h1 className="home-hero-name">{d.student?.name}</h1>
          <div className="home-hero-meta">
            <span className="home-chip">{d.student?.department}</span>
            {d.student?.semester && <span className="home-chip">Semester {d.student.semester}</span>}
            <span className="home-chip">CGPA {d.profile.cgpa || '—'}</span>
            <span className="home-chip">Attendance {d.profile.attendancePct ?? '—'}%</span>
            <span className="home-chip home-chip-id">{d.eligibility.eligibleCount}/{d.eligibility.total} eligible</span>
          </div>
          <p className="home-hero-tagline">Your AI-powered roadmap from campus to offer letter.</p>
        </div>
        <div className="home-hero-score">
          <RingGauge value={r.score} size={132} stroke={13} color={riskColor[r.riskLevel]} sublabel="Ready" />
          <span className="home-grade" style={{ background: `${riskColor[r.riskLevel]}22`, color: riskColor[r.riskLevel] }}>{r.eligibleFor}</span>
        </div>
      </section>

      {/* ── Readiness breakdown + Resume strength ── */}
      <div className="two-col">
        <div className="home-widget animate-card">
          <div className="home-card-head"><h3>🎯 Placement Readiness Score</h3></div>
          <BarList data={r.components.map(c => ({ label: `${c.label} · ${c.weight}%`, value: c.value }))} color="var(--primary)" unit="" />
          <p className="plh-note">Weighted from your CGPA, skills, attendance and projects — reused from your Success Dashboard.</p>
        </div>

        <div className="home-widget animate-card">
          <div className="home-card-head"><h3>📄 Resume Strength Score</h3></div>
          <div className="plh-resume">
            <RingGauge value={d.resume.score} size={92} stroke={10} color={tierColor(d.resume.tier)} />
            <div>
              <span className="plh-tier" style={{ background: `${tierColor(d.resume.tier)}22`, color: tierColor(d.resume.tier) }}>{d.resume.tier}</span>
              <div className="plh-factors">
                {d.resume.factors.map((f, i) => (
                  <div key={i} className="plh-factor">
                    <span className="plh-factor-label">{f.label}</span>
                    <div className="plh-factor-track"><div className="plh-factor-fill" style={{ width: `${f.value}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {d.resume.tips.length > 0 && (
            <div className="plh-tips">
              {d.resume.tips.map((t, i) => <div key={i} className="home-action-row"><span>▸</span>{t}</div>)}
            </div>
          )}
        </div>
      </div>

      {/* ── Company Recommendation Engine ── */}
      <section className="home-widget animate-card" style={{ marginBottom: 16 }}>
        <div className="home-card-head"><h3>⭐ Recommended Companies (best fit)</h3></div>
        <div className="plh-rec-grid">
          {d.recommendations.map((c, i) => (
            <div key={i} className="plh-rec-card">
              <div className="plh-rec-top">
                <span className="plh-rec-name">{c.name}</span>
                <span className="plh-match" style={{ color: matchColor(c.matchPct) }}>{c.matchPct}%</span>
              </div>
              <div className="plh-rec-role">{c.role} · {c.sector} · ₹{c.ctc} LPA</div>
              <span className={`plh-badge ${c.eligible ? 'plh-badge-on' : 'plh-badge-off'}`}>{c.eligible ? '✓ Eligible' : '🔒 Aspirational'}</span>
              <p className="plh-rec-action">{c.action}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Company Eligibility Checker ── */}
      <section className="home-widget animate-card" style={{ marginBottom: 16 }}>
        <div className="home-card-head">
          <h3>🏢 Company Eligibility Checker</h3>
          <label className="plh-toggle">
            <input type="checkbox" checked={onlyEligible} onChange={e => setOnlyEligible(e.target.checked)} />
            Eligible only
          </label>
        </div>
        <div className="plh-table">
          <div className="plh-row plh-head">
            <span>Company</span><span>Role</span><span className="plh-c">CGPA</span><span className="plh-c">Att%</span><span className="plh-c">Skills</span><span className="plh-c">Status</span>
          </div>
          {companies.map((c, i) => (
            <div key={i} className={`plh-row${c.eligible ? '' : ' plh-row-off'}`}>
              <span className="plh-co"><b>{c.name}</b><em>₹{c.ctc} LPA</em></span>
              <span className="plh-role-cell">{c.role}</span>
              <span className="plh-c">{c.minCgpa}</span>
              <span className="plh-c">{c.minAtt}</span>
              <span className="plh-c">{c.skillMatchPct}%</span>
              <span className="plh-c">
                {c.eligible
                  ? <span className="plh-pill plh-pill-on">Eligible</span>
                  : <span className="plh-pill plh-pill-off" title={c.reasons.join(' · ')}>Locked</span>}
              </span>
            </div>
          ))}
          {companies.length === 0 && <p className="home-empty">No companies match this filter yet — close the gaps below.</p>}
        </div>
      </section>

      {/* ── Skill Gap Analysis ── */}
      <section className="home-widget animate-card" style={{ marginBottom: 16 }}>
        <div className="home-card-head">
          <h3>🧩 Skill Gap Analysis</h3>
          <span className="plh-coverage">{d.skillGap.overallCoverage}% coverage ({d.skillGap.haveCount}/{d.skillGap.totalTracked})</span>
        </div>
        <div className="plh-gap-grid">
          {d.skillGap.categories.map((cat, i) => (
            <div key={i} className="plh-gap-cat">
              <div className="plh-gap-head"><span>{cat.category}</span><span className="plh-gap-pct">{cat.coverage}%</span></div>
              <div className="plh-skill-wrap">
                {cat.items.map((it, j) => (
                  <span key={j} className={`plh-skill${it.have ? ' plh-skill-have' : ' plh-skill-miss'}`}>
                    {it.have ? '✓' : '＋'} {it.skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {d.skillGap.topMissing.length > 0 && (
          <p className="plh-note">Priority skills to add next: <b>{d.skillGap.topMissing.join(', ')}</b></p>
        )}
      </section>

      {/* ── Interview Preparation Assistant ── */}
      <section className="home-widget animate-card" style={{ marginBottom: 16 }}>
        <div className="home-card-head">
          <h3>🎤 Interview Preparation Assistant</h3>
          <span className={`home-ai-badge${d.interviewPrep.aiGenerated ? '' : ' home-ai-badge-fallback'}`}>
            {d.interviewPrep.aiGenerated ? 'AI generated' : 'Smart plan'}
          </span>
        </div>
        <p className="home-briefing-summary">{d.interviewPrep.plan}</p>
        <div className="plh-track-grid">
          {d.interviewPrep.tracks.map((t, i) => (
            <div key={i} className="plh-track">
              <div className="plh-track-head">{t.icon} {t.track}</div>
              <div className="plh-track-topics">{t.topics.map((tp, j) => <span key={j} className="plh-topic">{tp}</span>)}</div>
              <ul className="plh-track-samples">{t.samples.map((s, j) => <li key={j}>{s}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Placement Trend Charts ── */}
      <h2 className="home-section-title">📈 Placement Trends</h2>
      <div className="two-col">
        <div className="chart-card animate-card">
          <h4>💼 Placement Readiness Growth</h4>
          <LineChart data={d.trends.readinessTrend} color="var(--primary)" yMax={100} />
        </div>
        <div className="chart-card animate-card">
          <h4>🎓 CGPA Trend</h4>
          <LineChart data={d.trends.cgpaTrend} color="#a855f7" yMax={10} />
        </div>
      </div>

      {/* ── Campus Copilot Integration ── */}
      <section className="home-widget animate-card" style={{ marginTop: 16 }}>
        <div className="home-card-head"><h3>💬 Ask Campus Copilot</h3><Link to="/chat" className="home-link">Open chat</Link></div>
        <div className="convo-pills">
          {d.copilotPrompts.map((q, i) => (
            <Link key={i} to="/chat" className="convo-pill">{q}</Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
