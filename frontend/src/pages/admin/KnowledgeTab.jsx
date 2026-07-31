import { useEffect, useState, useCallback } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/format';
import { validateUploadFile, readFileAsDataURL } from '../../utils/file';
import { LineChart, BarList } from '../../features/charts/Charts';
import '../../styles/success.css';
import '../../styles/knowledge.css';

const CATEGORIES = ['Admissions', 'Attendance', 'Marks', 'Exams', 'Fees', 'Placements', 'Faculty', 'Hostel', 'Transport', 'Scholarships', 'General'];
const DOC_TYPES = [
  ['general', 'General'], ['regulation', 'College Regulation'], ['handbook', 'Student Handbook'],
  ['placement-policy', 'Placement Policy'], ['academic-rule', 'Academic Rule'],
  ['faculty-info', 'Faculty Information'], ['faq', 'FAQ Document'],
];
const DOC_TYPE_LABEL = Object.fromEntries(DOC_TYPES);
const CAT_COLORS = { Exams: 'badge-primary', Fees: 'badge-warning', Placements: 'badge-success', Attendance: 'badge-info', Faculty: 'badge-muted' };

const EMPTY = { title: '', category: 'General', docType: 'general', description: '', content: '', section: '', tags: '', status: 'published' };

export default function KnowledgeTab() {
  const showToast = useToast();
  const [view, setView] = useState('documents');   // 'documents' | 'analytics'
  const [docs, setDocs] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [file, setFile] = useState(null);
  const [filterCat, setFilterCat] = useState('All');
  const [q, setQ] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadDocs = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterCat !== 'All') params.set('category', filterCat);
    if (q.trim()) params.set('q', q.trim());
    const r = await apiCall(`/knowledge${params.toString() ? `?${params}` : ''}`);
    if (r.ok) setDocs(r.data.documents || []);
  }, [filterCat, q]);

  useEffect(() => { const t = setTimeout(loadDocs, q ? 250 : 0); return () => clearTimeout(t); }, [loadDocs, q]);
  useEffect(() => { if (view === 'analytics' && !analytics) apiCall('/knowledge/analytics').then(r => r.ok && setAnalytics(r.data)); }, [view, analytics]);

  function resetForm() { setForm(EMPTY); setEditId(null); setFile(null); }

  async function save() {
    if (!form.title.trim()) { showToast('Document title is required', 'error'); return; }
    if (!editId && !form.content.trim() && !file) { showToast('Add document text or upload a file', 'error'); return; }
    setSaving(true);
    let filePart = {};
    if (file) {
      const v = validateUploadFile(file);
      if (!v.ok) { showToast(v.error, 'error'); setSaving(false); return; }
      try {
        filePart = { fileName: file.name, fileType: file.type, fileSize: file.size, fileData: await readFileAsDataURL(file) };
      } catch { showToast('Could not read file', 'error'); setSaving(false); return; }
    }
    const payload = { ...form, ...filePart };
    const res = editId
      ? await apiCall(`/knowledge/${editId}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await apiCall('/knowledge', { method: 'POST', body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) {
      showToast(editId ? 'Document updated' : 'Document saved', 'success');
      resetForm();
      loadDocs();
      setAnalytics(null);
    } else showToast(res.error || 'Save failed', 'error');
  }

  function startEdit(d) {
    setEditId(d._id);
    setForm({
      title: d.title || '', category: d.category || 'General', docType: d.docType || 'general',
      description: d.description || '', content: d.content || '', section: d.section || '',
      tags: (d.tags || []).join(', '), status: d.status || 'published',
    });
    setFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(id) {
    if (!window.confirm('Permanently delete this document?')) return;
    const res = await apiCall(`/knowledge/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Document deleted', 'info'); setDocs(ds => ds.filter(d => d._id !== id)); }
    else showToast(res.error || 'Delete failed', 'error');
  }

  return (
    <div>
      <div className="page-header mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div className="page-header-text"><h2>📚 Knowledge Base Manager</h2><p>Upload regulations, handbooks, policies & FAQs — Campus HelpDesk cites them in answers</p></div>
        <div className="flex gap-2">
          <button className={`btn btn-sm ${view === 'documents' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('documents')}>Documents</button>
          <button className={`btn btn-sm ${view === 'analytics' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('analytics')}>Knowledge Analytics</button>
        </div>
      </div>

      {view === 'documents' && (
        <div className="grid-2 mb-6">
          {/* Upload / edit form */}
          <div className="card">
            <div className="card-header"><div className="card-title">{editId ? '✏️ Edit Document' : '➕ Add / Upload Document'}</div></div>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" placeholder="e.g. Student Attendance Regulations 2026"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" style={{ paddingLeft: 14 }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Document Type</label>
                <select className="form-select" style={{ paddingLeft: 14 }} value={form.docType} onChange={e => setForm(f => ({ ...f, docType: e.target.value }))}>
                  {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Short description</label>
              <input className="form-input" placeholder="One-line summary (shown in metadata)"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Content / extracted text {!editId && !file && '*'}</label>
              <textarea className="form-textarea" style={{ minHeight: 110 }} placeholder="Paste the document text Campus HelpDesk should search and cite…"
                value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Section reference</label>
                <input className="form-input" placeholder="e.g. §4 Attendance Policy"
                  value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tags (comma-separated)</label>
                <input className="form-input" placeholder="attendance, condonation"
                  value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Attach PDF (optional, max 3 MB)</label>
              <input type="file" accept="application/pdf,image/png,image/jpeg" className="form-input" style={{ paddingTop: 8 }}
                onChange={e => setFile(e.target.files?.[0] || null)} />
              {file && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📎 {file.name} ({Math.round(file.size / 1024)} KB)</span>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {editId && <button className="btn btn-secondary" style={{ flex: 1 }} onClick={resetForm}>Cancel</button>}
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving} onClick={save}>
                {saving ? 'Saving…' : editId ? 'Update Document' : 'Save Document'}
              </button>
            </div>
          </div>

          {/* Document list */}
          <div className="card">
            <div className="card-header"><div className="card-title">🗂️ Documents {docs && `(${docs.length})`}</div></div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input className="form-input" placeholder="🔍 Search documents…" style={{ flex: 1, minWidth: 140 }}
                value={q} onChange={e => setQ(e.target.value)} />
              <select className="form-select" style={{ paddingLeft: 14, maxWidth: 150 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="All">All categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ maxHeight: 460, overflowY: 'auto' }}>
              {!docs && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading…</div>}
              {docs && !docs.length && <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No documents yet.</p>}
              {(docs || []).map(d => (
                <div key={d._id} className="kb-doc-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="kb-doc-title">{d.fileData || d.fileName ? '📎 ' : '📄 '}{d.title}</div>
                    {d.description && <div className="kb-doc-desc">{d.description}</div>}
                    <div className="kb-doc-meta">
                      <span className={`badge ${CAT_COLORS[d.category] || 'badge-muted'}`} style={{ fontSize: 10 }}>{d.category}</span>
                      <span className="badge badge-muted" style={{ fontSize: 10 }}>{DOC_TYPE_LABEL[d.docType] || d.docType}</span>
                      {d.status === 'draft' && <span className="badge badge-warning" style={{ fontSize: 10 }}>draft</span>}
                      <span>👁 {d.accessCount || 0}</span>
                      <span>· {formatDate(d.updatedAt)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-sm btn-secondary" style={{ padding: '4px 10px' }} onClick={() => startEdit(d)}>Edit</button>
                    <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', padding: '4px 10px' }} onClick={() => remove(d._id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'analytics' && (
        !analytics ? <p style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>Loading knowledge analytics…</p> : (
          <div>
            <div className="stats-grid mb-6">
              <div className="stat-card"><div className="stat-icon si-blue">📚</div><div className="stat-info"><h3>{analytics.documents.total}</h3><p>Documents</p></div></div>
              <div className="stat-card"><div className="stat-icon si-purple">🧠</div><div className="stat-info"><h3>{analytics.training.datasetSize}</h3><p>Training Examples</p></div></div>
              <div className="stat-card"><div className="stat-icon si-green">👍</div><div className="stat-info"><h3>{analytics.training.helpfulRate}%</h3><p>Helpful Rate ({analytics.training.ratedCount} rated)</p></div></div>
              <div className="stat-card"><div className="stat-icon si-orange">👎</div><div className="stat-info"><h3>{analytics.training.notHelpful}</h3><p>Not Helpful</p></div></div>
            </div>

            <div className="two-col">
              <div className="chart-card">
                <h4>📈 User Query Trends (last 14 days)</h4>
                {analytics.queryTrends.length ? <LineChart data={analytics.queryTrends} color="var(--primary)" /> : <div className="chart-empty">No queries yet</div>}
              </div>
              <div className="chart-card">
                <h4>🗂️ Intent Distribution</h4>
                <BarList data={analytics.training.intentDistribution} color="#a855f7" />
              </div>
            </div>

            <div className="two-col">
              <div className="chart-card">
                <h4>📄 Most Accessed Documents</h4>
                {analytics.mostAccessedDocuments.length ? <BarList data={analytics.mostAccessedDocuments} color="var(--primary)" /> : <div className="chart-empty">No document access yet</div>}
              </div>
              <div className="chart-card">
                <h4>🔍 Most Searched Topics</h4>
                {analytics.mostSearchedTopics.length ? <BarList data={analytics.mostSearchedTopics} color="#22c55e" /> : <div className="chart-empty">No searches yet</div>}
              </div>
            </div>

            <div className="two-col">
              <div className="chart-card">
                <h4>👍 Most Helpful Answers</h4>
                {analytics.training.mostHelpful.length ? <BarList data={analytics.training.mostHelpful} color="#22c55e" /> : <div className="chart-empty">No 👍 ratings yet</div>}
              </div>
              <div className="chart-card">
                <h4>👎 Least Helpful Answers</h4>
                {analytics.training.leastHelpful.length ? <BarList data={analytics.training.leastHelpful} color="#ef4444" /> : <div className="chart-empty">No 👎 ratings yet</div>}
              </div>
            </div>

            <div className="chart-card">
              <h4>🧩 Missing Knowledge Areas — topics with unanswered queries</h4>
              {analytics.missingKnowledgeAreas.length
                ? <BarList data={analytics.missingKnowledgeAreas} color="#ef4444" />
                : <div className="chart-empty">No knowledge gaps — every query is grounded. 🎉</div>}
            </div>
          </div>
        )
      )}
    </div>
  );
}
