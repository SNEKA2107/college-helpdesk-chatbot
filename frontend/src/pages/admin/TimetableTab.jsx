import { useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { DEPARTMENTS, SEMESTERS } from './shared';

const TT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_SLOTS = '9–10 AM, 10–11 AM, 11–12 PM, 12–1 PM, 1–2 PM, 2–3 PM, 3–4 PM';

export default function TimetableTab({ data, setData }) {
  const showToast = useToast();
  const [existingId, setExistingId] = useState('');
  const [dept, setDept] = useState('IT');
  const [sem, setSem] = useState('2nd');
  const [year, setYear] = useState('');
  const [slotsText, setSlotsText] = useState(DEFAULT_SLOTS);
  // grid = { slots: string[], cells: { [day]: string[] } } or null while hidden
  const [grid, setGrid] = useState(null);

  function buildGrid(prefill, slotsOverride) {
    const slots = (slotsOverride ?? slotsText).split(',').map(s => s.trim()).filter(Boolean);
    if (!slots.length) { showToast('Enter at least one period slot', 'error'); return; }
    const cells = {};
    TT_DAYS.forEach(day => {
      cells[day] = slots.map((_, i) => prefill?.[day]?.[i] || '');
    });
    setGrid({ slots, cells });
  }

  function onExistingChange(id) {
    setExistingId(id);
    if (!id) { setGrid(null); return; }
    const t = data.timetables.find(x => x._id === id);
    if (!t) return;
    setDept(t.department);
    setSem(t.semester);
    setYear(t.academicYear);
    const slotsValue = (t.slots || []).join(', ');
    setSlotsText(slotsValue);
    buildGrid(t.schedule || {}, slotsValue);
  }

  const setCell = (day, i, value) =>
    setGrid(g => ({ ...g, cells: { ...g.cells, [day]: g.cells[day].map((c, idx) => (idx === i ? value : c)) } }));

  async function saveTimetable() {
    const academicYear = year.trim();
    if (!academicYear) { showToast('Academic Year is required', 'error'); return; }
    const slots = slotsText.split(',').map(s => s.trim()).filter(Boolean);

    const schedule = { Sunday: [] };
    TT_DAYS.forEach(day => {
      schedule[day] = (grid?.cells[day] || []).map(v => v.trim() || '-');
    });

    const body = { department: dept, semester: sem, academicYear, slots, schedule };
    const res = existingId
      ? await apiCall(`/timetable/${existingId}`, { method: 'PUT', body: JSON.stringify(body) })
      : await apiCall('/timetable', { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      const saved = res.data.timetable;
      setData(d => {
        const idx = d.timetables.findIndex(t => t._id === saved._id);
        const timetables = idx >= 0
          ? d.timetables.map((t, i) => (i === idx ? saved : t))
          : [saved, ...d.timetables];
        return { ...d, timetables };
      });
      setExistingId(saved._id);
      showToast('Timetable saved — students can see it now', 'success');
    } else {
      showToast(res.error || 'Failed to save timetable', 'error');
    }
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Class Timetable</h2><p>Create or edit the weekly timetable per department &amp; semester</p></div>
      </div>

      <div className="card mb-6">
        <div className="card-header"><div className="card-title">🗓️ Timetable Setup</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14 }}>
          <div className="form-group"><label className="form-label">Edit Existing</label>
            <select className="form-select" style={{ paddingLeft: 14 }} value={existingId} onChange={e => onExistingChange(e.target.value)}>
              <option value="">➕ New timetable</option>
              {data.timetables.map(t => (
                <option key={t._id} value={t._id}>{t.department} · {t.semester} sem · {t.academicYear}</option>
              ))}
            </select></div>
          <div className="form-group"><label className="form-label">Department *</label>
            <select className="form-select" style={{ paddingLeft: 14 }} value={dept} onChange={e => setDept(e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Semester *</label>
            <select className="form-select" style={{ paddingLeft: 14 }} value={sem} onChange={e => setSem(e.target.value)}>
              {SEMESTERS.map(s => <option key={s}>{s}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Academic Year *</label>
            <input type="text" className="form-input" placeholder="e.g. 2025–2026" value={year} onChange={e => setYear(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Period Slots (comma separated)</label>
          <input type="text" className="form-input" value={slotsText} onChange={e => setSlotsText(e.target.value)} /></div>
        <button className="btn btn-secondary" onClick={() => buildGrid()}>Build / Reset Grid</button>
      </div>

      {grid && (
        <div className="card">
          <div className="card-header"><div className="card-title">Weekly Grid — {dept} · {sem} semester</div></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Day</th>{grid.slots.map(s => <th key={s}>{s}</th>)}</tr>
              </thead>
              <tbody>
                {TT_DAYS.map(day => (
                  <tr key={day}>
                    <td style={{ fontWeight: 600 }}>{day}</td>
                    {grid.slots.map((_, i) => (
                      <td key={i}>
                        <input
                          type="text" className="form-input" placeholder="-"
                          style={{ padding: '5px 7px', fontSize: 12, minWidth: 74 }}
                          value={grid.cells[day][i]}
                          onChange={e => setCell(day, i, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary btn-full" style={{ marginTop: 14 }} onClick={saveTimetable}>Save Timetable</button>
        </div>
      )}
    </div>
  );
}
