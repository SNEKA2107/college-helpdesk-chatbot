const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const morgan     = require('morgan');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const app = express();

// ===== SECURITY HEADERS =====
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,   // frontend loads CDN fonts + GSAP
}));

// ===== CORS =====
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? true
    : (origin, cb) => cb(null, true),
  credentials: true
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan('dev'));

// ===== RATE LIMITING =====
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
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
});
