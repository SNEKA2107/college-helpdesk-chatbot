import { useEffect, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/format';
import '../../styles/faculty.css';

const CATEGORIES = ['general', 'exam', 'fee', 'urgent', 'holiday'];
const EMPTY = { title: '', content: '', category: 'general', attachment: '', attachmentName: '', attachmentType: '' };

export default function FacultyNotices() {
  const showToast = useToast();
  const [notices, setNotices] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    apiCall('/faculty-portal/notices').then(res => { if (res.ok) setNotices(res.data.notices || []); });
  }
  useEffect(load, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('File must be under 5 MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, attachment: reader.result, attachmentName: file.name, attachmentType: file.type }));
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!form.title.trim() || !form.content.trim()) { showToast('Title and content are required', 'error'); return; }
    setSaving(true);
    const body = JSON.stringify(form);
    const res = editId
      ? await apiCall(`/faculty-portal/notices/${editId}`, { method: 'PUT', body })
      : await apiCall('/faculty-portal/notices', { method: 'POST', body });
    setSaving(false);
    if (res.ok) { showToast(editId ? 'Notice updated' : 'Notice posted', 'success'); setForm(EMPTY); setEditId(null); load(); }
    else showToast(res.error || 'Failed', 'error');
  }

  function edit(n) {
    setEditId(n._id);
    setForm({ title: n.title, content: n.content, category: n.category, attachment: '', attachmentName: n.attachmentName || '', attachmentType: n.attachmentType || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function del(id) {
    if (!window.confirm('Delete this notice?')) return;
    const res = await apiCall(`/faculty-portal/notices/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Notice deleted', 'info'); load(); }
    else showToast(res.error || 'Delete failed', 'error');
  }

  return (
    <FacultyShell title="Notices">
      <div className="page-header">
        <div className="page-header-text"><h2>Notices</h2><p>Post notices and upload notes/assignments for students</p></div>
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">{editId ? '✏️ Edit Notice' : '➕ Create Notice'}</div></div>
          <div className="form-group"><label className="form-label">Title *</label>
            <input className="form-input" placeholder="Notice title" value={form.title} onChange={e => set('title', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Content *</label>
            <textarea className="form-textarea" placeholder="Write the notice…" value={form.content} onChange={e => set('content', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Category</label>
            <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Attach PDF / Assignment</label>
            <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,image/*" onChange={onFile} />
            {form.attachmentName && <div className="fac-muted" style={{ fontSize: 12, marginTop: 4 }}>📎 {form.attachmentName}</div>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary btn-full" onClick={submit} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update Notice' : 'Post Notice'}</button>
            {editId && <button className="btn btn-outline" onClick={() => { setForm(EMPTY); setEditId(null); }}>Cancel</button>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">📋 My Notices</div><span className="badge badge-primary">{notices ? notices.length : '…'}</span></div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {!notices && <p className="fac-muted">Loading…</p>}
            {notices && !notices.length && <p className="fac-muted">You haven't posted any notices yet.</p>}
            {(notices || []).map(n => (
              <div key={n._id} className="fac-notice">
                <div style={{ flex: 1 }}>
                  <div className="fac-row-title">{n.title} <span className="badge badge-muted" style={{ fontSize: 10 }}>{n.category}</span></div>
                  <div className="fac-muted" style={{ fontSize: 12, margin: '4px 0' }}>{n.content.slice(0, 90)}{n.content.length > 90 ? '…' : ''}</div>
                  <div className="fac-muted" style={{ fontSize: 11 }}>{formatDate(n.publishedAt || n.createdAt)}{n.attachmentName ? ` · 📎 ${n.attachmentName}` : ''}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => edit(n)}>Edit</button>
                  <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => del(n._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FacultyShell>
  );
}
