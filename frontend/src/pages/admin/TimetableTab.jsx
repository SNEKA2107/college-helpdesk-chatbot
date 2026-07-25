import { useEffect, useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { SEMESTERS } from './shared';
import { useDepartments } from '../../hooks/useDepartments';

const TT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_SLOTS = '9–10 AM, 10–11 AM, 11–12 PM, 12–1 PM, 1–2 PM, 2–3 PM, 3–4 PM';

export default function TimetableTab({ data, setData }) {
  // Departments come from the Department collection, not a hardcoded list (audit H-1).
  const { codes: DEPARTMENTS } = useDepartments({ academicOnly: true });
  const showToast = useToast();
  const [existingId, setExistingId] = useState('');
  // Empty until the department list arrives — 'IT' was hardcoded here, so a
  // college without an IT department started on a department that does not exist.
  const [dept, setDept] = useState('');
  const [sem, setSem] = useState('2nd');
  const [studyYear, setStudyYear] = useState('');   // cohort study-year (e.g. II) — optional
  const [section, setSection] = useState('');        // section (e.g. A) — optional
  const [year, setYear] = useState('');              // academic year (e.g. 2025–2026)
  const [slotsText, setSlotsText] = useState(DEFAULT_SLOTS);
  // grid = { slots: string[], cells: { [day]: string[] } } or null while hidden
  const [grid, setGrid] = useState(null);
  const [conflicts, setConflicts] = useState([]);

  // Select the first real department once the list has loaded.
  useEffect(() => {
    if (!dept && DEPARTMENTS.length) setDept(DEPARTMENTS[0]);
  }, [DEPARTMENTS, dept]);

  const current = data.timetables.find(t => t._id === existingId) || null;
  const STATUS_BADGE = { draft: 'badge-warning', published: 'badge-success', archived: 'badge-muted' };

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
    setStudyYear(t.year || '');
    setSection(t.section || '');
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

    const body = { department: dept, semester: sem, year: studyYear.trim(), section: section.trim(), academicYear, slots, schedule };
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
      setConflicts([]);
      showToast(existingId ? 'Timetable updated' : 'Draft saved — publish it to make it visible to students', 'success');
    } else {
      showToast(res.error || 'Failed to save timetable', 'error');
    }
  }

  function applySaved(saved) {
    setData(d => ({ ...d, timetables: d.timetables.map(t => (t._id === saved._id ? saved : t)) }));
  }

  async function publishTimetable() {
    if (!existingId) { showToast('Save the timetable first', 'error'); return; }
    setConflicts([]);
    const res = await apiCall(`/timetable/${existingId}/publish`, { method: 'PUT' });
    if (res.ok) {
      applySaved(res.data.timetable);
      showToast('Timetable published — visible to students now', 'success');
    } else if (res.data?.conflicts?.length) {
      setConflicts(res.data.conflicts);
      showToast('Cannot publish — conflicts detected', 'error');
    } else {
      showToast(res.error || 'Failed to publish', 'error');
    }
  }

  async function archiveTimetable() {
    if (!existingId) return;
    const res = await apiCall(`/timetable/${existingId}/archive`, { method: 'PUT' });
    if (res.ok) {
      applySaved(res.data.timetable);
      showToast('Timetable archived — hidden from students', 'success');
    } else {
      showToast(res.error || 'Failed to archive', 'error');
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
                <option key={t._id} value={t._id}>
                  [{t.status || 'published'}] {t.department} · {t.semester} sem{t.year ? ` · ${t.year} yr` : ''}{t.section ? ` · Sec ${t.section}` : ''} · {t.academicYear}
                </option>
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
          <div className="form-group"><label className="form-label">Year</label>
            <input type="text" className="form-input" placeholder="e.g. II (optional)" value={studyYear} onChange={e => setStudyYear(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Section</label>
            <input type="text" className="form-input" placeholder="e.g. A — blank = all" value={section} onChange={e => setSection(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Academic Year *</label>
            <input type="text" className="form-input" placeholder="e.g. 2025–2026" value={year} onChange={e => setYear(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Period Slots (comma separated)</label>
          <input type="text" className="form-input" value={slotsText} onChange={e => setSlotsText(e.target.value)} /></div>
        <button className="btn btn-secondary" onClick={() => buildGrid()}>Build / Reset Grid</button>

        {current && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Status:</span>
            <span className={`badge ${STATUS_BADGE[current.status] || 'badge-muted'}`}>{current.status || 'published'}</span>
            {current.status !== 'published' && (
              <button className="btn btn-sm" style={{ background: 'var(--secondary)', color: '#fff', padding: '4px 12px' }} onClick={publishTimetable}>📢 Publish</button>
            )}
            {current.status !== 'archived' && (
              <button className="btn btn-sm btn-outline" style={{ padding: '4px 12px' }} onClick={archiveTimetable}>🗄 Archive</button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {current.status === 'published' ? 'Visible to students in this cohort.' : current.status === 'draft' ? 'Draft — not visible to students yet.' : 'Archived — hidden from students.'}
            </span>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="alert alert-danger" style={{ marginTop: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <strong>⚠️ Cannot publish — {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}:</strong>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {conflicts.map((c, i) => <li key={i}>{c.message}</li>)}
            </ul>
          </div>
        )}
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
