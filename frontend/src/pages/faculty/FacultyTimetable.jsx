import { useEffect, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import '../../styles/timetable.css';
import '../../styles/faculty.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SUB_CLASS = { Lab: 'sub-lab', Project: 'sub-project', Seminar: 'sub-seminar', Lunch: 'sub-break' };

export default function FacultyTimetable() {
  const [timetables, setTimetables] = useState(null);
  const today = new Date().getDay();

  useEffect(() => {
    apiCall('/faculty-portal/timetable').then(res => { if (res.ok) setTimetables(res.data.timetables || []); });
  }, []);

  // Today's classes across all assigned timetables.
  const todayClasses = [];
  (timetables || []).forEach(tt => {
    const row = tt.schedule?.[DAYS[today]];
    const details = tt.subjectDetails || {};
    if (Array.isArray(row)) {
      row.forEach((sub, i) => {
        if (sub && sub !== 'Lunch' && sub !== '-') {
          todayClasses.push({ slot: (tt.slots || [])[i], name: details[sub]?.name || sub, room: details[sub]?.room || '', cohort: `${tt.department} · Sem ${tt.semester}` });
        }
      });
    }
  });

  return (
    <FacultyShell title="Timetable">
      <div className="page-header">
        <div className="page-header-text"><h2>My Timetable</h2><p>Weekly schedule for your assigned classes</p></div>
      </div>

      <div className="card mb-6">
        <div className="card-header"><div className="card-title">📋 Today's Classes — {DAYS[today]}</div></div>
        {!timetables && <p className="fac-muted">Loading…</p>}
        {timetables && !todayClasses.length && <p className="fac-muted">No classes scheduled for today.</p>}
        {todayClasses.map((c, i) => (
          <div key={i} className="fac-today-row">
            <div className="fac-today-slot">{c.slot}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
              <div className="fac-muted" style={{ fontSize: 12 }}>📍 {c.room || 'TBA'} · {c.cohort}</div>
            </div>
          </div>
        ))}
      </div>

      {(timetables || []).map(tt => {
        const slots = tt.slots || [];
        const schedule = tt.schedule || {};
        const days = WEEKDAYS.filter(d => Array.isArray(schedule[d]) && schedule[d].length);
        return (
          <div key={tt._id} className="card mb-6">
            <div className="card-header"><div className="card-title">📅 {tt.department} · Semester {tt.semester}{tt.section ? ` · Sec ${tt.section}` : ''}</div></div>
            <div className="table-wrap">
              <table className="tt-table">
                <thead><tr><th>Day</th>{slots.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
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
          </div>
        );
      })}
      {timetables && !timetables.length && (
        <div className="card"><p className="fac-muted" style={{ textAlign: 'center', padding: 24 }}>No timetable has been published for your classes yet.</p></div>
      )}
    </FacultyShell>
  );
}
