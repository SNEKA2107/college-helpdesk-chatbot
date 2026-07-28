import { useEffect, useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { SEMESTERS } from './shared';
import { useDepartments } from '../../hooks/useDepartments';

const TT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_SLOTS = '9–10 AM, 10–11 AM, 11–12 PM, 12–1 PM, 1–2 PM, 2–3 PM, 3–4 PM';

// Grid cells that are not a real class — kept in step with the same list in
// backend/utils/timetableConflicts.js so the editor and the conflict detector
// agree on what counts as a scheduled period.
const IGNORE_CELLS = ['', '-', 'Lunch', 'Break'];

const EMPTY_DETAIL = { name: '', code: '', faculty: '', room: '' };

/** Distinct real subject labels used anywhere in the grid, in first-seen order. */
function subjectKeysOf(grid) {
  if (!grid) return [];
  const seen = [];
  TT_DAYS.forEach(day => (grid.cells[day] || []).forEach(cell => {
    const key = (cell || '').trim();
    if (!IGNORE_CELLS.includes(key) && !seen.includes(key)) seen.push(key);
  }));
  return seen;
}

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
  // subjectDetails = { [cellLabel]: { name, code, faculty, room } }. The student and
  // faculty timetable pages read the faculty name and room from here, and the
  // backend's publish-time conflict detector resolves faculty/room clashes from it —
  // this editor previously never sent it, so both were silently inert.
  const [details, setDetails] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [conflictsChecked, setConflictsChecked] = useState(false);

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
    setConflicts([]); setConflictsChecked(false);
    if (!id) { setGrid(null); setDetails({}); return; }
    const t = data.timetables.find(x => x._id === id);
    if (!t) return;
    // Carry the stored subject details into the editor so an edit never drops them.
    setDetails(t.subjectDetails || {});
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

  const subjectKeys = subjectKeysOf(grid);

  const setDetail = (key, field, value) =>
    setDetails(d => ({ ...d, [key]: { ...EMPTY_DETAIL, ...(d[key] || {}), [field]: value } }));

  /** subjectDetails for exactly the labels currently in the grid (stale keys dropped). */
  function buildSubjectDetails() {
    const out = {};
    subjectKeys.forEach(key => {
      const d = details[key] || {};
      out[key] = {
        name: (d.name || '').trim() || key,   // fall back to the label itself
        code: (d.code || '').trim(),
        faculty: (d.faculty || '').trim(),
        room: (d.room || '').trim(),
      };
    });
    return out;
  }

  async function saveTimetable() {
    const academicYear = year.trim();
    if (!academicYear) { showToast('Academic Year is required', 'error'); return; }
    const slots = slotsText.split(',').map(s => s.trim()).filter(Boolean);

    const schedule = { Sunday: [] };
    TT_DAYS.forEach(day => {
      schedule[day] = (grid?.cells[day] || []).map(v => v.trim() || '-');
    });

    const body = {
      department: dept, semester: sem, year: studyYear.trim(), section: section.trim(),
      academicYear, slots, schedule,
      subjectDetails: buildSubjectDetails(),
    };
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
      setDetails(saved.subjectDetails || {});
      setConflicts([]); setConflictsChecked(false);
      showToast(existingId ? 'Timetable updated' : 'Draft saved — publish it to make it visible to students', 'success');
    } else {
      showToast(res.error || 'Failed to save timetable', 'error');
    }
  }

  function applySaved(saved) {
    setData(d => ({ ...d, timetables: d.timetables.map(t => (t._id === saved._id ? saved : t)) }));
  }

  /**
   * Pre-publish conflict preview (GET /timetable/:id/conflicts). Lets an admin see
   * faculty/room/slot clashes before attempting to publish, instead of only
   * discovering them from a rejected publish.
   */
  async function checkConflicts() {
    if (!existingId) { showToast('Save the timetable first', 'error'); return; }
    const res = await apiCall(`/timetable/${existingId}/conflicts`);
    if (res.ok) {
      setConflicts(res.data.conflicts || []);
      setConflictsChecked(true);
      showToast(res.data.conflicts?.length
        ? `${res.data.conflicts.length} conflict(s) found`
        : 'No conflicts — safe to publish', res.data.conflicts?.length ? 'warning' : 'success');
    } else {
      showToast(res.error || 'Failed to check conflicts', 'error');
    }
  }

  async function publishTimetable() {
    if (!existingId) { showToast('Save the timetable first', 'error'); return; }
    setConflicts([]); setConflictsChecked(false);
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
            <button className="btn btn-sm btn-outline" style={{ padding: '4px 12px' }} onClick={checkConflicts}>🔎 Check Conflicts</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {current.status === 'published' ? 'Visible to students in this cohort.' : current.status === 'draft' ? 'Draft — not visible to students yet.' : 'Archived — hidden from students.'}
            </span>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="alert alert-danger" style={{ marginTop: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <strong>⚠️ {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} — publishing is blocked:</strong>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {conflicts.map((c, i) => <li key={i}>{c.message}</li>)}
            </ul>
          </div>
        )}
        {conflictsChecked && conflicts.length === 0 && (
          <div className="alert alert-success" style={{ marginTop: 14 }}>
            <span>✅</span><div>No conflicts detected — this timetable is safe to publish.</div>
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
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            Type a short label per period (e.g. <code>DBMS</code>). Use <code>-</code> for a free period
            and <code>Lunch</code> for the break. Add each label's faculty &amp; room below.
          </p>
        </div>
      )}

      {grid && subjectKeys.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <div className="card-title">👨‍🏫 Subject Details</div>
            <span className="badge badge-primary">{subjectKeys.length}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -6, marginBottom: 12 }}>
            Students and faculty see the full name and room here instead of the short label.
            Faculty and room are also what the system uses to detect double-bookings before publishing.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Label</th><th>Full Name</th><th>Code</th><th>Faculty</th><th>Room</th></tr>
              </thead>
              <tbody>
                {subjectKeys.map(key => (
                  <tr key={key}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{key}</td>
                    {['name', 'code', 'faculty', 'room'].map(field => (
                      <td key={field}>
                        <input
                          type="text" className="form-input"
                          style={{ padding: '5px 7px', fontSize: 12, minWidth: 110 }}
                          placeholder={field === 'name' ? key
                            : field === 'code' ? 'e.g. 21CS302'
                              : field === 'faculty' ? 'e.g. Dr. Meera' : 'e.g. Room 204'}
                          value={(details[key] || {})[field] || ''}
                          onChange={e => setDetail(key, field, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {grid && (
        <button className="btn btn-primary btn-full" style={{ marginTop: 14 }} onClick={saveTimetable}>Save Timetable</button>
      )}
    </div>
  );
}
