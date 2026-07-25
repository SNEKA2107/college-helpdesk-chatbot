import { useMemo, useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/format';
import { CAT_BADGE } from './shared';
import { useDepartments } from '../../hooks/useDepartments';

const CATEGORIES = ['general', 'urgent', 'exam', 'fee', 'holiday'];

// Role audiences are fixed. Department audiences are built from the Department
// collection at render time, so a newly created department can be targeted
// immediately — this used to be a hardcoded copy of the model enum that drifted
// out of sync with it (audit finding H-1).
const ROLE_AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'student', label: 'All Students' },
  { value: 'admin', label: 'Admins only' },
];

const STATUS_FILTERS = [['published', 'Published'], ['draft', 'Drafts'], ['archived', 'Archived']];
const STATUS_BADGE = { published: 'badge-success', draft: 'badge-warning', archived: 'badge-muted' };

const EMPTY_FORM = { title: '', content: '', category: 'general', audience: 'all', expiresAt: '', pinned: false };

export default function NoticesTab({ data, setData, loaded }) {
  const { departments } = useDepartments({ academicOnly: true });
  const AUDIENCES = useMemo(() => [
    ...ROLE_AUDIENCES,
    ...departments.map(d => ({ value: d.code, label: `Dept · ${d.code}` })),
  ], [departments]);
  const AUDIENCE_LABEL = useMemo(
    () => Object.fromEntries(AUDIENCES.map(a => [a.value, a.label])), [AUDIENCES]);

  const showToast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState('published');

  // Legacy notices created before the lifecycle fields exist have no `status`; treat them as published.
  const effStatus = n => n.status || 'published';

  const counts = useMemo(() => {
    const c = { published: 0, draft: 0, archived: 0 };
    (data.notices || []).forEach(n => { c[effStatus(n)] = (c[effStatus(n)] || 0) + 1; });
    return c;
  }, [data.notices]);

  const visible = (data.notices || []).filter(n => effStatus(n) === statusFilter);

  function patchLocal(updated) {
    setData(d => ({ ...d, notices: d.notices.map(n => (n._id === updated._id ? updated : n)) }));
  }

  async function saveNotice(status) {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title) { showToast('Notice title is required', 'error'); return; }
    if (!content) { showToast('Notice content is required', 'error'); return; }
    const payload = {
      title, content, category: form.category, audience: form.audience,
      pinned: form.pinned, status,
      expiresAt: form.expiresAt || undefined,
    };
    const res = await apiCall('/notices', { method: 'POST', body: JSON.stringify(payload) });
    if (res.ok) {
      setData(d => ({ ...d, notices: [res.data.notice, ...d.notices] }));
      setForm(EMPTY_FORM);
      setStatusFilter(status);
      showToast(status === 'draft' ? 'Draft saved' : 'Notice published', 'success');
    } else {
      showToast(res.error || 'Failed to save notice', 'error');
    }
  }

  async function setStatus(notice, status) {
    const verb = { published: 'Publish', archived: 'Archive' }[status];
    if (status === 'archived' && !window.confirm('Archive this notice? Students will no longer see it.')) return;
    const res = await apiCall(`/notices/${notice._id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (res.ok) { patchLocal(res.data.notice); showToast(`Notice ${status}`, status === 'archived' ? 'info' : 'success'); }
    else showToast(res.error || `${verb} failed`, 'error');
  }

  async function deleteNotice(id) {
    if (!window.confirm('Permanently delete this notice? This cannot be undone.')) return;
    const res = await apiCall(`/notices/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setData(d => ({ ...d, notices: d.notices.filter(n => n._id !== id) }));
      showToast('Notice deleted', 'info');
    } else {
      showToast(res.error || 'Delete failed', 'error');
    }
  }

  const isExpired = n => n.expiresAt && new Date(n.expiresAt) < new Date();

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Manage Notices</h2><p>Create, publish, and archive student announcements</p></div>
      </div>
      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">➕ Compose Notice</div></div>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input type="text" className="form-input" placeholder="Notice title"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Content *</label>
            <textarea className="form-textarea" placeholder="Notice content…" style={{ minHeight: 100 }}
              value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" style={{ paddingLeft: 14 }}
                value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Audience</label>
              <select className="form-select" style={{ paddingLeft: 14 }}
                value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}>
                {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Expires on (optional)</label>
              <input type="date" className="form-input"
                value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Options</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <input type="checkbox" id="nPinned" style={{ width: 18, height: 18, cursor: 'pointer' }}
                  checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} />
                <label htmlFor="nPinned" style={{ fontSize: 14, cursor: 'pointer' }}>Pin to top</label>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => saveNotice('draft')}>Save Draft</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveNotice('published')}>Publish</button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">🔔 Notices</div>
          </div>
          <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(([key, label]) => (
              <button key={key} className={`btn btn-sm ${statusFilter === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(key)}>
                {label} ({counts[key] || 0})
              </button>
            ))}
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {!loaded && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading…</div>}
            {loaded && !visible.length && <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No {statusFilter} notices</p>}
            {loaded && visible.map(n => (
              <div key={n._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{n.pinned ? '📌 ' : ''}{n.title}</div>
                  {n.summary && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 3 }}>🤖 {n.summary}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`badge ${CAT_BADGE[n.category] || 'badge-muted'}`} style={{ fontSize: 10 }}>{n.category}</span>
                    <span className={`badge ${STATUS_BADGE[effStatus(n)]}`} style={{ fontSize: 10 }}>{effStatus(n)}</span>
                    <span className="badge badge-muted" style={{ fontSize: 10 }}>{AUDIENCE_LABEL[n.audience] || n.audience || 'Everyone'}</span>
                    {isExpired(n) && <span className="badge badge-danger" style={{ fontSize: 10 }}>expired</span>}
                    <span>{formatDate(n.publishedAt || n.createdAt)} · by {n.postedBy || 'Admin'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  {effStatus(n) !== 'published' && (
                    <button className="btn btn-sm" style={{ background: 'var(--secondary)', color: '#fff', padding: '4px 10px' }} onClick={() => setStatus(n, 'published')}>Publish</button>
                  )}
                  {effStatus(n) === 'published' && (
                    <button className="btn btn-sm btn-secondary" style={{ padding: '4px 10px' }} onClick={() => setStatus(n, 'archived')}>Archive</button>
                  )}
                  <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', padding: '4px 10px' }} onClick={() => deleteNotice(n._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
