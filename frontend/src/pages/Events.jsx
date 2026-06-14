import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { getUser } from '../services/auth';
import { useToast } from '../hooks/useToast';
import '../styles/events.css';

const FILTERS = ['All', 'Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar'];

const fmtEventDate = d => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

export default function Events() {
  const showToast = useToast();
  // Registration state is derived from the server (event.registrations), the single
  // source of truth — so it's correct across devices/sessions and never leaks per browser.
  const userId = String(getUser()?._id || getUser()?.id || '');
  const [events, setEvents] = useState(null);
  const [filter, setFilter] = useState('All');

  const loadEvents = () => apiCall('/events').then(res => setEvents(res.ok ? res.data.events || [] : []));
  useEffect(() => { loadEvents(); }, []);

  const isRegistered = (ev) => Array.isArray(ev.registrations) && ev.registrations.some(id => String(id) === userId);

  async function toggleRegister(ev) {
    if (isRegistered(ev)) {
      const res = await apiCall(`/events/${ev._id}/register`, { method: 'DELETE' });
      if (!res.ok) { showToast(res.error || 'Failed to unregister', 'error'); return; }
      showToast('Unregistered from event', 'info');
    } else {
      const res = await apiCall(`/events/${ev._id}/register`, { method: 'POST', body: JSON.stringify({}) });
      if (!res.ok) { showToast(res.error || 'Registration failed', 'error'); return; }
      showToast('Registered successfully! Check OD Request if you need OD.', 'success');
    }
    loadEvents(); // refetch so the badge reflects the server's authoritative state
  }

  const filtered = !events ? [] : filter === 'All' ? events : events.filter(e => e.category === filter);

  return (
    <Layout title="Events">
      <div className="page-header">
        <div className="page-header-text">
          <h2>College Events</h2>
          <p>Stay updated with upcoming technical, cultural and sports events</p>
        </div>
      </div>

      <div className="filter-bar">
        {FILTERS.map(f => (
          <button key={f} className={`filter-chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="events-grid">
        {!events && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', gridColumn: '1/-1' }}>Loading events…</div>}
        {events && !filtered.length && (
          <div className="empty-events" style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <p>No {filter === 'All' ? '' : `${filter} `}events found.</p>
          </div>
        )}
        {filtered.map(ev => {
          const reg = isRegistered(ev);
          const isPast = new Date(ev.date) < new Date();
          const banner = (ev.banner || ev.category || 'other').toLowerCase();
          return (
            <div key={ev._id} className="event-card">
              <div className={`event-banner banner-${banner}`}></div>
              <div className="event-body">
                <span className={`event-cat cat-${(ev.category || 'other').toLowerCase()}`}>{ev.category}</span>
                <div className="event-title">{ev.title}</div>
                <div className="event-meta">
                  <div className="event-meta-row">📅 <span>{fmtEventDate(ev.date)} at {ev.time}</span></div>
                  <div className="event-meta-row">📍 <span>{ev.venue}</span></div>
                  <div className="event-meta-row">🏛 <span>{ev.organizer}</span></div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>{ev.description}</p>
                <div className="event-actions">
                  {isPast ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Event completed</span>
                  ) : reg ? (
                    <>
                      <span className="tag-registered">✅ Registered</span>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => toggleRegister(ev)}>Unregister</button>
                    </>
                  ) : (
                    <button className="btn btn-primary" style={{ padding: '7px 18px', fontSize: 13 }} onClick={() => toggleRegister(ev)}>Register Now</button>
                  )}
                </div>
                <div className="reg-count">👥 {Array.isArray(ev.registrations) ? ev.registrations.length : 0} / {ev.seats} seats filled</div>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
