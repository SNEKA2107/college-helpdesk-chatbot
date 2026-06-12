import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { formatDate } from '../utils/format';
import '../styles/attendance.css';

const colorClass = pct => (pct >= 85 ? 'good' : pct >= 75 ? 'warn' : 'low');

export default function Attendance() {
  const [summaryData, setSummaryData] = useState(null);
  const [records, setRecords] = useState(null);

  useEffect(() => {
    apiCall('/attendance/summary').then(res => { if (res.ok) setSummaryData(res.data); });
    apiCall('/attendance').then(res => { if (res.ok) setRecords(res.data.records || []); });
  }, []);

  const { summary = [], overall = 0, totalClasses = 0, totalPresent = 0 } = summaryData || {};
  const totalAbsent = totalClasses - totalPresent;

  const statusBadgeClass = s => (s === 'Present' ? 'badge-present' : s === 'Absent' ? 'badge-absent' : 'badge-late');

  return (
    <Layout title="My Attendance">
      {totalClasses > 0 && (
        <div className="overall-box reveal" style={{ display: 'flex' }}>
          <div className={`overall-circle ${colorClass(overall)}`}>
            <div className="overall-pct">{overall}%</div>
            <div className="overall-label">Overall</div>
          </div>
          <div className="overall-info">
            <h3>Attendance Summary</h3>
            <p>Minimum 75% required in all subjects to sit for exams.</p>
            <div className="overall-stats">
              <div className="o-stat"><div className="o-stat-val">{totalClasses}</div><div className="o-stat-lbl">Total Classes</div></div>
              <div className="o-stat"><div className="o-stat-val" style={{ color: '#4ade80' }}>{totalPresent}</div><div className="o-stat-lbl">Present</div></div>
              <div className="o-stat"><div className="o-stat-val" style={{ color: '#f87171' }}>{totalAbsent}</div><div className="o-stat-lbl">Absent</div></div>
            </div>
          </div>
        </div>
      )}

      <div className="card reveal" style={{ marginBottom: 24 }}>
        <h3 className="card-title">Subject-wise Breakdown</h3>
        <div style={{ marginTop: 16 }}>
          {!summaryData && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Loading…</div>}
          {summaryData && !summary.length && (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)', marginBottom: 6 }}>No attendance records yet</p>
              <p>Your attendance will appear here once your class admin starts marking it.</p>
            </div>
          )}
          {summary.map(s => {
            const cls = colorClass(s.percentage);
            return (
              <div key={s.subject} className="subject-card">
                <div className="subj-head">
                  <span className="subj-name">{s.subject}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {s.percentage < 75 && <span style={{ color: '#f87171', fontSize: 12 }}>⚠ Below minimum!</span>}
                    <span className={`subj-pct pct-${cls}`}>{s.percentage}%</span>
                  </div>
                </div>
                <div className="progress-bar"><div className={`progress-fill fill-${cls}`} style={{ width: `${s.percentage}%` }}></div></div>
                <div className="subj-counts">
                  <span>Total: {s.total}</span>
                  <span style={{ color: '#4ade80' }}>Present: {s.present}</span>
                  <span style={{ color: '#f87171' }}>Absent: {s.absent}</span>
                  {s.late > 0 && <span style={{ color: '#eab308' }}>Late: {s.late}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card reveal">
        <h3 className="card-title">Recent Attendance Records</h3>
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead><tr><th>Date</th><th>Subject</th><th>Status</th><th>Marked By</th></tr></thead>
            <tbody>
              {!records && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
              {records && !records.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No records found</td></tr>}
              {(records || []).map(r => (
                <tr key={r._id}>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.subject}</td>
                  <td><span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.markedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
