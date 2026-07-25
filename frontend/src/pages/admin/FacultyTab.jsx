import { useEffect, useState, useCallback } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { useDepartments } from '../../hooks/useDepartments';
import '../../styles/knowledge.css';

/**
 * Faculty directory + account provisioning + class assignment.
 *
 * Audit findings C-2 and C-3: creating a faculty member here used to write only
 * a directory row, so they could never log in; and nothing anywhere could write
 * assignedSubjects, so even a hand-made faculty account opened an empty portal.
 * Adding a faculty member now provisions their login and returns a one-time
 * temporary password, and each member can be assigned the classes they teach.
 */
const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'HOD', 'Lecturer', 'Visiting Faculty'];
const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

const EMPTY = { name: '', department: '', designation: 'Assistant Professor', email: '', phone: '', subjects: '', officeLocation: '', isHOD: false };
const EMPTY_ROW = { code: '', name: '', department: '', year: '', semester: '', section: '', batch: '' };

export default function FacultyTab() {
  const showToast = useToast();
  const { codes: DEPARTMENTS } = useDepartments({ academicOnly: true });
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('All');
  const [busy, setBusy] = useState(false);

  // One-time credential hand-off after creating an account.
  const [credentials, setCredentials] = useState(null);

  // Assignment editor state: which faculty is open, and their rows.
  const [assignFor, setAssignFor] = useState(null);
  const [rows, setRows] = useState([]);
  const [assignBusy, setAssignBusy] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (dept !== 'All') params.set('department', dept);
    const r = await apiCall(`/faculty${params.toString() ? `?${params}` : ''}`);
    if (r.ok) setList(r.data.faculty || []);
  }, [q, dept]);

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  // Default the form's department once the list arrives.
  useEffect(() => {
    if (!form.department && DEPARTMENTS.length) setForm(f => (f.department ? f : { ...f, department: DEPARTMENTS[0] }));
  }, [DEPARTMENTS, form.department]);

  function reset() { setForm(f => ({ ...EMPTY, department: f.department })); setEditId(null); }

  async function save() {
    if (!form.name.trim()) { showToast('Faculty name is required', 'error'); return; }
    if (!editId && !form.email.trim()) { showToast('Email is required — it is their login username', 'error'); return; }

    setBusy(true);
    const res = editId
      ? await apiCall(`/faculty/${editId}`, { method: 'PUT', body: JSON.stringify(form) })
      : await apiCall('/faculty', { method: 'POST', body: JSON.stringify(form) });
    setBusy(false);

    if (res.ok) {
      if (!editId && res.data.account) setCredentials(res.data.account);
      showToast(editId ? 'Faculty updated' : 'Faculty added and login created', 'success');
      reset(); load();
    } else showToast(res.error || 'Save failed', 'error');
  }

  function startEdit(f) {
    setEditId(f._id);
    setForm({
      name: f.name || '', department: f.department || DEPARTMENTS[0] || '',
      designation: f.designation || 'Assistant Professor',
      email: f.email || '', phone: f.phone || '', subjects: (f.subjects || []).join(', '),
      officeLocation: f.officeLocation || '', isHOD: !!f.isHOD,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(id) {
    if (!window.confirm('Remove this faculty member? Their login will be deactivated.')) return;
    const res = await apiCall(`/faculty/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Faculty removed', 'info'); load(); }
    else showToast(res.error || 'Delete failed', 'error');
  }

  async function resetPassword(f) {
    if (!window.confirm(`Issue a new temporary password for ${f.name}?`)) return;
    const res = await apiCall(`/faculty/${f._id}/reset-password`, { method: 'POST', body: '{}' });
    if (res.ok) { setCredentials(res.data.account); showToast('Temporary password issued', 'success'); }
    else showToast(res.error || 'Could not reset the password', 'error');
  }

  // ── Assignments ───────────────────────────────────────────────────────────
  async function openAssignments(f) {
    setAssignFor(f);
    setRows([]);
    const res = await apiCall(`/faculty/${f._id}/assignments`);
    if (res.ok) {
      const existing = (res.data.assignments || []).map(a => ({ ...EMPTY_ROW, ...a }));
      setRows(existing.length ? existing : [{ ...EMPTY_ROW, department: f.department || '' }]);
    } else showToast(res.error || 'Could not load assignments', 'error');
  }

  function setRow(i, key, value) { setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r))); }
  function addRow() { setRows(rs => [...rs, { ...EMPTY_ROW, department: assignFor?.department || '' }]); }
  function removeRow(i) { setRows(rs => rs.filter((_, idx) => idx !== i)); }

  async function saveAssignments() {
    const cleaned = rows.filter(r => (r.name || '').trim() || (r.code || '').trim());
    setAssignBusy(true);
    const res = await apiCall(`/faculty/${assignFor._id}/assignments`, {
      method: 'PUT', body: JSON.stringify({ assignments: cleaned }),
    });
    setAssignBusy(false);
    if (res.ok) {
      showToast(`${cleaned.length} class assignment(s) saved`, 'success');
      setAssignFor(null); load();
    } else showToast(res.error || 'Could not save assignments', 'error');
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text">
          <h2>👥 Faculty</h2>
          <p>Adding a faculty member creates their login account and the classes they teach — no database work required</p>
        </div>
      </div>

      {/* One-time credential hand-off */}
      {credentials && (
        <div className="card mb-6" style={{ borderColor: 'var(--secondary)' }}>
          <div className="card-header"><div className="card-title">🔑 Temporary credentials — shown once</div></div>
          <p style={{ marginBottom: 10 }}>Give these to the faculty member. The password is not stored and cannot be shown again.</p>
          <div style={{ display: 'grid', gap: 8, fontFamily: 'monospace', fontSize: 14 }}>
            <div>Staff ID : <strong>{credentials.staffId}</strong></div>
            <div>Email    : <strong>{credentials.email}</strong></div>
            <div>Password : <strong>{credentials.temporaryPassword}</strong></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn btn-secondary" onClick={() => {
              navigator.clipboard?.writeText(`Email: ${credentials.email}\nPassword: ${credentials.temporaryPassword}`);
              showToast('Copied to clipboard', 'success');
            }}>Copy</button>
            <button className="btn btn-primary" onClick={() => setCredentials(null)}>Done</button>
          </div>
        </div>
      )}

      {/* Assignment editor */}
      {assignFor && (
        <div className="card mb-6">
          <div className="card-header">
            <div className="card-title">🗂️ Classes for {assignFor.name}</div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
            These drive the faculty portal: assigned subjects, the student list, attendance, marks, assignments and analytics.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Subject *</th><th>Code</th><th>Department</th><th>Year</th>
                  <th>Semester</th><th>Section</th><th>Batch</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><input className="form-input" style={{ minWidth: 150 }} placeholder="Data Structures"
                               value={r.name} onChange={e => setRow(i, 'name', e.target.value)} /></td>
                    <td><input className="form-input" style={{ maxWidth: 100 }} placeholder="CS3401"
                               value={r.code} onChange={e => setRow(i, 'code', e.target.value)} /></td>
                    <td>
                      <select className="form-select" style={{ paddingLeft: 12, minWidth: 110 }}
                              value={r.department} onChange={e => setRow(i, 'department', e.target.value)}>
                        <option value="">— dept —</option>
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </td>
                    <td><input className="form-input" style={{ maxWidth: 80 }} placeholder="3rd"
                               value={r.year} onChange={e => setRow(i, 'year', e.target.value)} /></td>
                    <td>
                      <select className="form-select" style={{ paddingLeft: 12, maxWidth: 100 }}
                              value={r.semester} onChange={e => setRow(i, 'semester', e.target.value)}>
                        <option value="">all</option>
                        {SEMESTERS.map(sm => <option key={sm} value={sm}>{sm}</option>)}
                      </select>
                    </td>
                    <td><input className="form-input" style={{ maxWidth: 70 }} placeholder="A"
                               value={r.section} onChange={e => setRow(i, 'section', e.target.value)} /></td>
                    <td><input className="form-input" style={{ maxWidth: 100 }} placeholder="2026"
                               value={r.batch} onChange={e => setRow(i, 'batch', e.target.value)} /></td>
                    <td><button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', padding: '4px 10px' }}
                                onClick={() => removeRow(i)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Leave semester or section blank to cover every semester/section of that subject.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn btn-secondary" onClick={addRow}>+ Add class</button>
            <button className="btn btn-secondary" onClick={() => setAssignFor(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveAssignments} disabled={assignBusy}>
              {assignBusy ? 'Saving…' : 'Save assignments'}
            </button>
          </div>
        </div>
      )}

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">{editId ? '✏️ Edit Faculty' : '➕ Add Faculty'}</div></div>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" placeholder="Dr. A. Kumar" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Department</label>
              <select className="form-select" style={{ paddingLeft: 14 }} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Designation</label>
              <select className="form-select" style={{ paddingLeft: 14 }} value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}>
                {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Email {editId ? '' : '*'}</label>
              <input className="form-input" placeholder="name@yourcollege.edu" value={form.email} disabled={!!editId}
                     onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              {!editId && <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>This becomes their login username.</small>}
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" placeholder="Optional" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Subjects (comma-separated)</label>
            <input className="form-input" placeholder="Machine Learning, Data Structures" value={form.subjects} onChange={e => setForm(f => ({ ...f, subjects: e.target.value }))} />
            <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>Directory search text. Use “Classes” to assign what they actually teach.</small>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center' }}>
            <div className="form-group">
              <label className="form-label">Office Location</label>
              <input className="form-input" placeholder="Block A, Room 204" value={form.officeLocation} onChange={e => setForm(f => ({ ...f, officeLocation: e.target.value }))} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 18, height: 18 }} checked={form.isHOD} onChange={e => setForm(f => ({ ...f, isHOD: e.target.checked }))} />
              Head of Department (HOD)
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {editId && <button className="btn btn-secondary" style={{ flex: 1 }} onClick={reset}>Cancel</button>}
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={busy}>
              {busy ? 'Saving…' : editId ? 'Update' : 'Add Faculty + Create Login'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">📇 Directory {list && `(${list.length})`}</div></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input className="form-input" placeholder="🔍 Search name / subject…" style={{ flex: 1, minWidth: 140 }} value={q} onChange={e => setQ(e.target.value)} />
            <select className="form-select" style={{ paddingLeft: 14, maxWidth: 140 }} value={dept} onChange={e => setDept(e.target.value)}>
              <option value="All">All depts</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {!list && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading…</div>}
            {list && !list.length && <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No faculty found.</p>}
            {(list || []).map(f => (
              <div key={f._id} className="kb-doc-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kb-doc-title">{f.isHOD && '⭐ '}{f.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>· {f.designation}</span></div>
                  <div className="kb-doc-meta">
                    <span className="badge badge-primary" style={{ fontSize: 10 }}>{f.department}</span>
                    {f.isHOD && <span className="badge badge-success" style={{ fontSize: 10 }}>HOD</span>}
                    {f.user
                      ? <span className="badge badge-success" style={{ fontSize: 10 }}>
                          Login {f.user.studentId} · {(f.user.assignedSubjects || []).length} class(es)
                        </span>
                      : <span className="badge badge-warning" style={{ fontSize: 10 }}>No login account</span>}
                    {f.email && <span>✉ {f.email}</span>}
                    {f.officeLocation && <span>· 🏢 {f.officeLocation}</span>}
                  </div>
                  {f.subjects?.length > 0 && <div className="kb-doc-desc">📘 {f.subjects.join(', ')}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-sm btn-secondary" style={{ padding: '4px 10px' }} onClick={() => startEdit(f)}>Edit</button>
                  <button className="btn btn-sm btn-secondary" style={{ padding: '4px 10px' }} onClick={() => openAssignments(f)} disabled={!f.user}>Classes</button>
                  <button className="btn btn-sm btn-secondary" style={{ padding: '4px 10px' }} onClick={() => resetPassword(f)} disabled={!f.user}>Reset PW</button>
                  <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', padding: '4px 10px' }} onClick={() => remove(f._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
