import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { useToast } from '../hooks/useToast';
import '../styles/events.css';

const FILTERS = ['All', 'Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar'];

const DEMO_EVENTS = [
  { _id: 'ev1', title: 'CodeFest 2025', category: 'Technical', date: '2025-09-15', time: '9:00 AM', venue: 'Main Auditorium', organizer: 'IT Department', description: 'Annual inter-college coding competition with prizes worth ₹50,000. Participate in individual and team rounds.', seats: 200, banner: 'technical' },
  { _id: 'ev2', title: 'Ethnic Day & Cultural Fest', category: 'Cultural', date: '2025-09-22', time: '10:00 AM', venue: 'Open Air Theatre', organizer: 'Student Council', description: 'Celebrate diversity with traditional attire, folk dances, music and art competitions. Register by teams or individually.', seats: 500, banner: 'cultural' },
  { _id: 'ev3', title: 'National Sports Day – Inter-Dept Tournament', category: 'Sports', date: '2025-08-29', time: '7:00 AM', venue: 'College Sports Ground', organizer: 'Physical Education Dept', description: 'Cricket, football, volleyball, and kabaddi inter-department tournament. Form your department team and register.', seats: 300, banner: 'sports' },
  { _id: 'ev4', title: 'AI & ML Workshop', category: 'Workshop', date: '2025-10-05', time: '9:30 AM', venue: 'Computer Lab 4 & 5', organizer: 'IT & CSE Dept', description: 'Hands-on 2-day workshop on Python, Scikit-learn, TensorFlow. Certificate of participation provided. Limited seats.', seats: 60, banner: 'workshop' },
  { _id: 'ev5', title: 'Industry Expert Talk – Cloud Computing', category: 'Seminar', date: '2025-10-12', time: '2:00 PM', venue: 'Seminar Hall', organizer: 'Training & Placement Cell', description: 'Guest lecture by senior engineers from AWS India on cloud careers, certifications and real-world projects.', seats: 150, banner: 'seminar' },
  { _id: 'ev6', title: 'Hackathon 24 – Build for Bharat', category: 'Technical', date: '2025-11-01', time: '8:00 AM', venue: 'Innovation Lab', organizer: 'Entrepreneurship Cell', description: '24-hour hackathon focused on social impact problems. Teams of 3-4. Prizes for top 3 teams, cash + internship opportunities.', seats: 80, banner: 'technical' },
  { _id: 'ev7', title: "Fresher's Orientation & Talent Show", category: 'Cultural', date: '2025-09-08', time: '5:00 PM', venue: 'Main Auditorium', organizer: 'Senior Student Committee', description: 'Welcome ceremony for 1st year students with cultural performances, games, and introduction to college clubs.', seats: 400, banner: 'cultural' },
  { _id: 'ev8', title: 'NSS Blood Donation Camp', category: 'Other', date: '2025-10-18', time: '8:00 AM', venue: 'NSS Room, Admin Block', organizer: 'NSS Unit', description: 'Annual blood donation camp in collaboration with Government Hospital. All students, staff and faculty are encouraged to participate.', seats: 200, banner: 'other' },
];

const fmtEventDate = d => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

export default function Events() {
  const showToast = useToast();
  const [events, setEvents] = useState(null);
  const [filter, setFilter] = useState('All');
  const [registered, setRegistered] = useState(() => JSON.parse(localStorage.getItem('ca_registered_events') || '[]'));

  useEffect(() => {
    apiCall('/events').then(res => {
      setEvents(res.ok && res.data.events?.length ? res.data.events : DEMO_EVENTS);
    });
  }, []);

  async function toggleRegister(id) {
    let next;
    if (registered.includes(id)) {
      const res = await apiCall(`/events/${id}/register`, { method: 'DELETE' });
      if (!res.ok) { showToast(res.error || 'Failed to unregister', 'error'); return; }
      next = registered.filter(r => r !== id);
      showToast('Unregistered from event', 'info');
    } else {
      const res = await apiCall(`/events/${id}/register`, { method: 'POST', body: JSON.stringify({}) });
      if (!res.ok) { showToast(res.error || 'Registration failed', 'error'); return; }
      next = [...registered, id];
      showToast('Registered successfully! Check OD Request if you need OD.', 'success');
    }
    localStorage.setItem('ca_registered_events', JSON.stringify(next));
    setRegistered(next);
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
          const reg = registered.includes(ev._id);
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
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => toggleRegister(ev._id)}>Unregister</button>
                    </>
                  ) : (
                    <button className="btn btn-primary" style={{ padding: '7px 18px', fontSize: 13 }} onClick={() => toggleRegister(ev._id)}>Register Now</button>
                  )}
                </div>
                <div className="reg-count">👥 Capacity: {ev.seats} seats</div>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
