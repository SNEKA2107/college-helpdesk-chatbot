import { useEffect, useState, useCallback } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import '../../styles/knowledge.css';

const DEPARTMENTS = ['IT', 'CSE', 'AIML', 'AIDS', 'Bioinformatics', 'ECE', 'EEE', 'MECH', 'CIVIL', 'General'];
const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'HOD', 'Lecturer', 'Visiting Faculty'];

const EMPTY = { name: '', department: 'IT', designation: 'Assistant Professor', email: '', phone: '', subjects: '', officeLocation: '', isHOD: false };

export default function FacultyTab() {
  const showToast = useToast();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('All');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (dept !== 'All') params.set('department', dept);
    const r = await apiCall(`/faculty${params.toString() ? `?${params}` : ''}`);
    if (r.ok) setList(r.data.faculty || []);
  }, [q, dept]);

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  function reset() { setForm(EMPTY); setEditId(null); }

  async function save() {
    if (!form.name.trim()) { showToast('Faculty name is required', 'error'); return; }
    const res = editId
      ? await apiCall(`/faculty/${editId}`, { method: 'PUT', body: JSON.stringify(form) })
      : await apiCall('/faculty', { method: 'POST', body: JSON.stringify(form) });
    if (res.ok) { showToast(editId ? 'Faculty updated' : 'Faculty added', 'success'); reset(); load(); }
    else showToast(res.error || 'Save failed', 'error');
  }

  function startEdit(f) {
    setEditId(f._id);
    setForm({
      name: f.name || '', department: f.department || 'IT', designation: f.designation || 'Assistant Professor',
      email: f.email || '', phone: f.phone || '', subjects: (f.subjects || []).join(', '),
      officeLocation: f.officeLocation || '', isHOD: !!f.isHOD,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(id) {
    if (!window.confirm('Remove this faculty member?')) return;
    const res = await apiCall(`/faculty/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Faculty removed', 'info'); setList(l => l.filter(f => f._id !== id)); }
    else showToast(res.error || 'Delete failed', 'error');
  }

  return (
    <div>
      <div className="page-header mb-6"><div className="page-header-text"><h2>👥 Faculty Directory</h2><p>The Copilot answers "who teaches X", "who is the HOD" and faculty emails from this list</p></div></div>

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
              <label className="form-label">Email</label>
              <input className="form-input" placeholder="kumar@college.edu" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" placeholder="Optional" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Subjects (comma-separated)</label>
            <input className="form-input" placeholder="Machine Learning, Data Structures" value={form.subjects} onChange={e => setForm(f => ({ ...f, subjects: e.target.value }))} />
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
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={save}>{editId ? 'Update' : 'Add Faculty'}</button>
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
                    {f.email && <span>✉ {f.email}</span>}
                    {f.officeLocation && <span>· 🏢 {f.officeLocation}</span>}
                  </div>
                  {f.subjects?.length > 0 && <div className="kb-doc-desc">📘 {f.subjects.join(', ')}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-sm btn-secondary" style={{ padding: '4px 10px' }} onClick={() => startEdit(f)}>Edit</button>
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
