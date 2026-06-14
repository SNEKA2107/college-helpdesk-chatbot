import { useEffect, useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/format';

const TYPES = ['Holiday', 'Exam', 'Deadline', 'Semester', 'Event'];
const TYPE_BADGE = { Holiday: 'badge-danger', Exam: 'badge-primary', Deadline: 'badge-warning', Semester: 'badge-success', Event: 'badge-muted' };
const emptyForm = { title: '', type: 'Holiday', date: '', endDate: '', description: '' };

// CRIT-02: admin CRUD for the academic calendar.
export default function CalendarTab() {
  const showToast = useToast();
  const [entries, setEntries] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    apiCall('/calendar').then(res => setEntries(res.ok ? res.data.entries || [] : []));
  }
  useEffect(() => { load(); }, []);

  function resetForm() { setForm(emptyForm); setEditId(null); }

  async function save() {
    if (!form.title.trim() || !form.date) { showToast('Title and date are required', 'error'); return; }
    setSaving(true);
    const body = JSON.stringify({
      title: form.title.trim(), type: form.type, date: form.date,
      endDate: form.endDate || undefined, description: form.description.trim(),
    });
    const res = editId
      ? await apiCall(`/calendar/${editId}`, { method: 'PUT', body })
      : await apiCall('/calendar', { method: 'POST', body });
    setSaving(false);
    if (res.ok) { resetForm(); load(); showToast(editId ? 'Entry updated' : 'Entry created', 'success'); }
    else showToast(res.error || 'Failed to save entry', 'error');
  }

  function startEdit(e) {
    setEditId(e._id);
    setForm({
      title: e.title, type: e.type,
      date: e.date ? e.date.slice(0, 10) : '',
      endDate: e.endDate ? e.endDate.slice(0, 10) : '',
      description: e.description || '',
    });
  }

  async function remove(id) {
    if (!window.confirm('Delete this calendar entry?')) return;
    const res = await apiCall(`/calendar/${id}`, { method: 'DELETE' });
    if (res.ok) { if (editId === id) resetForm(); load(); showToast('Entry deleted', 'info'); }
    else showToast(res.error || 'Delete failed', 'error');
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Academic Calendar</h2><p>Manage holidays, exam schedules, semester dates and events</p></div>
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">{editId ? '✏️ Edit Entry' : '➕ New Entry'}</div></div>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" placeholder="e.g. Pongal Holiday" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" style={{ paddingLeft: 14 }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input className="form-input" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" placeholder="Optional details…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update Entry' : 'Add Entry'}</button>
            {editId && <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">🗓️ Calendar Entries</div>
            <span className="badge badge-primary">{entries?.length || 0}</span>
          </div>
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {!entries && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading…</div>}
            {entries && !entries.length && <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No entries yet</p>}
            {(entries || []).map(e => (
              <div key={e._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 4px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    <span className={`badge ${TYPE_BADGE[e.type] || 'badge-muted'}`} style={{ fontSize: 10 }}>{e.type}</span>
                    &nbsp;{formatDate(e.date)}{e.endDate ? ` → ${formatDate(e.endDate)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-sm btn-secondary" style={{ padding: '4px 10px' }} onClick={() => startEdit(e)}>Edit</button>
                  <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', padding: '4px 10px' }} onClick={() => remove(e._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
