import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { formatDate } from '../utils/format';
import '../styles/attendance.css';

const colorClass = pct => (pct >= 85 ? 'good' : pct >= 75 ? 'warn' : 'low');

const PAGE_SIZE = 20;

// Presentation-only mapping of a status value to a badge style + dot colour.
// Covers every value the backend can return (Present/Absent/Late) plus
// Leave/OD for forward-compatibility. Anything unknown falls back to neutral.
const STATUS_META = {
  Present: { cls: 'att-present', label: 'Present' },
  Absent:  { cls: 'att-absent',  label: 'Absent' },
  Late:    { cls: 'att-late',    label: 'Late' },
  Leave:   { cls: 'att-leave',   label: 'Leave' },
  OD:      { cls: 'att-od',      label: 'OD' },
};

export default function Attendance() {
  const [summaryData, setSummaryData] = useState(null);
  const [records, setRecords] = useState(null);

  // History table controls (client-side only — no backend changes).
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortDir, setSortDir] = useState('desc'); // latest date first by default
  const [page, setPage] = useState(1);

  useEffect(() => {
    apiCall('/attendance/summary').then(res => { if (res.ok) setSummaryData(res.data); });
    apiCall('/attendance').then(res => { if (res.ok) setRecords(res.data.records || []); });
  }, []);

  const { summary = [], overall = 0, totalClasses = 0, totalPresent = 0 } = summaryData || {};
  const totalAbsent = totalClasses - totalPresent;

  // Distinct statuses actually present, for the filter dropdown.
  const statusOptions = useMemo(() => {
    const set = new Set((records || []).map(r => r.status).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [records]);

  // Filter → sort (latest first) — memoised so typing/paging stays smooth.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = (records || []).filter(r => {
      const matchesQuery = !q || (r.subject || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
    rows = rows.slice().sort((a, b) => {
      const diff = new Date(b.date) - new Date(a.date);
      return sortDir === 'desc' ? diff : -diff;
    });
    return rows;
  }, [records, query, statusFilter, sortDir]);

  // Reset to first page whenever the result set changes.
  useEffect(() => { setPage(1); }, [query, statusFilter, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const loading = records === null;
  const hasAnyRecords = !loading && records.length > 0;

  const renderStatus = status => {
    const meta = STATUS_META[status] || { cls: 'att-neutral', label: status || '—' };
    return <span className={`att-status ${meta.cls}`}><span className="att-dot" />{meta.label}</span>;
  };

  return (
    <Layout title="My Attendance">
      {/* ── Summary hero ── */}
      {totalClasses > 0 && (
        <div className="overall-box reveal">
          <div className={`overall-circle ${colorClass(overall)}`}>
            <div className="overall-pct">{overall}%</div>
            <div className="overall-label">Overall</div>
          </div>
          <div className="overall-info">
            <h3>Attendance Summary</h3>
            <p>Minimum 75% required in all subjects to sit for exams.</p>
            <div className="overall-stats">
              <div className="o-stat"><div className="o-stat-val">{totalClasses}</div><div className="o-stat-lbl">Total Classes</div></div>
              <div className="o-stat"><div className="o-stat-val stat-present">{totalPresent}</div><div className="o-stat-lbl">Present</div></div>
              <div className="o-stat"><div className="o-stat-val stat-absent">{totalAbsent}</div><div className="o-stat-lbl">Absent</div></div>
              <div className="o-stat"><div className="o-stat-val stat-pct">{overall}%</div><div className="o-stat-lbl">Attendance</div></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Subject-wise breakdown ── */}
      <div className="card reveal" style={{ marginBottom: 24 }}>
        <h3 className="card-title">Subject-wise Breakdown</h3>
        <div className="subject-list">
          {!summaryData && <div className="att-inline-loading">Loading subject breakdown…</div>}
          {summaryData && !summary.length && (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p className="empty-title">No attendance records yet</p>
              <p>Your attendance will appear here once your class admin starts marking it.</p>
            </div>
          )}
          {summary.map(s => {
            const cls = colorClass(s.percentage);
            return (
              <div key={s.subject} className="subject-card">
                <div className="subj-head">
                  <span className="subj-name">{s.subject}</span>
                  <div className="subj-head-right">
                    {s.percentage < 75 && <span className="subj-warn">⚠ Below minimum</span>}
                    <span className={`subj-pct pct-${cls}`}>{s.percentage}%</span>
                  </div>
                </div>
                <div className="progress-bar"><div className={`progress-fill fill-${cls}`} style={{ width: `${s.percentage}%` }}></div></div>
                <div className="subj-counts">
                  <span className="subj-count"><span className="subj-count-lbl">Total</span> {s.total}</span>
                  <span className="subj-count stat-present"><span className="subj-count-lbl">Present</span> {s.present}</span>
                  <span className="subj-count stat-absent"><span className="subj-count-lbl">Absent</span> {s.absent}</span>
                  {s.late > 0 && <span className="subj-count stat-late"><span className="subj-count-lbl">Late</span> {s.late}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Attendance history ── */}
      <div className="card reveal">
        <div className="att-history-head">
          <h3 className="card-title" style={{ margin: 0 }}>Attendance History</h3>
          {hasAnyRecords && <span className="att-count-pill">{filtered.length} record{filtered.length === 1 ? '' : 's'}</span>}
        </div>

        {hasAnyRecords && (
          <div className="att-toolbar">
            <div className="att-search-wrap">
              <span className="att-search-icon">🔍</span>
              <input
                type="text"
                className="att-search"
                placeholder="Search by subject…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Search attendance by subject"
              />
            </div>
            <select
              className="att-filter"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              aria-label="Filter by attendance status"
            >
              {statusOptions.map(s => <option key={s} value={s}>{s === 'All' ? 'All statuses' : (STATUS_META[s]?.label || s)}</option>)}
            </select>
          </div>
        )}

        <div className="att-table-container">
          <div className="att-table-scroll">
            <table className="att-table">
              <thead>
                <tr>
                  <th
                    className="att-th-sortable"
                    onClick={() => hasAnyRecords && setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))}
                    aria-sort={sortDir === 'desc' ? 'descending' : 'ascending'}
                  >
                    Date <span className="att-sort-caret">{sortDir === 'desc' ? '▼' : '▲'}</span>
                  </th>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={3} className="att-state-cell"><span className="att-spinner" /> Loading attendance…</td></tr>
                )}
                {!loading && !hasAnyRecords && (
                  <tr><td colSpan={3} className="att-state-cell">
                    <div className="empty-state" style={{ padding: '32px 20px' }}>
                      <div className="empty-icon">📋</div>
                      <p className="empty-title">No attendance records yet</p>
                      <p>Records will appear here once your class admin starts marking attendance.</p>
                    </div>
                  </td></tr>
                )}
                {!loading && hasAnyRecords && !filtered.length && (
                  <tr><td colSpan={3} className="att-state-cell">No records match your search or filter.</td></tr>
                )}
                {!loading && pageRows.map(r => (
                  <tr key={r._id}>
                    <td className="att-td-date">{formatDate(r.date)}</td>
                    <td className="att-td-subject">{r.subject}</td>
                    <td>{renderStatus(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasAnyRecords && filtered.length > 0 && (
            <div className="att-pagination">
              <span className="att-page-info">
                Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="att-page-controls">
                <button className="att-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>‹ Prev</button>
                <span className="att-page-current">Page {safePage} of {totalPages}</span>
                <button className="att-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Next ›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
