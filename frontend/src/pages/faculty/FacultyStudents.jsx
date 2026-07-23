import { useEffect, useMemo, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import Modal from '../../components/Modal';
import { apiCall } from '../../services/api';
import { formatDate } from '../../utils/format';
import '../../styles/faculty.css';

const statusBadge = s => (s === 'Present' ? 'badge-success' : s === 'Absent' ? 'badge-danger' : 'badge-warning');

export default function FacultyStudents() {
  const [students, setStudents] = useState(null);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);   // studentId being viewed
  const [detail, setDetail] = useState(null);   // { student, attendance, marks }
  const [detailErr, setDetailErr] = useState('');

  useEffect(() => {
    apiCall('/faculty-portal/students').then(res => { if (res.ok) setStudents(res.data.students); });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (students || []).filter(x =>
      !s || x.name.toLowerCase().includes(s) || (x.studentId || '').toLowerCase().includes(s));
  }, [students, q]);

  function openProfile(sid) {
    setOpenId(sid); setDetail(null); setDetailErr('');
    apiCall(`/faculty-portal/students/${encodeURIComponent(sid)}`).then(res => {
      if (res.ok) setDetail(res.data);
      else setDetailErr(res.error || 'Could not load student profile.');
    });
  }
  const closeProfile = () => { setOpenId(null); setDetail(null); setDetailErr(''); };

  // Attendance summary for the modal (from the student's records).
  const attSummary = useMemo(() => {
    const recs = detail?.attendance || [];
    const total = recs.length;
    const present = recs.filter(r => r.status !== 'Absent').length;
    return { total, present, absent: total - present, pct: total ? Math.round((present / total) * 100) : 0 };
  }, [detail]);

  return (
    <FacultyShell title="Students">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Students</h2>
          <p>Students in your assigned classes — click a row to view attendance & marks history</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">👥 My Students</div>
          <span className="badge badge-primary">{students ? students.length : '…'}</span>
        </div>
        <input className="fac-search" placeholder="🔍 Search by name or ID…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="table">
            <thead><tr><th>Student ID</th><th>Name</th><th>Department</th><th>Semester</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {!students && <tr><td colSpan={6} className="fac-center">Loading…</td></tr>}
              {students && !filtered.length && <tr><td colSpan={6} className="fac-center">No students found.</td></tr>}
              {filtered.map(s => (
                <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => openProfile(s.studentId)}>
                  <td style={{ fontWeight: 600 }}>{s.studentId}</td>
                  <td>{s.name}</td>
                  <td>{s.department}</td>
                  <td>{s.semester || '—'}</td>
                  <td className="fac-muted" style={{ fontSize: 12 }}>{s.email}</td>
                  <td><button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); openProfile(s.studentId); }}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!openId} onClose={closeProfile} title={detail ? detail.student.name : 'Student Profile'} subtitle={detail ? `${detail.student.studentId} · ${detail.student.department} · Sem ${detail.student.semester || '—'}` : openId} maxWidth={720}>
        {!detail && !detailErr && <p className="fac-center">Loading profile…</p>}
        {detailErr && <p className="fac-center" style={{ color: 'var(--danger)' }}>{detailErr}</p>}
        {detail && (
          <div>
            <div className="stats-grid" style={{ marginBottom: 18 }}>
              <div className="stat-card"><div className="stat-icon si-blue">📊</div><div className="stat-info"><h3>{attSummary.pct}%</h3><p>Attendance</p></div></div>
              <div className="stat-card"><div className="stat-icon si-green">✅</div><div className="stat-info"><h3>{attSummary.present}</h3><p>Present</p></div></div>
              <div className="stat-card"><div className="stat-icon si-orange">❌</div><div className="stat-info"><h3>{attSummary.absent}</h3><p>Absent</p></div></div>
              <div className="stat-card"><div className="stat-icon si-purple">📝</div><div className="stat-info"><h3>{detail.marks.length}</h3><p>Marks Records</p></div></div>
            </div>

            <div className="card-header"><div className="card-title">📝 Marks History</div></div>
            <div className="table-wrap" style={{ marginBottom: 18 }}>
              <table className="table">
                <thead><tr><th>Sem</th><th>Subject</th><th>Int</th><th>Ext</th><th>Total</th><th>Grade</th><th>Status</th></tr></thead>
                <tbody>
                  {!detail.marks.length && <tr><td colSpan={7} className="fac-center">No marks recorded.</td></tr>}
                  {detail.marks.map(m => (
                    <tr key={m._id}>
                      <td>{m.semester}</td><td>{m.subject}</td><td>{m.internalMarks}</td><td>{m.externalMarks}</td>
                      <td style={{ fontWeight: 600 }}>{m.total}</td><td><span className="badge badge-primary">{m.grade}</span></td>
                      <td>{m.published === false ? <span className="badge badge-warning">Unpublished</span> : <span className="badge badge-success">Published</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-header"><div className="card-title">✅ Attendance History (recent)</div></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Subject</th><th>Status</th></tr></thead>
                <tbody>
                  {!detail.attendance.length && <tr><td colSpan={3} className="fac-center">No attendance records.</td></tr>}
                  {detail.attendance.slice(0, 30).map(r => (
                    <tr key={r._id}>
                      <td className="fac-muted">{formatDate(r.date)}</td>
                      <td>{r.subject}</td>
                      <td><span className={`badge ${statusBadge(r.status)}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </FacultyShell>
  );
}
