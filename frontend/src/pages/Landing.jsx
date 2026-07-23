import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useTheme } from '../hooks/useTheme';
import '../styles/landing.css';

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  { icon: '💬', cls: 'fi-blue', title: 'AI Chatbot Support', text: 'Get instant answers to your queries about exams, fees, library and more through our intelligent campus bot.' },
  { icon: '📄', cls: 'fi-green', title: 'Request Tracking', text: 'Submit and track all your document requests — marksheets, bonafide certificates, and more with real-time status updates.' },
  { icon: '📘', cls: 'fi-purple', title: 'Exam Information', text: 'Stay updated with exam schedules, hall ticket downloads, practical exam dates, and important instructions.' },
  { icon: '💳', cls: 'fi-orange', title: 'Fee Management', text: 'View semester fee breakdown, payment status, due dates and payment history — all in one place.' },
  { icon: '📝', cls: 'fi-pink', title: 'Leave & OD Requests', text: 'Submit medical, personal, or On Duty (OD) requests online — competitions, seminars, industrial visits — and track approval in real time.' },
  { icon: '📚', cls: 'fi-teal', title: 'Library Access', text: 'Search the book catalog, check borrowed books, see due dates, and get library hours at a glance.' },
  { icon: '✅', cls: 'fi-green', title: 'Attendance Tracker', text: 'View subject-wise attendance percentage, track present/absent/late days, and get alerts when attendance drops below 75%.' },
  { icon: '🎯', cls: 'fi-blue', title: 'CGPA Calculator', text: 'Calculate semester-wise GPA and cumulative CGPA using the 10-point grading scale. Saved automatically for your reference.' },
  { icon: '🎉', cls: 'fi-orange', title: 'College Events', text: 'Discover and register for upcoming technical, cultural, sports, workshops and seminar events happening on campus.' },
  { icon: '👤', cls: 'fi-purple', title: 'Student Profile', text: 'Manage your profile photo, update parent details, change your password, and keep your account information current.' },
];

const HIW_STEPS = [
  { num: '01', title: 'Create Your Account', text: 'Register with your student ID and college email to create your personal CampusAssist account securely.' },
  { num: '02', title: 'Access All Services', text: 'Browse your personalized dashboard to access exam info, fees, timetable, library, notices and more.' },
  { num: '03', title: 'Track & Get Help', text: 'Track your requests, chat with the helpdesk bot, apply for leave, and stay on top of everything.' },
];

// Honest product highlights — capability descriptions, NOT fabricated reviews or ratings.
const HIGHLIGHTS = [
  { icon: '📄', title: 'Requests & Leave', tag: 'Student workflow', text: 'Submit and track document requests, leave and OD applications online — no more queuing at the admin office.' },
  { icon: '💬', title: 'AI Chatbot', tag: 'Always available', text: 'Ask the campus bot about exams, fees and library hours and get instant, data-backed answers any time.' },
  { icon: '🎯', title: 'Student Dashboard', tag: 'All-in-one', text: 'Check attendance, marks, CGPA, timetable and fees from a single personalized dashboard.' },
];

const HERO_CARDS = [
  { icon: '📘', title: 'Exam Schedule', text: 'View dates & hall tickets' },
  { icon: '💳', title: 'Fee Status', text: 'Track payments & dues' },
  { icon: '📄', title: 'Marksheet', text: 'Track request status' },
  { icon: '💬', title: 'Bot Support', text: 'Available 24 / 7 for help' },
];

// Product attributes — true statements, not invented metrics.
const STATS = [
  { value: 'All-in-One', label: 'Campus Services' },
  { value: 'Real-Time', label: 'Request Tracking' },
  { value: 'Secure', label: 'Auth & Roles' },
  { value: '24/7', label: 'AI Chatbot' },
];

function smoothScroll(e, selector) {
  e.preventDefault();
  document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
}

export default function Landing() {
  const navigate = useNavigate();
  const { current, next, cycle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);
  const loaderRef = useRef(null);
  const loaderCountRef = useRef(null);
  const loaderBarRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const loader = loaderRef.current;
    let ctx;
    let statObserver;
    const statTimers = [];

    // Loading screen: count to 100, then fade out and start page animations
    let val = 0;
    const tick = setInterval(() => {
      val += Math.floor(Math.random() * 4) + 1;
      if (val >= 100) val = 100;
      if (loaderCountRef.current) loaderCountRef.current.textContent = val;
      if (loaderBarRef.current) loaderBarRef.current.style.width = val + '%';
      if (val >= 100) {
        clearInterval(tick);
        setTimeout(() => {
          gsap.to(loader, { opacity: 0, duration: 0.7, ease: 'power2.inOut', onComplete: () => { loader.style.display = 'none'; } });
          initPage();
        }, 200);
      }
    }, 18);

    function initPage() {
      ctx = gsap.context(() => {
        gsap.from('.hero-badge', { opacity: 0, y: 20, duration: 0.8, delay: 0.1, ease: 'power3.out' });
        gsap.from('.hero h1', { opacity: 0, y: 30, duration: 0.9, delay: 0.2, ease: 'power3.out' });
        gsap.from('.hero-content > p', { opacity: 0, y: 20, duration: 0.8, delay: 0.35, ease: 'power3.out' });
        gsap.from('.hero-actions', { opacity: 0, y: 20, duration: 0.7, delay: 0.5, ease: 'power3.out' });
        gsap.from('.hero-trust', { opacity: 0, y: 15, duration: 0.6, delay: 0.65, ease: 'power3.out' });
        gsap.from('.hero-card', { opacity: 0, y: 40, duration: 0.7, delay: 0.3, stagger: 0.12, ease: 'power3.out' });

        gsap.from('.stat-item', {
          opacity: 0, y: 30, duration: 0.7, stagger: 0.1, ease: 'power2.out',
          scrollTrigger: { trigger: '.stats-bar', start: 'top 85%', once: true },
        });
        gsap.from('.feature-card', {
          opacity: 0, y: 40, duration: 0.7, stagger: 0.08, ease: 'power2.out',
          scrollTrigger: { trigger: '.features-grid', start: 'top 80%', once: true },
        });
        gsap.from('.hiw-step', {
          opacity: 0, y: 40, duration: 0.7, stagger: 0.15, ease: 'power2.out',
          scrollTrigger: { trigger: '.hiw-grid', start: 'top 80%', once: true },
        });
        gsap.from('.testi-card', {
          opacity: 0, y: 40, duration: 0.7, stagger: 0.12, ease: 'power2.out',
          scrollTrigger: { trigger: '.testimonials-grid', start: 'top 80%', once: true },
        });
        gsap.from('.cta-inner', {
          opacity: 0, y: 30, duration: 0.8, ease: 'power2.out',
          scrollTrigger: { trigger: '.cta', start: 'top 80%', once: true },
        });
        root.querySelectorAll('.section-head').forEach(el => {
          gsap.from(el, {
            opacity: 0, y: 30, duration: 0.8, ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          });
        });
      }, root);

      // Stat counter animation
      statObserver = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            root.querySelectorAll('.stat-item h3').forEach(el => {
              const raw = el.textContent;
              const num = parseInt(raw) || 0;
              const suffix = raw.replace(/[0-9]/g, '');
              if (!num) return;
              let cur = 0;
              const step = Math.ceil(num / 40);
              const t = setInterval(() => {
                cur = Math.min(cur + step, num);
                el.textContent = cur + suffix;
                if (cur >= num) clearInterval(t);
              }, 28);
              statTimers.push(t);
            });
            statObserver.disconnect();
          }
        });
      }, { threshold: 0.5 });
      const sb = root.querySelector('.stats-bar');
      if (sb) statObserver.observe(sb);
    }

    return () => {
      clearInterval(tick);
      statTimers.forEach(clearInterval);
      statObserver?.disconnect();
      ctx?.revert();
    };
  }, []);

  return (
    <div className="landing" ref={rootRef}>
      {/* LOADING SCREEN */}
      <div id="loader" ref={loaderRef}>
        <span id="loader-count" ref={loaderCountRef}>0</span>
        <div id="loader-bar" ref={loaderBarRef}></div>
      </div>

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-pill">
          <div className="nav-logo">
            <div className="nav-logo-icon">🎓</div>
            <h1>CampusAssist</h1>
          </div>
          <div className="nav-links">
            <a href="#features" onClick={e => smoothScroll(e, '#features')}>Features</a>
            <a href="#how" onClick={e => smoothScroll(e, '#how')}>How It Works</a>
            <a href="#testimonials" onClick={e => smoothScroll(e, '#testimonials')}>Highlights</a>
            <Link to="/contact">Contact</Link>
          </div>
          <div className="nav-actions">
            <button
              onClick={cycle}
              title={`Switch to ${next.label} mode`}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 30, padding: '8px 14px', fontSize: 15, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', transition: 'all .2s' }}
            >
              {current.icon} <span style={{ fontSize: 12, fontWeight: 600 }}>{current.label}</span>
            </button>
            <button className="btn-nav-login" onClick={() => navigate('/login')}>Login</button>
            <button className="btn-nav-reg" onClick={() => navigate('/register')}>Register Free</button>
          </div>
          <button className="hamburger" aria-label="Menu" onClick={() => setMenuOpen(o => !o)}>
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>

      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <a href="#features" onClick={e => { smoothScroll(e, '#features'); setMenuOpen(false); }}>Features</a>
        <a href="#how" onClick={e => { smoothScroll(e, '#how'); setMenuOpen(false); }}>How It Works</a>
        <a href="#testimonials" onClick={e => { smoothScroll(e, '#testimonials'); setMenuOpen(false); }}>Highlights</a>
        <Link to="/contact">Contact</Link>
        <div className="m-btns">
          <button className="btn-nav-login" onClick={() => navigate('/login')} style={{ flex: 1, borderRadius: 8, padding: 11, color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent' }}>Login</button>
          <button className="btn-nav-reg" onClick={() => navigate('/register')} style={{ flex: 1, borderRadius: 8, padding: 11 }}>Register</button>
        </div>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="hero-glow"></div>
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-badge">🚀 Smart College Helpdesk v2.0</div>
            <h1>Simplify Your <em>College Life,</em> One Click at a Time</h1>
            <p>CampusAssist brings all your academic services together — exam info, fee tracking, marksheet status, leave applications, chatbot support, and more.</p>
            <div className="hero-actions">
              <button className="btn-hero-primary" onClick={() => navigate('/register')}>Get Started Free →</button>
              <button className="btn-hero-outline" onClick={() => navigate('/login')}>Student Login</button>
            </div>
            <div className="hero-trust">
              <div className="trust-avatars">
                <span>📘</span><span>💳</span><span>📝</span><span>💬</span>
              </div>
              <p className="hero-trust-text">All your campus services in one place</p>
            </div>
          </div>
          <div className="hero-visual">
            {HERO_CARDS.map(c => (
              <div key={c.title} className="hero-card">
                <div className="hero-card-icon">{c.icon}</div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLE SELECTION — choose a portal */}
      <section className="features" id="portals" style={{ paddingBottom: 0 }}>
        <div className="section-head">
          <span className="section-label">Portals</span>
          <h2>Choose Your <em>Portal</em></h2>
          <p>CampusAssist serves students, faculty and administrators — pick the portal that's yours.</p>
        </div>
        <div className="features-grid" style={{ maxWidth: 980, margin: '0 auto' }}>
          {[
            { icon: '🎓', cls: 'fi-blue',   title: 'Student', text: 'Attendance, CGPA, results, fees, timetable, leave & OD, events and the AI assistant.', role: 'student' },
            { icon: '👨‍🏫', cls: 'fi-green', title: 'Faculty', text: 'Mark attendance, enter & publish marks, approve leave/OD, post notices and view your classes.', role: 'faculty' },
            { icon: '👨‍💼', cls: 'fi-purple', title: 'Admin', text: 'Manage students, marks, attendance, notices, events, timetables, users and audits.', role: 'admin' },
          ].map(p => (
            <button
              key={p.role}
              type="button"
              className="feature-card"
              onClick={() => navigate(p.role === 'faculty' ? '/faculty/login' : `/login?role=${p.role}`)}
              style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', border: 'none', width: '100%' }}
            >
              <div className={`feature-icon ${p.cls}`}>{p.icon}</div>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
              <span style={{ marginTop: 12, display: 'inline-block', color: 'var(--primary)', fontWeight: 700, fontSize: 14 }}>Go to {p.title} Login →</span>
            </button>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="stats-bar">
        <div className="stats-bar-inner">
          {STATS.map(s => (
            <div key={s.label} className="stat-item"><h3>{s.value}</h3><p>{s.label}</p></div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="features" id="features">
        <div className="section-head">
          <span className="section-label">Features</span>
          <h2>Everything You Need <em>in One Place</em></h2>
          <p>From chatbot support to marksheet tracking, CampusAssist covers every student need.</p>
        </div>
        <div className="features-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="feature-card">
              <div className={`feature-icon ${f.cls}`}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="hiw" id="how">
        <div className="hiw-inner">
          <div className="section-head">
            <span className="section-label">How It Works</span>
            <h2>Up and Running in <em>3 Simple Steps</em></h2>
            <p>Getting started with CampusAssist takes less than 2 minutes.</p>
          </div>
          <div className="hiw-grid">
            {HIW_STEPS.map(s => (
              <div key={s.num} className="hiw-step">
                <div className="hiw-step-num">{s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="testimonials" id="testimonials">
        <div className="section-head">
          <span className="section-label">Highlights</span>
          <h2>Built for <em>Real Student Needs</em></h2>
          <p>Every capability below maps to an everyday campus task — no fluff.</p>
        </div>
        <div className="testimonials-grid">
          {HIGHLIGHTS.map(h => (
            <div key={h.title} className="testi-card">
              <p>{h.text}</p>
              <div className="testi-author">
                <div className="testi-avatar">{h.icon}</div>
                <div className="testi-author-info">
                  <h4>{h.title}</h4>
                  <span>{h.tag}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="cta-glow"></div>
        <div className="cta-inner">
          <h2>Ready to <em>Get Started?</em></h2>
          <p>Bring all your campus services together in one secure student portal — built for the way you actually study.</p>
          <div className="cta-actions">
            <button className="btn-cta-primary" onClick={() => navigate('/register')}>Register Now — It's Free</button>
            <button className="btn-cta-outline" onClick={() => navigate('/login')}>Already a member? Login</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="logo-wrap">
                <div className="logo-icon">🎓</div>
                <span className="logo-text">CampusAssist</span>
              </div>
              <p>Smart College Helpdesk System. Connecting students to services that matter.</p>
            </div>
            <div className="footer-col">
              <h4>Quick Links</h4>
              <ul>
                <li><Link to="/dashboard">Dashboard</Link></li>
                <li><Link to="/attendance">Attendance</Link></li>
                <li><Link to="/cgpa">CGPA Calculator</Link></li>
                <li><Link to="/exam">Exam Info</Link></li>
                <li><Link to="/fees">Fee Information</Link></li>
                <li><Link to="/library">Library</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Services</h4>
              <ul>
                <li><Link to="/requests">My Requests</Link></li>
                <li><Link to="/leave">Leave Application</Link></li>
                <li><Link to="/od">OD Request</Link></li>
                <li><Link to="/events">Events</Link></li>
                <li><Link to="/status">Marksheet Status</Link></li>
                <li><Link to="/notices">Notices</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Support</h4>
              <ul>
                <li><Link to="/chat">Chat with Bot</Link></li>
                <li><Link to="/contact">Contact Office</Link></li>
                <li><Link to="/login">Student Login</Link></li>
                <li><Link to="/register">Register</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 CampusAssist. All rights reserved.</p>
            <div className="footer-social">
              <a href="#" onClick={e => e.preventDefault()}>📘</a>
              <a href="#" onClick={e => e.preventDefault()}>🐦</a>
              <a href="#" onClick={e => e.preventDefault()}>📸</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
