import { useEffect, useMemo, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/format';
import { downloadDataUrl, fileToDataUrl } from '../../utils/download';
import '../../styles/faculty.css';

const KINDS = ['PDF', 'PPT', 'DOC', 'Notes', 'Other'];
const KIND_ICON = { PDF: '📕', PPT: '📊', DOC: '📄', Notes: '📝', Other: '📁' };
const EMPTY = { title: '', description: '', subIdx: '', kind: 'Notes', attachment: '', attachmentName: '', attachmentType: '' };

// Infer a material kind from the uploaded file extension.
function kindFromName(name = '') {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'PDF';
  if (n.endsWith('.ppt') || n.endsWith('.pptx')) return 'PPT';
  if (n.endsWith('.doc') || n.endsWith('.docx')) return 'DOC';
  if (n.endsWith('.txt') || n.endsWith('.md')) return 'Notes';
  return 'Other';
}

export default function FacultyMaterials() {
  const showToast = useToast();
  const [subjects, setSubjects] = useState([]);
  const [materials, setMaterials] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  function load() {
    apiCall('/faculty-portal/materials').then(res => { if (res.ok) setMaterials(res.data.materials || []); });
  }
  useEffect(() => {
    apiCall('/faculty-portal/subjects').then(res => { if (res.ok) setSubjects(res.data.subjects || []); });
    load();
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const r = await fileToDataUrl(file);
      setForm(f => ({ ...f, attachment: r.dataUrl, attachmentName: r.name, attachmentType: r.type, kind: kindFromName(r.name) }));
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function submit() {
    if (!form.title.trim() || form.subIdx === '') { showToast('Title and subject are required', 'error'); return; }
    if (!editId && !form.attachment) { showToast('Please attach a file', 'error'); return; }
    setSaving(true);
    const sub = subjects[Number(form.subIdx)];
    const body = JSON.stringify({
      title: form.title, description: form.description, subject: sub.name, section: sub.section || '', kind: form.kind,
      attachment: form.attachment, attachmentName: form.attachmentName, attachmentType: form.attachmentType,
    });
    const res = editId
      ? await apiCall(`/faculty-portal/materials/${editId}`, { method: 'PUT', body })
      : await apiCall('/faculty-portal/materials', { method: 'POST', body });
    setSaving(false);
    if (res.ok) { showToast(editId ? 'Material updated' : 'Material uploaded', 'success'); setForm(EMPTY); setEditId(null); load(); }
    else showToast(res.error || 'Failed', 'error');
  }

  function edit(m) {
    const idx = subjects.findIndex(s => s.name === m.subject && (s.section || '') === (m.section || ''));
    setEditId(m._id);
    setForm({ title: m.title, description: m.description || '', subIdx: idx >= 0 ? String(idx) : '', kind: m.kind || 'Notes', attachment: '', attachmentName: m.attachmentName || '', attachmentType: m.attachmentType || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function del(id) {
    if (!window.confirm('Delete this material?')) return;
    const res = await apiCall(`/faculty-portal/materials/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Material deleted', 'info'); load(); } else showToast(res.error || 'Delete failed', 'error');
  }

  async function download(m) {
    const res = await apiCall(`/faculty-portal/materials/${m._id}/file`);
    if (res.ok) downloadDataUrl(res.data.attachment, res.data.attachmentName); else showToast(res.error || 'No file', 'error');
  }

  // Group by subject.
  const grouped = useMemo(() => {
    const list = (materials || []).filter(m => !filter || m.subject === filter);
    const g = {};
    list.forEach(m => { (g[m.subject] ||= []).push(m); });
    return g;
  }, [materials, filter]);

  const subjectNames = useMemo(() => [...new Set((materials || []).map(m => m.subject))], [materials]);

  return (
    <FacultyShell title="Study Materials">
      <div className="page-header">
        <div className="page-header-text"><h2>Study Materials</h2><p>Upload notes, PDFs, PPTs & docs for your classes — organized by subject</p></div>
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">{editId ? '✏️ Edit Material' : '⬆️ Upload Material'}</div></div>
          <div className="form-group"><label className="form-label">Title *</label>
            <input className="form-input" placeholder="e.g. Unit 1 — Notes" value={form.title} onChange={e => set('title', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Description</label>
            <textarea className="form-textarea" placeholder="Optional summary…" value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Subject / Class *</label>
            <select className="form-select" value={form.subIdx} onChange={e => set('subIdx', e.target.value)} disabled={!!editId}>
              <option value="">Choose subject…</option>
              {subjects.map((s, i) => <option key={i} value={i}>{s.name} — {s.department} Sem {s.semester}{s.section ? ` · ${s.section}` : ''}</option>)}
            </select></div>
          <div className="fac-controls" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="form-group"><label className="form-label">Type</label>
              <select className="form-select" value={form.kind} onChange={e => set('kind', e.target.value)}>
                {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">File {editId ? '(leave empty to keep)' : '*'}</label>
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,image/*" onChange={onFile} />
              {form.attachmentName && <div className="fac-muted" style={{ fontSize: 12, marginTop: 4 }}>📎 {form.attachmentName}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button className="btn btn-primary btn-full" onClick={submit} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update Material' : 'Upload Material'}</button>
            {editId && <button className="btn btn-outline" onClick={() => { setForm(EMPTY); setEditId(null); }}>Cancel</button>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">📚 My Materials</div><span className="badge badge-primary">{materials ? materials.length : '…'}</span></div>
          {!!subjectNames.length && (
            <div className="fac-chip-row" style={{ marginBottom: 8 }}>
              <button className={`fac-tab${!filter ? ' active' : ''}`} onClick={() => setFilter('')}>All</button>
              {subjectNames.map(s => <button key={s} className={`fac-tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>{s}</button>)}
            </div>
          )}
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {!materials && <p className="fac-muted">Loading…</p>}
            {materials && !materials.length && <p className="fac-muted">No materials uploaded yet.</p>}
            {Object.entries(grouped).map(([subject, items]) => (
              <div key={subject} style={{ marginBottom: 14 }}>
                <div className="fac-row-title" style={{ color: 'var(--primary)', marginBottom: 4 }}>{subject}</div>
                {items.map(m => (
                  <div key={m._id} className="fac-file">
                    <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                      <div className="fac-file-icon">{KIND_ICON[m.kind] || '📁'}</div>
                      <div>
                        <div className="fac-row-title">{m.title} <span className="badge badge-muted" style={{ fontSize: 10 }}>{m.kind}</span></div>
                        {m.description && <div className="fac-muted" style={{ fontSize: 12 }}>{m.description.slice(0, 80)}</div>}
                        <div className="fac-muted" style={{ fontSize: 11 }}>{formatDate(m.createdAt)}{m.attachmentName ? ` · ${m.attachmentName}` : ''}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => download(m)}>⬇ Download</button>
                      <button className="btn btn-sm btn-outline" onClick={() => edit(m)}>Edit</button>
                      <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => del(m._id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </FacultyShell>
  );
}
