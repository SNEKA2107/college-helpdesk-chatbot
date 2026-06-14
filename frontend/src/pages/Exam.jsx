import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../utils/format';

// Shown only when the admin has not entered any instructions for this exam.
const DEFAULT_INSTRUCTIONS = [
  'Carry your Hall Ticket and College ID Card to every exam. Entry denied without both.',
  'Reach the exam hall at least 30 minutes before the scheduled time.',
  'Mobile phones, smartwatches, and electronic devices are strictly prohibited in the exam hall.',
  'Only blue or black ball-point pens are allowed. Pencils only for diagrams.',
  'Follow all college examination regulations as per the student handbook.',
  'Any malpractice will result in immediate disqualification and disciplinary action.',
];

export default function Exam() {
  const showToast = useToast();
  const [exam, setExam] = useState(null);

  useEffect(() => {
    apiCall('/exam').then(res => { if (res.ok) setExam(res.data.exam); });
  }, []);

  const hallReady = exam && new Date() >= new Date(exam.hallTicketAvailable);

  // Instructions are admin-managed (exam.instructions); fall back to defaults only when empty.
  const instructions = (exam?.instructions?.length ? exam.instructions : DEFAULT_INSTRUCTIONS);
  const mid = Math.ceil(instructions.length / 2);
  const instructionCols = [instructions.slice(0, mid), instructions.slice(mid)];

  return (
    <Layout title="Exam Info">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Exam Information</h2>
          <p>Semester exam schedule, practical exams, and hall ticket</p>
        </div>
        <button className="btn btn-primary" onClick={() => (hallReady ? window.print() : showToast(`Hall ticket will be available from ${formatDate(exam?.hallTicketAvailable)}`, 'info'))}>
          ⬇ Download Hall Ticket
        </button>
      </div>

      {exam && (
        <div className="alert alert-warning mb-6">
          <span>⚠️</span>
          <div>
            <strong>Reminder:</strong> Semester Theory Examinations begin on{' '}
            <strong>{formatDate(exam.theoryStart)}</strong>. Ensure your fees are paid and hall ticket is downloaded.
          </div>
        </div>
      )}

      <div className="grid-3 mb-6">
        <div className="card" style={{ textAlign: 'center', borderTop: '3px solid var(--primary)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Exam Start Date</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--dark)' }}>{exam ? formatDate(exam.theoryStart) : '—'}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderTop: '3px solid var(--danger)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏁</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Exam End Date</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--dark)' }}>{exam ? formatDate(exam.theoryEnd) : '—'}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderTop: '3px solid var(--secondary)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎫</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Hall Ticket Status</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--secondary)' }}>
            {!exam ? '—' : hallReady ? 'Available ✅' : `Available ${formatDate(exam.hallTicketAvailable)}`}
          </div>
        </div>
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">📘 Theory Exam Schedule</div></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Subject</th><th>Session</th><th>Code</th></tr></thead>
              <tbody>
                {!exam && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
                {(exam?.schedule || []).map((s, i) => (
                  <tr key={i}><td>{formatDate(s.date)}</td><td>{s.subject}</td><td>{s.session}</td><td>{s.code}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">🖥 Practical Exam Schedule</div></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Subject</th><th>Lab</th></tr></thead>
              <tbody>
                {!exam && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
                {(exam?.practicals || []).map((p, i) => (
                  <tr key={i}><td>{formatDate(p.date)}</td><td>{p.subject}</td><td>{p.lab} ({p.time})</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="alert alert-info mt-4">
            <span>ℹ️</span>
            <div>Bring your student ID for all practical exams. Arrive 15 minutes early.</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📋 Important Instructions</div></div>
        <div className="grid-2">
          {instructionCols.map((col, ci) => (
            <div key={ci}>
              {col.map((text, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ color: 'var(--secondary)', fontSize: 18 }}>✔</span>
                  <p style={{ fontSize: 14 }}>{text}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
