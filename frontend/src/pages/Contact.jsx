import { useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { getUser } from '../services/auth';
import { useToast } from '../hooks/useToast';

const OFFICES = [
  { icon: '🏫', name: 'Admin Office', room: 'Room 101, Administrative Block', phone: '+91 98765 43210', phoneColor: 'var(--primary)', email: 'admin@campusassist.edu', hours: 'Mon–Fri: 9 AM – 5 PM', border: 'var(--primary)' },
  { icon: '📘', name: 'Examination Cell', room: 'Room 205, Academic Block', phone: '+91 98765 43211', phoneColor: 'var(--secondary)', email: 'exam@campusassist.edu', hours: 'Mon–Fri: 10 AM – 4 PM', border: 'var(--secondary)' },
  { icon: '💳', name: 'Accounts Office', room: 'Room 102, Administrative Block', phone: '+91 98765 43212', phoneColor: 'var(--warning)', email: 'accounts@campusassist.edu', hours: 'Mon–Fri: 9 AM – 3 PM', border: 'var(--warning)' },
  { icon: '🏥', name: 'Student Welfare', room: 'Room 110, Administrative Block', phone: '+91 98765 43213', phoneColor: '#ec4899', email: 'welfare@campusassist.edu', hours: 'Mon–Sat: 9 AM – 5 PM', border: '#ec4899' },
  { icon: '📚', name: 'Library', room: 'Central Library Building', phone: '+91 98765 43214', phoneColor: '#06b6d4', email: 'library@campusassist.edu', hours: 'Mon–Sat: 8 AM – 6 PM', border: '#06b6d4' },
  { icon: '🚨', name: 'Security & Emergency', room: 'Main Gate, Campus', phone: '+91 98765 43200', phoneColor: 'var(--danger)', email: 'security@campusassist.edu', hours: '24 / 7 Available', border: '#8b5cf6' },
];

const DEPARTMENTS = ['Admin Office', 'Examination Cell', 'Accounts Office', 'Student Welfare', 'Library', 'HOD – IT Department', 'HOD – CSE Department'];

const FAQS = [
  ['How do I download my Hall Ticket?', 'Log in to CampusAssist, go to Exam Info page, and click "Download Hall Ticket". Hall tickets are available from June 10, 2026 onwards.'],
  ['How long does a marksheet request take?', 'Normal marksheet requests take 5–7 working days. Urgent requests (with additional fee) take 2–3 working days. You can track the status on the Marksheet Status page.'],
  ['What is the fee payment mode?', 'Fees can be paid online via Net Banking, UPI (GPay, Paytm, PhonePe), or Debit/Credit cards. Cash payments are accepted at the Accounts Office only.'],
  ['How do I apply for a scholarship?', 'Visit the Student Welfare office with your income certificate, previous year marksheet, and a filled application form. Scholarship applications are accepted every academic year by June 5.'],
  ['Can I renew library books online?', 'Yes! Library book renewal can be requested through the Library page in CampusAssist. You can renew up to 2 times per book, provided no one else has reserved the same book.'],
];

export default function Contact() {
  const showToast = useToast();
  const user = getUser();
  const [form, setForm] = useState({
    name: user?.name || '', id: user?.studentId || '', email: '',
    dept: '', subject: '', message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  async function sendMessage() {
    if (!form.dept) { showToast('Please select a department', 'error'); return; }
    if (!form.subject.trim()) { showToast('Please enter a subject', 'error'); return; }
    if (!form.message.trim()) { showToast('Please write your message', 'error'); return; }

    setSending(true);
    const res = await apiCall('/contact', {
      method: 'POST',
      body: JSON.stringify({ department: form.dept, subject: form.subject.trim(), message: form.message.trim() }),
    });
    setSending(false);
    if (res.ok) setSent(true);
    else showToast(res.error || 'Failed to send message. Please try again.', 'error');
  }

  function resetContact() {
    setForm(f => ({ ...f, dept: '', subject: '', message: '' }));
    setSent(false);
  }

  return (
    <Layout title="Contact Office">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Contact Office</h2>
          <p>Reach out to college departments and send a direct message</p>
        </div>
      </div>

      <div className="grid-3 mb-6">
        {OFFICES.map(o => (
          <div key={o.name} className="card" style={{ textAlign: 'center', borderTop: `3px solid ${o.border}` }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>{o.icon}</div>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{o.name}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{o.room}</p>
            <div style={{ fontSize: 14, fontWeight: 600, color: o.phoneColor }}>{o.phone}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{o.email}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{o.hours}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><div className="card-title">✉️ Send a Message</div></div>
          {!sent ? (
            <div>
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input type="text" className="form-input" placeholder="Full name" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Student ID</label>
                <input type="text" className="form-input" placeholder="Register number" value={form.id} onChange={e => set('id', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" placeholder="your@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Department / Office</label>
                <select className="form-select" style={{ paddingLeft: 14 }} value={form.dept} onChange={e => set('dept', e.target.value)}>
                  <option value="">Select department</option>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input type="text" className="form-input" placeholder="Brief subject of your query" value={form.subject} onChange={e => set('subject', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea className="form-textarea" placeholder="Describe your query in detail…" value={form.message} onChange={e => set('message', e.target.value)}></textarea>
              </div>
              <button className="btn btn-primary btn-full" onClick={sendMessage} disabled={sending}>
                {sending ? 'Sending…' : 'Send Message →'}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 14 }}>📨</div>
              <h3 style={{ fontWeight: 800, fontSize: 20, color: 'var(--dark)', marginBottom: 8 }}>Message Sent!</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Your message has been sent to the selected department. You'll receive a response within 1–2 working days.</p>
              <button className="btn btn-primary" onClick={resetContact}>Send Another Message</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">❓ Frequently Asked Questions</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQS.map(([q, a], i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%', padding: '14px 16px', textAlign: 'left', fontWeight: 600, fontSize: 14,
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--dark)',
                  }}
                >
                  {q} <span>{openFaq === i ? '–' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 16px 14px', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>{a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
