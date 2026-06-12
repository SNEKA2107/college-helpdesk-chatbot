import { useEffect, useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';

const rowInputStyle = { padding: '6px 8px', fontSize: 12.5 };
const SCHED_COLS = '130px 1fr 90px 110px 30px';
const PRAC_COLS = '130px 1fr 80px 90px 30px';

const emptySched = () => ({ date: '', subject: '', code: '', session: '' });
const emptyPrac = () => ({ date: '', subject: '', lab: '', time: '' });

export default function ExamsTab({ data, setData }) {
  const showToast = useToast();
  const exam = data.exam;
  const [form, setForm] = useState({ semester: '', academicYear: '', theoryStart: '', theoryEnd: '', hallTicketAvailable: '' });
  const [schedule, setSchedule] = useState([emptySched()]);
  const [practicals, setPracticals] = useState([emptyPrac()]);
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    setForm({
      semester: exam?.semester || '',
      academicYear: exam?.academicYear || '',
      theoryStart: exam?.theoryStart || '',
      theoryEnd: exam?.theoryEnd || '',
      hallTicketAvailable: exam?.hallTicketAvailable || '',
    });
    setSchedule(exam?.schedule?.length ? exam.schedule.map(s => ({ ...s })) : [emptySched()]);
    setPracticals(exam?.practicals?.length ? exam.practicals.map(p => ({ ...p })) : [emptyPrac()]);
    setInstructions((exam?.instructions || []).join('\n'));
  }, [exam]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setRow = (setter) => (i, k, v) => setter(rows => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const removeRow = (setter) => (i) => setter(rows => rows.filter((_, idx) => idx !== i));
  const setSchedRow = setRow(setSchedule);
  const setPracRow = setRow(setPracticals);

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
      semester, academicYear,
      theoryStart: form.theoryStart,
      theoryEnd: form.theoryEnd,
      hallTicketAvailable: form.hallTicketAvailable,
      schedule: sched,
      practicals: pracs,
      instructions: instructions.split('\n').map(l => l.trim()).filter(Boolean),
    };
    const res = exam?._id
      ? await apiCall(`/exam/${exam._id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await apiCall('/exam', { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      setData(d => ({ ...d, exam: res.data.exam }));
      showToast('Exam schedule published — students can see it now', 'success');
    } else {
      showToast(res.error || 'Failed to save exam schedule', 'error');
    }
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Exam Information</h2><p>Publish the exam schedule students see on the Exam Info page</p></div>
        <span className="badge badge-primary">{exam ? 'Editing published schedule' : 'New schedule'}</span>
      </div>

      <div className="card mb-6">
        <div className="card-header"><div className="card-title">📑 Exam Details</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14 }}>
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
        <button className="btn btn-primary btn-full" style={{ marginTop: 14 }} onClick={saveExam}>Save &amp; Publish Exam Schedule</button>
      </div>
    </div>
  );
}
