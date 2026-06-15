import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../utils/format';

const CATEGORY_META = {
  urgent:  { label: '🚨 Urgent',  badge: 'badge-danger',  border: 'var(--danger)' },
  exam:    { label: '📘 Exam',    badge: 'badge-primary', border: 'var(--primary)' },
  fee:     { label: '💳 Fee',     badge: 'badge-primary', border: '#06b6d4' },
  general: { label: '📢 General', badge: 'badge-success', border: 'var(--secondary)' },
  holiday: { label: '📅 Holiday', badge: 'badge-warning', border: 'var(--warning)' },
};

const FILTERS = [['all', 'All Notices'], ['exam', 'Exam'], ['fee', 'Fee'], ['general', 'General'], ['urgent', 'Urgent']];

export default function Notices() {
  const showToast = useToast();
  const [notices, setNotices] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [readIds, setReadIds] = useState(() => new Set(JSON.parse(localStorage.getItem('ca_read_notices') || '[]')));

  useEffect(() => {
    apiCall('/notices').then(res => {
      if (res.ok) setNotices(res.data.notices);
      else setLoadError(true);
    });
  }, []);

  function persistRead(ids) {
    localStorage.setItem('ca_read_notices', JSON.stringify([...ids]));
    setReadIds(new Set(ids));
  }

  const markRead = id => persistRead(new Set(readIds).add(id));

  function markAllRead() {
    const ids = new Set(readIds);
    (notices || []).forEach(n => ids.add(n._id));
    persistRead(ids);
    showToast('All notices marked as read', 'success');
  }

  const filtered = !notices ? [] : filter === 'all' ? notices : notices.filter(n => n.category === filter);

  return (
    <Layout title="Notices">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Notices &amp; Announcements</h2>
          <p>Official college notices, exam updates, and important announcements</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary btn-sm" onClick={markAllRead}>✓ Mark All Read</button>
        </div>
      </div>

      <div className="flex gap-3 mb-6" style={{ flexWrap: 'wrap' }}>
        {FILTERS.map(([key, label]) => (
          <button key={key} className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loadError && <p style={{ color: 'var(--danger)', textAlign: 'center', padding: '32px 0' }}>Failed to load notices.</p>}
        {!notices && !loadError && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>Loading notices…</p>}
        {notices && !filtered.length && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>No notices found.</p>}
        {filtered.map(n => {
          const meta = CATEGORY_META[n.category] || CATEGORY_META.general;
          const isRead = readIds.has(n._id);
          return (
            <div key={n._id} className="card" style={{ borderLeft: `4px solid ${meta.border}`, opacity: isRead ? 0.65 : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className={`badge ${meta.badge}`}>{meta.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(n.publishedAt || n.createdAt)}</span>
                    {!isRead && <span style={{ width: 8, height: 8, background: 'var(--primary)', borderRadius: '50%', display: 'inline-block' }} title="Unread"></span>}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--dark)', marginBottom: 6 }}>{n.title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>{n.content}</p>
                </div>
                <div>
                  {isRead
                    ? <span className="badge badge-muted">Read</span>
                    : <button className="btn btn-secondary btn-sm" onClick={() => markRead(n._id)}>Mark Read</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
