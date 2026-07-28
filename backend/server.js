const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const morgan     = require('morgan');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// ===== ENVIRONMENT VALIDATION =====
// Required vars are checked at boot so a misconfigured deploy fails immediately
// with a clear message, instead of starting up and then returning 500s on every
// login (a missing JWT_SECRET made jwt.sign throw inside the request handler).
// Optional integrations are only warned about — the app degrades gracefully:
// no ANTHROPIC_API_KEY → the Copilot answers from the keyword/knowledge-base path;
// no EMAIL_USER/EMAIL_PASS → notification emails are skipped silently.
// On a serverless platform there is no long-lived process to restart: calling
// process.exit() there turns a readable config error into an opaque FUNCTION_
// INVOCATION_FAILED with nothing in the log. So we exit only when running as a
// real server, and otherwise keep the process alive so /api/health can report
// exactly what is missing.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missingRequired = REQUIRED_ENV.filter(k => !process.env[k] || !String(process.env[k]).trim());
if (missingRequired.length) {
  console.error(`❌ Missing required environment variable(s): ${missingRequired.join(', ')}`);
  console.error('   Set them in backend/.env locally, or in your host\'s environment settings.');
  if (!IS_SERVERLESS) process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('⚠️  ANTHROPIC_API_KEY not set — AI Copilot will use the keyword/knowledge-base fallback.');
}
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('⚠️  EMAIL_USER/EMAIL_PASS not set — notification emails will be skipped.');
}

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
// When the frontend is hosted separately (Vercel) rather than served by this
// process, every API call is cross-origin — so the deployed frontend's own URL
// must be on this list or the browser blocks the response and the UI reports
// "Cannot connect to server". Set FRONTEND_URL to the deployed frontend origin.
// EXTRA_ORIGINS accepts a comma-separated list for any additional hosts.
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
  process.env.RENDER_EXTERNAL_URL,  // Render sets this to the service's own URL
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,  // this deployment's own URL
  ...String(process.env.EXTRA_ORIGINS || '').split(',').map(s => s.trim()),
  'https://college-helpdesk-chatbot-l4bk.onrender.com',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5173',   // Vite dev server (React frontend)
  'http://localhost:4173',   // Vite preview server
  'https://localhost',       // Capacitor Android WebView
  'capacitor://localhost',   // Capacitor iOS WebView
].filter(Boolean);

// Vercel gives every preview deployment a fresh *.vercel.app hostname, so a
// static list can never cover them. Opt in with ALLOW_VERCEL_PREVIEWS=1 to let
// preview builds of the frontend talk to this API; production does not need it.
const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === '1';
const VERCEL_PREVIEW = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

function isAllowedOrigin(origin) {
  if (allowedOrigins.includes(origin)) return true;
  if (allowVercelPreviews && VERCEL_PREVIEW.test(origin)) return true;
  return false;
}

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin requests (no Origin header) and allow listed origins
    if (!origin || isAllowedOrigin(origin)) return cb(null, true);
    cb(null, false);  // deny without throwing — a thrown error becomes a 500
  },
  credentials: true
}));

// Body limit sits ABOVE the routes' own file guards (7 MB of base64 ≈ a 5 MB file,
// checked in routes/auth.js, routes/coursework.js and routes/facultyPortal.js).
// It used to be 5mb, which is *below* those guards — the parser rejected the body
// first, so every one of those friendly "file is too large" messages was
// unreachable and users got a generic error instead. Anything genuinely oversized
// still stops here and is answered with 413 by the error handler below.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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
  // 150 req/min per IP is generous for normal use. Configurable for the same
  // reason AUTH_RATE_LIMIT is: a load test drives every virtual user from a
  // single IP, so the per-IP ceiling would throttle the benchmark rather than
  // the application. The default is unchanged, so production behaviour is too.
  max: parseInt(process.env.GLOBAL_RATE_LIMIT || '150'),
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});

// ===== MONGODB CONNECTION =====
// A serverless platform freezes and reuses the module between invocations, so a
// bare top-level connect() would open a brand-new pool on every cold start and
// burn through the Atlas connection cap. Caching the promise on globalThis means
// warm invocations reuse the live connection, and concurrent cold requests all
// await the same in-flight connect instead of racing to open their own.
const MONGO_OPTIONS = {
  tls: true,
  tlsAllowInvalidCertificates: false,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  // Serverless instances are single-request; a large pool per instance is waste.
  maxPoolSize: IS_SERVERLESS ? 5 : 10,
};

const mongoCache = globalThis.__campusAssistMongo || (globalThis.__campusAssistMongo = {
  conn: null,
  promise: null,
});

function connectDB() {
  if (mongoCache.conn) return Promise.resolve(mongoCache.conn);
  if (!mongoCache.promise) {
    mongoCache.promise = mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS)
      .then(async (conn) => {
        mongoCache.conn = conn;
        console.log('✅ MongoDB Atlas connected successfully');
        // Materialise the Department collection on first boot. Idempotent, and it
        // adopts any department code already present in existing data so nothing
        // that worked before this change stops working.
        try {
          await require('./services/departments').bootstrapDepartments();
        } catch (err) {
          console.error('⚠️  Department bootstrap failed:', err.message);
        }
        return conn;
      })
      .catch(err => {
        // Clear the cached promise so the *next* request retries instead of
        // being permanently poisoned by one transient DNS/network failure.
        mongoCache.promise = null;
        throw err;
      });
  }
  return mongoCache.promise;
}

if (IS_SERVERLESS) {
  // Kick the connection off at module load so a cold start overlaps the connect
  // with the rest of the boot, but never let a rejection become an unhandled one.
  connectDB().catch(err => console.error('❌ MongoDB connection error:', err.message));
} else {
  connectDB().catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Set MONGO_URI in backend/.env and restart');
    process.exit(1);
  });
}

// ===== HEALTH CHECK =====
// Declared before the rate limiter and the DB gate so an uptime probe never
// consumes request budget and still answers while the database is unreachable.
// It reports *why* it is unhealthy, which is what makes a failed deploy
// diagnosable from the outside.
const MONGO_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
app.get('/api/health', (req, res) => {
  const dbState = MONGO_STATES[mongoose.connection.readyState] || 'unknown';
  const healthy = dbState === 'connected' && missingRequired.length === 0;
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'ok' : 'degraded',
    database: dbState,
    missingEnv: missingRequired,
    environment: process.env.NODE_ENV || 'development',
    serverless: IS_SERVERLESS,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ===== ROUTES =====
app.use('/api/', globalLimiter);   // global rate limit first

// Ensure the database is up before any route touches a model. Mongoose would
// otherwise buffer the query and fail with an opaque timeout on a cold start.
app.use('/api/', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database unavailable:', err.message);
    res.status(503).json({
      success: false,
      message: 'The service is starting up or the database is unreachable. Please retry shortly.',
    });
  }
});

const authRouter = require('./routes/auth');
app.use('/api/auth/login',    authLimiter, authRouter);
app.use('/api/auth/register', authLimiter, authRouter);
app.use('/api/auth',          authRouter);
app.use('/api/departments', require('./routes/departments'));
app.use('/api/students',  require('./routes/students'));
app.use('/api/requests',  require('./routes/requests'));
app.use('/api/leave',     require('./routes/leave'));
app.use('/api/notices',   require('./routes/notices'));
app.use('/api/chat',      require('./routes/chat'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/knowledge',     require('./routes/knowledge'));
app.use('/api/faculty',       require('./routes/faculty'));
app.use('/api/faculty-portal', require('./routes/facultyPortal'));
app.use('/api/coursework',     require('./routes/coursework'));
app.use('/api/analytics',     require('./routes/analytics'));
app.use('/api/exam',      require('./routes/exam'));
app.use('/api/fees',      require('./routes/fees'));
app.use('/api/library',   require('./routes/library'));
app.use('/api/timetable',   require('./routes/timetable'));
app.use('/api/contact',    require('./routes/contact'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/events',     require('./routes/events'));
app.use('/api/marks',      require('./routes/marks'));
app.use('/api/calendar',   require('./routes/calendar'));
app.use('/api/audit',      require('./routes/audit'));

// ===== STATIC FILES =====
// Serve ONLY the React build (frontend/dist). The legacy static site that used
// to live at the repo root has been retired — there is no fallback to it.
// When this process also serves the UI (local dev, or a single-origin host like
// Render) it serves frontend/dist. On a serverless deploy the frontend lives on
// its own host: there is no dist/ in the bundle, express.static is ignored by the
// platform anyway, and an SPA fallback here would answer API-shaped requests with
// a sendFile error. So the serverless build is deliberately API-only.
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
const SERVE_FRONTEND = !IS_SERVERLESS && require('fs').existsSync(distDir);

if (SERVE_FRONTEND) {
  app.use(express.static(distDir));
}

// ===== 404 HANDLER (API routes only) =====
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ===== SPA FALLBACK =====
app.get('*', (req, res) => {
  if (!SERVE_FRONTEND) {
    // API-only deployment: say so plainly instead of pretending to be a website.
    return res.status(404).json({
      success: false,
      message: 'This host serves the CampusAssist API only. The web app is deployed separately.',
      api: '/api',
      health: '/api/health',
    });
  }
  // A path with a file extension (e.g. /attendance.html, /style.css, /app.js)
  // that express.static did not resolve is a dead legacy asset — return 404
  // rather than the SPA shell. Extension-less paths are React client routes and
  // receive index.html so the router can render them.
  if (path.extname(req.path)) {
    return res.status(404).json({ success: false, message: `Not found: ${req.originalUrl}` });
  }
  res.sendFile(path.join(distDir, 'index.html'));
});

// ===== ERROR HANDLER =====
// A client mistake must not be reported as a server fault. body-parser attaches a
// status to the errors it raises (malformed JSON, oversized body); those used to
// fall through to a blanket 500, which both misled callers and made genuine 5xx
// alerting useless. Only unexpected failures reach the 500 branch now.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Malformed JSON body — body-parser sets type 'entity.parse.failed'.
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    return res.status(400).json({ success: false, message: 'Request body is not valid JSON.' });
  }
  // Body larger than the configured limit.
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    return res.status(413).json({
      success: false,
      message: 'Upload is too large. Please use a file under 5 MB.',
    });
  }
  // Any other error that already carries a 4xx status is the caller's problem;
  // its message is safe to surface (these come from framework-level validation).
  const status = err.status || err.statusCode;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ success: false, message: err.message || 'Bad request.' });
  }

  // Genuine server fault — log the detail, return only the safe message.
  console.error('Server error:', err.stack || err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ===== START SERVER =====
// Bind to the port the platform hands us — every PaaS injects PORT and health
// checks fail if the process listens on a hardcoded one. Serverless platforms
// invoke the exported app directly and never call listen().
const PORT = process.env.PORT || 5000;
if (!IS_SERVERLESS) {
  app.listen(PORT, () => {
    console.log(`🚀 CampusAssist backend running on http://localhost:${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📁 Static files: ${SERVE_FRONTEND ? distDir : '(API-only — frontend hosted separately)'}`);
  });
}

// Exported for serverless platforms (Vercel) and for integration tests that
// mount the app without binding a port.
module.exports = app;
