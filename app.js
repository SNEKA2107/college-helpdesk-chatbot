const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

/* ===== THEME MANAGER ===== */
const THEMES = [
  { id: 'dark',  icon: '🌙', label: 'Dark' },
  { id: 'light', icon: '☀️',  label: 'Light' },
  { id: 'night', icon: '🌑', label: 'Night' },
];

function applyTheme(id) {
  document.documentElement.setAttribute('data-theme', id);
  localStorage.setItem('ca_theme', id);
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  const t = THEMES.find(function(x){ return x.id === id; }) || THEMES[0];
  const next = THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
  btn.innerHTML = t.icon + '<span class="theme-label">' + t.label + '</span>';
  btn.title = 'Switch to ' + next.label + ' mode';
}

function cycleTheme() {
  const cur = localStorage.getItem('ca_theme') || 'dark';
  const idx = THEMES.findIndex(function(t){ return t.id === cur; });
  const next = THEMES[(idx + 1) % THEMES.length];
  applyTheme(next.id);
}

(function initTheme() {
  var saved = localStorage.getItem('ca_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

/* ===== GSAP LOADER ===== */
(function loadGSAP() {
  const core = document.createElement('script');
  core.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
  core.onload = function () {
    const st = document.createElement('script');
    st.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js';
    st.onload = initAnimations;
    document.head.appendChild(st);
  };
  document.head.appendChild(core);
})();

function initAnimations() {
  gsap.registerPlugin(ScrollTrigger);

  /* Page entrance — stagger all .reveal elements */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    gsap.to(reveals, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power3.out',
      stagger: 0.08,
      delay: 0.1,
    });
  }

  /* Scroll-triggered reveals */
  document.querySelectorAll('.card, .stat-card, .step-row, table').forEach(function (el) {
    if (el.classList.contains('reveal')) return;
    gsap.fromTo(el,
      { opacity: 0, y: 24 },
      {
        opacity: 1, y: 0,
        duration: 0.65,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          once: true,
        },
      }
    );
  });

  /* Sidebar nav links subtle entrance */
  gsap.fromTo('.nav-link',
    { opacity: 0, x: -12 },
    { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out', stagger: 0.04, delay: 0.2 }
  );
}

/* ===== SIDEBAR TOGGLE ===== */
document.addEventListener('DOMContentLoaded', function () {
  const menuBtn = document.getElementById('menuBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');

  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('show');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  }

  setActiveNav();
  createToastContainer();
  if (localStorage.getItem('ca_token')) {
    updateNotifBell();
    refreshUserData();
  }

  /* Set theme button icon/label */
  applyTheme(localStorage.getItem('ca_theme') || 'dark');
});

/* ===== ACTIVE NAV ===== */
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(function (link) {
    const href = link.getAttribute('href');
    if (href === page) link.classList.add('active');
  });
}

/* ===== SOUND EFFECTS ===== */
let _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function playSound(type) {
  try {
    const ctx = _getAudioCtx();
    if (type === 'notif') {
      [[880, 0, 0.08], [1100, 0.1, 0.09]].forEach(function(args) {
        var freq = args[0], delay = args[1], dur = args[2];
        var osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = 'sine';
        var t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t); osc.stop(t + dur);
      });
    } else if (type === 'bot') {
      var osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 600; osc.type = 'sine';
      var t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.start(t); osc.stop(t + 0.13);
    }
  } catch (e) {}
}

/* ===== TOAST NOTIFICATIONS ===== */
function createToastContainer() {
  if (!document.querySelector('.toast-container')) {
    const div = document.createElement('div');
    div.className = 'toast-container';
    document.body.appendChild(div);
  }
}

function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 3500;
  const container = document.querySelector('.toast-container');
  if (!container) return;
  playSound('notif');

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + (type === 'warning' ? 'info' : type);
  toast.innerHTML = '<span>' + (icons[type] || 'ℹ️') + '</span> ' + message;
  container.appendChild(toast);

  setTimeout(function () {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(function () { toast.remove(); }, 280);
  }, duration);
}

/* ===== API HELPER ===== */
async function apiCall(endpoint, options) {
  options = options || {};
  const token = localStorage.getItem('ca_token');
  try {
    const res = await fetch(API_BASE + endpoint, Object.assign({
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        token ? { 'Authorization': 'Bearer ' + token } : {}
      ),
    }, options));
    if (res.status === 401) {
      logout();
      return { ok: false, error: 'Session expired. Please log in again.' };
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return { ok: true, data: data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ===== AUTH HELPERS ===== */
function getUser() {
  try { return JSON.parse(localStorage.getItem('ca_user') || 'null'); }
  catch (e) { return null; }
}

function setUser(user, token) {
  localStorage.setItem('ca_user', JSON.stringify(user));
  localStorage.setItem('ca_token', token);
}

function logout() {
  localStorage.removeItem('ca_user');
  localStorage.removeItem('ca_token');
  window.location.href = 'login.html';
}

// Inject logout button into topbar on all authenticated pages
document.addEventListener('DOMContentLoaded', function () {
  if (!localStorage.getItem('ca_token')) return;
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight) return;
  if (topbarRight.querySelector('.topbar-logout-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'topbar-logout-btn';
  btn.title = 'Logout';
  btn.innerHTML = '🚪 Logout';
  btn.style.cssText = 'background:var(--danger);color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-left:8px;';
  btn.onclick = logout;
  topbarRight.appendChild(btn);
});

function requireAuth() {
  const token = localStorage.getItem('ca_token');
  if (!token) { window.location.href = 'login.html'; return false; }
  return true;
}

function requireAdmin() {
  const token = localStorage.getItem('ca_token');
  if (!token) { window.location.href = 'login.html'; return false; }
  const user = getUser();
  if (!user || user.role !== 'admin') { window.location.href = 'dashboard.html'; return false; }
  return true;
}

async function updateNotifBell() {
  if (!localStorage.getItem('ca_token')) return;
  const res = await apiCall('/notices');
  if (!res.ok) return;
  const notices = res.data.notices || [];
  const read = JSON.parse(localStorage.getItem('ca_read_notices') || '[]');
  const unread = notices.filter(function (n) { return !read.includes(n._id); }).length;
  document.querySelectorAll('.notif-btn').forEach(function (btn) {
    let badge = btn.querySelector('.notif-count');
    if (unread > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notif-count';
        badge.style.cssText = 'position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border-radius:10px;min-width:18px;height:18px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 3px;line-height:1;';
        btn.style.position = 'relative';
        btn.appendChild(badge);
      }
      badge.textContent = unread > 9 ? '9+' : String(unread);
    } else {
      if (badge) badge.remove();
    }
  });
}

/* ===== FORM VALIDATION ===== */
function validateForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return true;
  let valid = true;

  form.querySelectorAll('[required]').forEach(function (el) {
    const group = el.closest('.form-group');
    const errEl = group && group.querySelector('.form-error');
    if (!el.value.trim()) {
      el.classList.add('error');
      if (errEl) { errEl.textContent = 'This field is required'; errEl.classList.add('show'); }
      valid = false;
    } else {
      el.classList.remove('error');
      if (errEl) errEl.classList.remove('show');
    }
  });
  return valid;
}

/* ===== POPULATE USER INFO ===== */
function populateUserInfo() {
  const user = getUser();
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach(function (el) { el.textContent = user.name || 'Student'; });
  document.querySelectorAll('[data-user-id]').forEach(function (el) { el.textContent = user.studentId || ''; });
  document.querySelectorAll('[data-user-initial]').forEach(function (el) {
    if (user.photo) {
      el.innerHTML = '<img src="' + user.photo + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" alt="Profile">';
    } else {
      el.innerHTML = (user.name || 'S')[0].toUpperCase();
    }
  });
}

/* fetch fresh user data and refresh avatars */
async function refreshUserData() {
  if (!localStorage.getItem('ca_token')) return;
  const res = await apiCall('/auth/me');
  if (res.ok) {
    localStorage.setItem('ca_user', JSON.stringify(res.data.user));
    populateUserInfo();
  }
}

/* ===== DATE HELPERS ===== */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

/* ===== SERVICE WORKER ===== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}

/* ===== CHATBOT LOGIC ===== */
const botReplies = {
  exam:      '📘 Semester exams start June 15, 2026. Check the Exam Info page for the full schedule.',
  fees:      '💳 Fee payment deadline is May 25, 2026. Total: ₹55,000. Check Fees page for details.',
  marksheet: '📄 Your marksheet request is currently in Processing stage. Est. 3-5 working days.',
  library:   '📚 Library is open Mon–Sat, 8 AM to 6 PM. You can borrow up to 3 books at once.',
  timetable: '📅 Your weekly timetable is available on the Timetable page.',
  leave:     '📝 Submit a leave application via the Leave Application page in the menu.',
  notice:    '🔔 Latest notices are available on the Notices page.',
  contact:   '☎ Contact the college office at +91 98765 43210 or admin@campusassist.edu',
  help:      '💡 I can help with: exam info, fees, marksheet, library, timetable, leave, notices, and contact.',
  hello:     '👋 Hello! I\'m your CampusAssist bot. How can I help you today?',
  hi:        '👋 Hi there! What do you need help with?',
  thanks:    '😊 You\'re welcome! Anything else I can help with?',
  bye:       '👋 Goodbye! Have a great day!',
};

function getBotReply(message) {
  const msg = message.toLowerCase().trim();
  for (const key in botReplies) {
    if (msg.includes(key)) return botReplies[key];
  }
  return '🤔 I\'m not sure about that. Try asking about exams, fees, marksheet, library, timetable, leave, or contact. Type <b>help</b> to see all topics.';
}
