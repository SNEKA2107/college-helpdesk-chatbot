import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import '../styles/timetable.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SUB_CLASS = {
  Java: 'sub-java', DBMS: 'sub-dbms', CN: 'sub-cn', AI: 'sub-ai', Python: 'sub-py',
  Maths: 'sub-math', Lab: 'sub-lab', Project: 'sub-project', Seminar: 'sub-seminar', Lunch: 'sub-break',
};

export default function Timetable() {
  const [timetable, setTimetable] = useState(null);   // null = loading, false = none/error
  const today = new Date().getDay();
  const isWeekend = today === 0 || today === 6;
  const todayLabel = `${DAYS[today]}, ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  useEffect(() => {
    // CRIT additional-req: the weekly grid is now MongoDB-driven (was hardcoded).
    apiCall('/timetable').then(res => setTimetable(res.ok ? res.data.timetable : false));
  }, []);

  const slots = timetable?.slots || [];
  const schedule = timetable?.schedule || {};
  const details = timetable?.subjectDetails || {};
  const days = WEEKDAYS.filter(d => Array.isArray(schedule[d]) && schedule[d].length);

  // Today's classes derived from the same fetched timetable (no second request).
  const todayClasses = (!isWeekend && Array.isArray(schedule[DAYS[today]]))
    ? schedule[DAYS[today]]
        .map((s, i) => (s !== 'Lunch' && s !== '-')
          ? { slot: slots[i], name: details[s]?.name || s, room: details[s]?.room || '' }
          : null)
        .filter(Boolean)
    : [];

  const subtitle = timetable
    ? `Academic Year ${timetable.academicYear} · Semester ${timetable.semester} · ${timetable.department} Department`
    : 'Your weekly class schedule';

  return (
    <Layout title="Timetable">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Weekly Class Timetable</h2>
          <p>{subtitle}</p>
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
        {timetable === null && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading…</div>}
        {timetable === false && <p style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No timetable has been published yet.</p>}
        {timetable && (
          <div className="table-wrap">
            <table className="tt-table">
              <thead>
                <tr><th>Day</th>{slots.map((h, i) => <th key={i}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {days.map(day => (
                  <tr key={day} className={DAYS[today] === day ? 'today-highlight' : undefined}>
                    <td>{day}</td>
                    {schedule[day].map((sub, i) => (
                      <td key={i}><span className={`tt-sub ${SUB_CLASS[sub] || 'sub-java'}`}>{sub}</span></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
          {!isWeekend && timetable === false && <p style={{ color: 'var(--text-muted)', padding: 16 }}>Could not load schedule.</p>}
          {!isWeekend && timetable && !todayClasses.length && <p style={{ color: 'var(--text-muted)', padding: 16 }}>No classes scheduled for today.</p>}
          {!isWeekend && todayClasses.map((c, i) => (
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
