import { useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { DEPARTMENTS, SEMESTERS } from './shared';

const rowInputStyle = { padding: '6px 8px', fontSize: 12.5 };
const SCHED_COLS = '130px 1fr 90px 110px 30px';
const PRAC_COLS = '130px 1fr 80px 90px 30px';
const STATUS_BADGE = { draft: 'badge-warning', published: 'badge-success', archived: 'badge-muted' };

const emptySched = () => ({ date: '', subject: '', code: '', session: '' });
const emptyPrac = () => ({ date: '', subject: '', lab: '', time: '' });
const blankForm = { department: '', year: '', section: '', semester: '', academicYear: '', theoryStart: '', theoryEnd: '', hallTicketAvailable: '' };

export default function ExamsTab({ data, setData }) {
  const showToast = useToast();
  const exams = data.exams || [];
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({ ...blankForm });
  const [schedule, setSchedule] = useState([emptySched()]);
  const [practicals, setPracticals] = useState([emptyPrac()]);
  const [instructions, setInstructions] = useState('');

  const current = exams.find(e => e._id === selectedId) || null;

  function loadExam(id) {
    setSelectedId(id);
    const ex = exams.find(e => e._id === id);
    if (!ex) {
      setForm({ ...blankForm });
      setSchedule([emptySched()]); setPracticals([emptyPrac()]); setInstructions('');
      return;
    }
    setForm({
      department: ex.department || '', year: ex.year || '', section: ex.section || '',
      semester: ex.semester || '', academicYear: ex.academicYear || '',
      theoryStart: ex.theoryStart || '', theoryEnd: ex.theoryEnd || '', hallTicketAvailable: ex.hallTicketAvailable || '',
    });
    setSchedule(ex.schedule?.length ? ex.schedule.map(s => ({ ...s })) : [emptySched()]);
    setPracticals(ex.practicals?.length ? ex.practicals.map(p => ({ ...p })) : [emptyPrac()]);
    setInstructions((ex.instructions || []).join('\n'));
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setRow = (setter) => (i, k, v) => setter(rows => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const removeRow = (setter) => (i) => setter(rows => rows.filter((_, idx) => idx !== i));
  const setSchedRow = setRow(setSchedule);
  const setPracRow = setRow(setPracticals);

  function upsertExam(saved, select = true) {
    setData(d => {
      const list = d.exams || [];
      const idx = list.findIndex(e => e._id === saved._id);
      const exams = idx >= 0 ? list.map((e, i) => (i === idx ? saved : e)) : [saved, ...list];
      return { ...d, exams };
    });
    if (select) setSelectedId(saved._id);
  }

  async function saveExam() {
    const semester = form.semester.trim();
    const academicYear = form.academicYear.trim();
    if (!semester || !academicYear) { showToast('Semester and Academic Year are required', 'error'); return; }

    const sched = [];
    for (const r of schedule) {
      const s = { date: r.date, subject: r.subject.trim(), code: r.code.trim(), session: r.session.trim() };
      if (!s.date && !s.subject && !s.code && !s.session) continue;
      if (!s.date || !s.subject || !s.code || !s.session) { showToast('Each theory row needs date, subject, code and session', 'error'); return; }
      sched.push(s);
    }
    const pracs = [];
    for (const r of practicals) {
      const p = { date: r.date, subject: r.subject.trim(), lab: r.lab.trim(), time: r.time.trim() };
      if (!p.date && !p.subject && !p.lab && !p.time) continue;
      if (!p.date || !p.subject || !p.lab || !p.time) { showToast('Each practical row needs date, subject, lab and time', 'error'); return; }
      pracs.push(p);
    }

    const body = {
      department: form.department.trim(), year: form.year.trim(), section: form.section.trim(),
      semester, academicYear,
      theoryStart: form.theoryStart, theoryEnd: form.theoryEnd, hallTicketAvailable: form.hallTicketAvailable,
      schedule: sched, practicals: pracs,
      instructions: instructions.split('\n').map(l => l.trim()).filter(Boolean),
    };
    const res = selectedId
      ? await apiCall(`/exam/${selectedId}`, { method: 'PUT', body: JSON.stringify(body) })
      : await apiCall('/exam', { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      upsertExam(res.data.exam);
      showToast(selectedId ? 'Exam schedule updated' : 'Draft saved — publish it to make it visible', 'success');
    } else {
      showToast(res.error || 'Failed to save exam schedule', 'error');
    }
  }

  async function publishExam() {
    if (!selectedId) { showToast('Save the schedule first', 'error'); return; }
    const res = await apiCall(`/exam/${selectedId}/publish`, { method: 'PUT' });
    if (res.ok) { upsertExam(res.data.exam); showToast('Exam schedule published', 'success'); }
    else showToast(res.error || 'Failed to publish', 'error');
  }
  async function archiveExam() {
    if (!selectedId) return;
    const res = await apiCall(`/exam/${selectedId}/archive`, { method: 'PUT' });
    if (res.ok) { upsertExam(res.data.exam); showToast('Exam schedule archived', 'success'); }
    else showToast(res.error || 'Failed to archive', 'error');
  }

  const cohortLabel = (e) =>
    `[${e.status || 'published'}] ${e.department || 'All depts'} · ${e.semester} sem${e.year ? ` · ${e.year} yr` : ''}${e.section ? ` · Sec ${e.section}` : ''} · ${e.academicYear}`;

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Exam Information</h2><p>Create per-cohort exam schedules; publish to make them visible to that cohort</p></div>
        <span className="badge badge-primary">{selectedId ? 'Editing' : 'New schedule'}</span>
      </div>

      <div className="card mb-6">
        <div className="card-header"><div className="card-title">📑 Exam Details</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14 }}>
          <div className="form-group"><label className="form-label">Edit Existing</label>
            <select className="form-select" style={{ paddingLeft: 14 }} value={selectedId} onChange={e => loadExam(e.target.value)}>
              <option value="">➕ New schedule</option>
              {exams.map(e => <option key={e._id} value={e._id}>{cohortLabel(e)}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Department</label>
            <select className="form-select" style={{ paddingLeft: 14 }} value={form.department} onChange={e => setField('department', e.target.value)}>
              <option value="">All departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Year</label>
            <input type="text" className="form-input" placeholder="e.g. III (optional)" value={form.year} onChange={e => setField('year', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Section</label>
            <input type="text" className="form-input" placeholder="blank = all" value={form.section} onChange={e => setField('section', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Semester *</label>
            <input type="text" className="form-input" placeholder="e.g. V" value={form.semester} onChange={e => setField('semester', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Academic Year *</label>
            <input type="text" className="form-input" placeholder="e.g. 2025–2026" value={form.academicYear} onChange={e => setField('academicYear', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Theory Start</label>
            <input type="date" className="form-input" value={form.theoryStart} onChange={e => setField('theoryStart', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Theory End</label>
            <input type="date" className="form-input" value={form.theoryEnd} onChange={e => setField('theoryEnd', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Hall Ticket From</label>
            <input type="date" className="form-input" value={form.hallTicketAvailable} onChange={e => setField('hallTicketAvailable', e.target.value)} /></div>
        </div>

        {current && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Status:</span>
            <span className={`badge ${STATUS_BADGE[current.status] || 'badge-muted'}`}>{current.status || 'published'}</span>
            {current.status !== 'published' && (
              <button className="btn btn-sm" style={{ background: 'var(--secondary)', color: '#fff', padding: '4px 12px' }} onClick={publishExam}>📢 Publish</button>
            )}
            {current.status !== 'archived' && (
              <button className="btn btn-sm btn-outline" style={{ padding: '4px 12px' }} onClick={archiveExam}>🗄 Archive</button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {current.status === 'published' ? 'Visible to this cohort.' : current.status === 'draft' ? 'Draft — not visible to students yet.' : 'Archived — hidden from students.'}
            </span>
          </div>
        )}
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header">
            <div className="card-title">📚 Theory Schedule</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setSchedule(r => [...r, emptySched()])}>+ Add Row</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: SCHED_COLS, gap: 6, fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6 }}>
            <span>DATE</span><span>SUBJECT</span><span>CODE</span><span>SESSION</span><span></span>
          </div>
          <div>
            {schedule.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: SCHED_COLS, gap: 6, marginBottom: 6 }}>
                <input type="date" className="form-input" style={rowInputStyle} value={r.date} onChange={e => setSchedRow(i, 'date', e.target.value)} />
                <input type="text" className="form-input" style={rowInputStyle} placeholder="Subject" value={r.subject} onChange={e => setSchedRow(i, 'subject', e.target.value)} />
                <input type="text" className="form-input" style={rowInputStyle} placeholder="Code" value={r.code} onChange={e => setSchedRow(i, 'code', e.target.value)} />
                <input type="text" className="form-input" style={rowInputStyle} placeholder="Session" value={r.session} onChange={e => setSchedRow(i, 'session', e.target.value)} />
                <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', padding: 0 }} onClick={() => removeRow(setSchedule)(i)}>✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">🧪 Practical Exams</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setPracticals(r => [...r, emptyPrac()])}>+ Add Row</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: PRAC_COLS, gap: 6, fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6 }}>
            <span>DATE</span><span>SUBJECT</span><span>LAB</span><span>TIME</span><span></span>
          </div>
          <div>
            {practicals.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: PRAC_COLS, gap: 6, marginBottom: 6 }}>
                <input type="date" className="form-input" style={rowInputStyle} value={r.date} onChange={e => setPracRow(i, 'date', e.target.value)} />
                <input type="text" className="form-input" style={rowInputStyle} placeholder="Subject" value={r.subject} onChange={e => setPracRow(i, 'subject', e.target.value)} />
                <input type="text" className="form-input" style={rowInputStyle} placeholder="Lab" value={r.lab} onChange={e => setPracRow(i, 'lab', e.target.value)} />
                <input type="text" className="form-input" style={rowInputStyle} placeholder="Time" value={r.time} onChange={e => setPracRow(i, 'time', e.target.value)} />
                <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', padding: 0 }} onClick={() => removeRow(setPracticals)(i)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📋 Instructions (one per line)</div></div>
        <textarea
          className="form-textarea" style={{ minHeight: 110 }}
          placeholder={'Carry your Hall Ticket and College ID Card to every exam.\nReach the exam hall 30 minutes early.'}
          value={instructions} onChange={e => setInstructions(e.target.value)}
        />
        <button className="btn btn-primary btn-full" style={{ marginTop: 14 }} onClick={saveExam}>
          {selectedId ? 'Save Changes' : 'Save Draft'}
        </button>
      </div>
    </div>
  );
}
