import { useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/format';
import { EV_BADGE } from './shared';

const CATEGORIES = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'Other'];
const EMPTY_FORM = { title: '', category: 'Technical', date: '', time: '', seats: '100', venue: '', organizer: '', description: '' };

export default function EventsTab({ data, setData, loaded, reload }) {
  const showToast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function createEvent() {
    const ev = {
      title: form.title.trim(),
      category: form.category,
      date: form.date,
      time: form.time.trim(),
      venue: form.venue.trim(),
      organizer: form.organizer.trim(),
      seats: parseInt(form.seats) || 100,
      description: form.description.trim(),
    };
    if (!ev.title || !ev.date || !ev.venue || !ev.organizer) { showToast('Title, date, venue and organizer are required', 'error'); return; }
    const res = await apiCall('/events', { method: 'POST', body: JSON.stringify(ev) });
    if (res.ok) {
      setData(d => ({
        ...d,
        events: [...d.events, res.data.event].sort((a, b) => new Date(a.date) - new Date(b.date)),
      }));
      setForm(f => ({ ...EMPTY_FORM, category: f.category }));
      showToast('Event created — students can register now', 'success');
    } else {
      showToast(res.error || 'Failed to create event', 'error');
    }
  }

  async function deleteEvent(id) {
    if (!window.confirm('Delete this event? Student registrations will be lost.')) return;
    const res = await apiCall(`/events/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setData(d => ({ ...d, events: d.events.filter(e => e._id !== id) }));
      showToast('Event deleted', 'info');
    } else {
      showToast(res.error || 'Delete failed', 'error');
    }
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>Campus Events</h2><p>Create events students can register for</p></div>
        <button className="btn btn-outline" onClick={reload}>↺ Refresh</button>
      </div>
      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">➕ Create Event</div></div>
          <div className="form-group"><label className="form-label">Title *</label>
            <input type="text" className="form-input" placeholder="Event title" value={form.title} onChange={e => setField('title', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group"><label className="form-label">Category *</label>
              <select className="form-select" style={{ paddingLeft: 14 }} value={form.category} onChange={e => setField('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setField('date', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Time</label>
              <input type="time" className="form-input" value={form.time} onChange={e => setField('time', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Seats</label>
              <input type="number" className="form-input" min={1} value={form.seats} onChange={e => setField('seats', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Venue *</label>
              <input type="text" className="form-input" placeholder="e.g. Main Auditorium" value={form.venue} onChange={e => setField('venue', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Organizer *</label>
              <input type="text" className="form-input" placeholder="e.g. CSE Department" value={form.organizer} onChange={e => setField('organizer', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Description</label>
            <textarea className="form-textarea" placeholder="Short description…" value={form.description} onChange={e => setField('description', e.target.value)} /></div>
          <button className="btn btn-primary btn-full" onClick={createEvent}>Create Event</button>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">🎉 Upcoming Events</div>
            <span className="badge badge-primary">{data.events.length}</span>
          </div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {!loaded && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading…</div>}
            {loaded && !data.events.length && <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No events yet</p>}
            {loaded && data.events.map(ev => (
              <div key={ev._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{ev.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    <span className={`badge ${EV_BADGE[ev.category] || 'badge-muted'}`} style={{ fontSize: 10 }}>{ev.category}</span>
                    &nbsp;{formatDate(ev.date)}{ev.time ? ' · ' + ev.time : ''} · {ev.venue}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    👥 {ev.registrations?.length || 0}/{ev.seats} registered · by {ev.organizer}
                  </div>
                </div>
                <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', flexShrink: 0, padding: '4px 10px' }} onClick={() => deleteEvent(ev._id)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
