import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { invalidateDepartments } from '../../hooks/useDepartments';
import { emptyCellStyle, loadingCellStyle } from './shared';

/**
 * Department management (audit finding H-1).
 *
 * Departments used to be a hardcoded enum duplicated across three models and
 * five frontend files, with the copies out of sync. They are now rows in a
 * collection that every dropdown, filter and validator reads.
 */
const EMPTY = { code: '', name: '', description: '', isAcademic: true };

export default function DepartmentsTab() {
  const showToast = useToast();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    // ?all=true includes disabled departments — the admin needs to see them to re-enable.
    const r = await apiCall('/departments?all=true');
    if (r.ok) setList(r.data.departments || []);
    else showToast(r.error || 'Could not load departments', 'error');
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function reset() { setForm(EMPTY); setEditId(null); }

  async function save() {
    if (!editId && !form.code.trim()) { showToast('Department code is required', 'error'); return; }
    if (!form.name.trim()) { showToast('Department name is required', 'error'); return; }

    setBusy(true);
    // `code` is immutable on update: existing users/notices/timetables reference
    // it as a string, so renaming would orphan live records.
    const body = editId
      ? { name: form.name, description: form.description, isAcademic: form.isAcademic }
      : { code: form.code.trim(), name: form.name.trim(), description: form.description, isAcademic: form.isAcademic };

    const res = editId
      ? await apiCall(`/departments/${editId}`, { method: 'PUT', body: JSON.stringify(body) })
      : await apiCall('/departments', { method: 'POST', body: JSON.stringify(body) });
    setBusy(false);

    if (res.ok) {
      showToast(editId ? 'Department updated' : 'Department created', 'success');
      invalidateDepartments();   // every other tab's dropdown refreshes on next mount
      reset(); load();
    } else showToast(res.error || 'Save failed', 'error');
  }

  async function toggleActive(d) {
    const res = await apiCall(`/departments/${d._id}`, {
      method: 'PUT', body: JSON.stringify({ isActive: !d.isActive }),
    });
    if (res.ok) {
      showToast(d.isActive ? `${d.code} disabled` : `${d.code} enabled`, 'info');
      invalidateDepartments(); load();
    } else showToast(res.error || 'Update failed', 'error');
  }

  async function remove(d) {
    if (!window.confirm(`Delete department "${d.code}"? This cannot be undone.`)) return;
    const res = await apiCall(`/departments/${d._id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Department deleted', 'info'); invalidateDepartments(); load(); }
    else showToast(res.error || 'Delete failed', 'error');  // 409 when accounts still reference it
  }

  function startEdit(d) {
    setEditId(d._id);
    setForm({ code: d.code, name: d.name || '', description: d.description || '', isAcademic: d.isAcademic !== false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text">
          <h2>🏛️ Departments</h2>
          <p>Every department dropdown across the app — registration, timetable, exams, attendance, marks, notices — reads this list</p>
        </div>
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">{editId ? '✏️ Edit Department' : '➕ Add Department'}</div></div>

          <div className="form-group">
            <label className="form-label">Code *</label>
            <input
              className="form-input" placeholder="e.g. ROBOTICS" value={form.code} disabled={!!editId}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {editId ? 'The code cannot be changed — existing records reference it.' : 'Short code stored on student, notice and timetable records.'}
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" placeholder="e.g. Robotics and Automation" value={form.name}
                   onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" placeholder="Optional" value={form.description}
                   onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 18, height: 18 }} checked={form.isAcademic}
                   onChange={e => setForm(f => ({ ...f, isAcademic: e.target.checked }))} />
            Teaching department (uncheck for administrative buckets)
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            {editId && <button className="btn btn-secondary" style={{ flex: 1 }} onClick={reset}>Cancel</button>}
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={busy}>
              {busy ? 'Saving…' : editId ? 'Update' : 'Add Department'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">🏛️ All Departments {list && `(${list.length})`}</div></div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {!list && <div style={loadingCellStyle}>Loading…</div>}
            {list && !list.length && <p style={emptyCellStyle}>No departments yet. Add the first one.</p>}
            {(list || []).map(d => (
              <div key={d._id} className="kb-doc-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kb-doc-title">
                    {d.code}
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}> · {d.name}</span>
                  </div>
                  <div className="kb-doc-meta">
                    <span className={`badge ${d.isActive ? 'badge-success' : 'badge-muted'}`} style={{ fontSize: 10 }}>
                      {d.isActive ? 'Active' : 'Disabled'}
                    </span>
                    {d.isAcademic === false && <span className="badge badge-muted" style={{ fontSize: 10 }}>Non-teaching</span>}
                  </div>
                  {d.description && <div className="kb-doc-desc">{d.description}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-sm btn-secondary" style={{ padding: '4px 10px' }} onClick={() => startEdit(d)}>Edit</button>
                  <button className="btn btn-sm btn-secondary" style={{ padding: '4px 10px' }} onClick={() => toggleActive(d)}>
                    {d.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', padding: '4px 10px' }}
                          onClick={() => remove(d)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            A department still used by any account cannot be deleted — disable it instead so historical records stay readable.
          </p>
        </div>
      </div>
    </div>
  );
}
