import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { formatDate } from '../utils/format';

const STATUS_CLASSES = { Available: 'badge-success', Borrowed: 'badge-danger', Reserved: 'badge-warning' };
const CATEGORIES = [['IT', 'IT'], ['AI', 'AI / ML'], ['Java', 'Java'], ['DBMS', 'DBMS'], ['Python', 'Python'], ['Math', 'Maths']];

const RULES = [
  { icon: '📚', title: 'Borrowing Limit', text: 'Students can borrow up to 3 books at a time for a period of 14 days.' },
  { icon: '💰', title: 'Late Fine', text: '₹2 per book per day for late return. Maximum fine of ₹100 per book.' },
  { icon: '🔕', title: 'Silence Zone', text: 'Maintain silence in the reading hall. Mobile phones must be on silent mode.' },
];

export default function Library() {
  const [books, setBooks] = useState(null);
  const [borrowed, setBorrowed] = useState(null);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: '…', available: '…' });

  useEffect(() => {
    apiCall('/library').then(res => {
      if (!res.ok) return;
      setBooks(res.data.books);
      setStats({
        total: res.data.books.length.toLocaleString('en-IN'),
        available: res.data.books.filter(b => b.status === 'Available').length.toLocaleString('en-IN'),
      });
    });
    apiCall('/library/borrowed').then(res => { if (res.ok) setBorrowed(res.data.borrowed); });
  }, []);

  async function searchBooks(query) {
    const res = await apiCall(`/library?search=${encodeURIComponent(query.trim())}`);
    if (res.ok) setBooks(res.data.books);
  }

  async function searchByCategory(cat) {
    setSearch(cat);
    const res = await apiCall(`/library?category=${encodeURIComponent(cat)}`);
    if (res.ok) setBooks(res.data.books);
  }

  const nextDue = borrowed?.length
    ? new Date([...borrowed].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0].dueDate)
        .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '—';

  const now = new Date();

  return (
    <Layout title="Library">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Library</h2>
          <p>Search books, view borrowed books, and library information</p>
        </div>
      </div>

      <div className="stats-grid mb-6">
        <div className="stat-card"><div className="stat-icon si-blue">📚</div><div className="stat-info"><h3>{stats.total}</h3><p>Total Books</p></div></div>
        <div className="stat-card"><div className="stat-icon si-green">✅</div><div className="stat-info"><h3>{stats.available}</h3><p>Available Now</p></div></div>
        <div className="stat-card"><div className="stat-icon si-orange">📖</div><div className="stat-info"><h3>{borrowed ? borrowed.length : '…'}</h3><p>My Borrowed Books</p></div></div>
        <div className="stat-card"><div className="stat-icon si-purple">📅</div><div className="stat-info"><h3>{nextDue}</h3><p>Next Due Date</p></div></div>
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">🔍 Search Book Catalog</div></div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              type="text" className="form-input" placeholder="Search by title, author, or ISBN…" style={{ flex: 1 }}
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') searchBooks(search); }}
            />
            <button className="btn btn-primary" onClick={() => searchBooks(search)}>Search</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {CATEGORIES.map(([cat, label]) => (
              <button key={cat} className="btn btn-secondary btn-sm" onClick={() => searchByCategory(cat)}>{label}</button>
            ))}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Status</th></tr></thead>
              <tbody>
                {!books && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Loading…</td></tr>}
                {books && !books.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No books found</td></tr>}
                {(books || []).map(b => (
                  <tr key={b._id}>
                    <td>{b.title}</td>
                    <td>{b.author}</td>
                    <td>{b.category}</td>
                    <td><span className={`badge ${STATUS_CLASSES[b.status] || 'badge-muted'}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">🕐 Library Hours</div>
              <span className="badge badge-success">● Open Now</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 10, background: 'var(--primary-bg,#eef2ff)', borderRadius: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Monday – Friday</span>
                <span style={{ fontSize: 13.5 }}>8:00 AM – 6:00 PM</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 10, background: 'var(--bg2)', borderRadius: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Saturday</span>
                <span style={{ fontSize: 13.5 }}>9:00 AM – 4:00 PM</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 10, background: 'var(--bg2)', borderRadius: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Sunday / Holidays</span>
                <span style={{ fontSize: 13.5, color: 'var(--danger)' }}>Closed</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">📖 My Borrowed Books</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!borrowed && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading…</div>}
              {borrowed && !borrowed.length && <p style={{ color: 'var(--text-muted)', fontSize: 13.5, padding: '8px 0' }}>No books currently borrowed.</p>}
              {(borrowed || []).map(b => {
                const daysLeft = Math.ceil((new Date(b.dueDate) - now) / 86400000);
                const badgeClass = daysLeft < 0 ? 'badge-danger' : daysLeft <= 3 ? 'badge-warning' : 'badge-success';
                const badgeText = daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft} days left`;
                return (
                  <div key={b._id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{b.title} – {b.author}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Borrowed: {formatDate(b.borrowedDate)}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <span style={{ fontSize: 12, color: daysLeft < 0 ? 'var(--danger)' : 'var(--secondary)', fontWeight: 600 }}>Due: {formatDate(b.dueDate)}</span>
                      <span className={`badge ${badgeClass}`}>⏰ {badgeText}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="alert alert-info mt-4">
              <span>ℹ️</span>
              <div>You can borrow up to <strong>3 books</strong> at a time. Fine: ₹2 per day after due date.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📋 Library Rules &amp; Policies</div></div>
        <div className="grid-3">
          {RULES.map(r => (
            <div key={r.title} style={{ padding: 16, background: 'var(--bg2)', borderRadius: 10 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{r.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.text}</div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
