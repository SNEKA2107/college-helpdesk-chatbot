const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const morgan     = require('morgan');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const app = express();

// ===== TRUST PROXY — required for correct IP resolution behind Render/Nginx =====
app.set('trust proxy', 1);

// ===== SECURITY HEADERS =====
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],  // helmet defaults to 'none', which kills the app's inline onclick handlers
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:", "blob:"],
      connectSrc:  ["'self'"],
      objectSrc:   ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));

// ===== CORS =====
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
  process.env.RENDER_EXTERNAL_URL,  // Render sets this to the service's own URL
  'https://college-helpdesk-chatbot-l4bk.onrender.com',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin requests (no Origin header) and allow listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);  // deny without throwing — a thrown error becomes a 500
  },
  credentials: true
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan('dev'));

// ===== RATE LIMITING =====
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT || '20'),
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Global limiter — all /api/* routes (authenticated or not)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute window
  max: 150,                   // 150 req/min per IP is generous for normal use
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});

// ===== MONGODB CONNECTION =====
mongoose.connect(process.env.MONGO_URI, {
  tls: true,
  tlsAllowInvalidCertificates: false,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('✅ MongoDB Atlas connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Set MONGO_URI in backend/.env and restart');
    process.exit(1);
  });

// ===== ROUTES =====
app.use('/api/', globalLimiter);   // global rate limit first

const authRouter = require('./routes/auth');
app.use('/api/auth/login',    authLimiter, authRouter);
app.use('/api/auth/register', authLimiter, authRouter);
app.use('/api/auth',          authRouter);
app.use('/api/students',  require('./routes/students'));
app.use('/api/requests',  require('./routes/requests'));
app.use('/api/leave',     require('./routes/leave'));
app.use('/api/notices',   require('./routes/notices'));
app.use('/api/chat',      require('./routes/chat'));
app.use('/api/exam',      require('./routes/exam'));
app.use('/api/fees',      require('./routes/fees'));
app.use('/api/library',   require('./routes/library'));
app.use('/api/timetable',   require('./routes/timetable'));
app.use('/api/contact',    require('./routes/contact'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/events',     require('./routes/events'));

// ===== STATIC FILES =====
app.use(express.static(path.join(__dirname, '..')));

// ===== 404 HANDLER (API routes only) =====
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ===== SPA FALLBACK =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 CampusAssist backend running on http://localhost:${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Static files: ${require('path').join(__dirname, '..')}`);
});
