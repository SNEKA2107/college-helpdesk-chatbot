import { useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/format';
import { CAT_BADGE } from './shared';

const CATEGORIES = ['general', 'urgent', 'exam', 'fee', 'holiday'];

export default function NoticesTab({ data, setData, loaded }) {
  const showToast = useToast();
  const [form, setForm] = useState({ title: '', content: '', category: 'general', pinned: false });

  async function createNotice() {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title) { showToast('Notice title is required', 'error'); return; }
    if (!content) { showToast('Notice content is required', 'error'); return; }
    const res = await apiCall('/notices', { method: 'POST', body: JSON.stringify({ title, content, category: form.category, pinned: form.pinned }) });
    if (res.ok) {
      setData(d => ({ ...d, notices: [res.data.notice, ...d.notices] }));
      setForm(f => ({ ...f, title: '', content: '', pinned: false }));
      showToast('Notice posted successfully', 'success');
    } else {
      showToast(res.error || 'Failed to post notice', 'error');
    }
  }

  async function deleteNotice(id) {
    if (!window.confirm('Delete this notice? Students will no longer see it.')) return;
    const res = await apiCall(`/notices/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setData(d => ({ ...d, notices: d.notices.filter(n => n._id !== id) }));
      showToast('Notice deleted', 'info');
    } else {
      showToast(res.error || 'Delete failed', 'error');
    }
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Manage Notices</h2><p>Post new notices and manage existing ones</p></div>
      </div>
      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">➕ Post New Notice</div></div>
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
              <label className="form-label">Options</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <input type="checkbox" id="nPinned" style={{ width: 18, height: 18, cursor: 'pointer' }}
                  checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} />
                <label htmlFor="nPinned" style={{ fontSize: 14, cursor: 'pointer' }}>Pin to top</label>
              </div>
            </div>
          </div>
          <button className="btn btn-primary btn-full" onClick={createNotice}>Post Notice</button>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">🔔 Active Notices</div>
            <span className="badge badge-primary">{data.notices.length}</span>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {!loaded && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading…</div>}
            {loaded && !data.notices.length && <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No active notices</p>}
            {loaded && data.notices.map(n => (
              <div key={n._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{n.pinned ? '📌 ' : ''}{n.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    <span className={`badge ${CAT_BADGE[n.category] || 'badge-muted'}`} style={{ fontSize: 10 }}>{n.category}</span>
                    &nbsp;{formatDate(n.createdAt)} · by {n.postedBy || 'Admin'}
                  </div>
                </div>
                <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', flexShrink: 0, padding: '4px 10px' }} onClick={() => deleteNotice(n._id)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
