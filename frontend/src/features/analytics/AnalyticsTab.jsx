import { useEffect, useState } from 'react';
import { apiCall } from '../../services/api';
import { LineChart, BarList } from '../charts/Charts';
import '../../styles/success.css';

export default function AnalyticsTab() {
  const [a, setA] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    apiCall('/analytics').then(r => r.ok ? setA(r.data) : setErr(true));
  }, []);

  if (err) return <p style={{ color: 'var(--danger)', padding: 24, textAlign: 'center' }}>Failed to load analytics.</p>;
  if (!a) return <p style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>Loading AI analytics…</p>;

  // Only show the busiest 8 hours so the peak-usage bar list stays readable.
  const topHours = [...a.peakHours].filter(h => h.value > 0).sort((x, y) => y.value - x.value).slice(0, 8)
    .sort((x, y) => x.label.localeCompare(y.label)).map(h => ({ label: `${h.label}:00`, value: h.value }));

  return (
    <div>
      <div className="stats-grid mb-6">
        <div className="stat-card"><div className="stat-icon si-blue">💬</div><div className="stat-info"><h3>{a.kpis.totalQueries}</h3><p>Total Queries</p></div></div>
        <div className="stat-card"><div className="stat-icon si-purple">🧵</div><div className="stat-info"><h3>{a.kpis.conversations}</h3><p>Conversations</p></div></div>
        <div className="stat-card"><div className="stat-icon si-green">👤</div><div className="stat-info"><h3>{a.kpis.activeUsers}</h3><p>Active Users</p></div></div>
        <div className="stat-card"><div className="stat-icon si-orange">✅</div><div className="stat-info"><h3>{a.kpis.resolutionRate}%</h3><p>Resolution Rate</p></div></div>
      </div>

      <div className="two-col">
        <div className="chart-card">
          <h4>📈 Daily AI Usage (last 30 days)</h4>
          <LineChart data={a.dailyUsage} color="var(--primary)" />
        </div>
        <div className="chart-card">
          <h4>🗂️ Query Categories</h4>
          <BarList data={a.categories} color="#a855f7" />
        </div>
      </div>

      <div className="two-col">
        <div className="chart-card">
          <h4>❓ Most Asked Questions</h4>
          <BarList data={a.topQuestions} color="var(--primary)" />
        </div>
        <div className="chart-card">
          <h4>⏰ Peak Usage Hours</h4>
          <BarList data={topHours} color="#22c55e" />
        </div>
      </div>

      <div className="chart-card">
        <h4>🧠 Knowledge Gaps — unanswered queries to add to the Knowledge Base</h4>
        {a.knowledgeGaps.length
          ? <BarList data={a.knowledgeGaps} color="#ef4444" />
          : <div className="chart-empty">No unanswered queries — Campus HelpDesk is grounding every question. 🎉</div>}
      </div>
    </div>
  );
}
