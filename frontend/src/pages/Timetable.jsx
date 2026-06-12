import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import '../styles/timetable.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SUB_CLASS = {
  Java: 'sub-java', DBMS: 'sub-dbms', CN: 'sub-cn', AI: 'sub-ai', Python: 'sub-py',
  Maths: 'sub-math', Lab: 'sub-lab', Project: 'sub-project', Seminar: 'sub-seminar', Lunch: 'sub-break',
};

const WEEK_GRID = [
  ['Monday',    ['Java', 'DBMS', 'CN', 'Lunch', 'AI', 'Lab', 'Lab']],
  ['Tuesday',   ['Python', 'Java', 'Maths', 'Lunch', 'AI', 'Lab', 'Lab']],
  ['Wednesday', ['DBMS', 'CN', 'Java', 'Lunch', 'Python', 'Seminar', 'Seminar']],
  ['Thursday',  ['Maths', 'AI', 'DBMS', 'Lunch', 'CN', 'Lab', 'Lab']],
  ['Friday',    ['Java', 'Python', 'Maths', 'Lunch', 'DBMS', 'Project', 'Project']],
];
const SLOT_HEADERS = ['9–10 AM', '10–11 AM', '11–12 PM', '12–1 PM', '1–2 PM', '2–3 PM', '3–4 PM'];

export default function Timetable() {
  const [todayClasses, setTodayClasses] = useState(null);
  const today = new Date().getDay();
  const isWeekend = today === 0 || today === 6;
  const todayLabel = `${DAYS[today]}, ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  useEffect(() => {
    if (isWeekend) return;
    apiCall('/timetable').then(res => {
      if (!res.ok) { setTodayClasses('error'); return; }
      const { timetable } = res.data;
      const subjects = timetable.schedule[DAYS[today]] || [];
      const details = timetable.subjectDetails || {};
      const slots = timetable.slots || [];
      setTodayClasses(subjects
        .map((s, i) => (s !== 'Lunch' && s !== '-')
          ? { slot: slots[i], name: details[s] ? details[s].name : s, room: details[s] ? details[s].room : '' }
          : null)
        .filter(Boolean));
    });
  }, [isWeekend, today]);

  return (
    <Layout title="Timetable">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Weekly Class Timetable</h2>
          <p>Academic Year 2025–2026 · Semester V · IT Department</p>
        </div>
        <button className="btn btn-outline" onClick={() => window.print()}>🖨 Print Timetable</button>
      </div>

      <div className="alert alert-info mb-6">
        <span>📅</span>
        <div>Today is <strong>{todayLabel}</strong>. Your highlighted row shows today's classes.</div>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <div className="card-title">📅 Weekly Schedule</div>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <span className="legend-item"><span className="legend-dot" style={{ background: 'rgba(78,133,191,0.25)' }}></span> Theory</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: 'rgba(239,68,68,0.2)' }}></span> Lab</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: 'rgba(251,146,60,0.2)' }}></span> Seminar</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="tt-table">
            <thead>
              <tr><th>Day</th>{SLOT_HEADERS.map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {WEEK_GRID.map(([day, subjects]) => (
                <tr key={day} className={DAYS[today] === day ? 'today-highlight' : undefined}>
                  <td>{day}</td>
                  {subjects.map((sub, i) => (
                    <td key={i}><span className={`tt-sub ${SUB_CLASS[sub] || 'sub-java'}`}>{sub}</span></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">📋 Today's Classes — {DAYS[today]}</div>
        </div>
        <div>
          {isWeekend && (
            <div className="empty-state">
              <div className="empty-icon">🎉</div>
              <h3>No Classes Today!</h3>
              <p>It's the weekend. Enjoy your break!</p>
            </div>
          )}
          {!isWeekend && todayClasses === 'error' && <p style={{ color: 'var(--text-muted)', padding: 16 }}>Could not load schedule.</p>}
          {!isWeekend && Array.isArray(todayClasses) && todayClasses.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, borderRadius: 8, background: 'var(--bg2)', marginBottom: 8 }}>
              <div style={{ background: 'rgba(78,133,191,0.12)', color: '#89AACC', padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{c.slot}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {c.room}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
