require('dotenv').config();
const express   = require('express');
const http      = require('http');
const cors      = require('cors');
const { Server } = require('socket.io');
const connectDB  = require('./config/db');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 5000;

// ── CORS origins ─────────────────────────────────────────────────────────────
// In production set ALLOWED_ORIGINS in your Render/Railway env vars:
//   ALLOWED_ORIGINS=https://your-app.vercel.app,https://custom-domain.com
// In development it falls back to localhost.
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

const corsOptions = {
  origin: (origin, cb) => {
    // Allow no-origin requests (Postman, curl, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    console.warn(`[CORS] blocked: ${origin}`);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
};

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout:  60000,
  pingInterval: 25000,
  // Allow both WebSocket and long-polling so Render's free tier works
  transports: ['websocket', 'polling'],
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (_, res) => res.json({
  message: 'NexusCode API running',
  version: '1.0.0',
  env:     process.env.NODE_ENV || 'development',
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/room',  require('./routes/room'));
app.use('/api/run',   require('./routes/run'));
app.use('/api/chat',  require('./routes/chat'));
app.use('/api/file',  require('./routes/file'));
app.use('/api/files', require('./routes/file'));

// ── Socket.IO service ─────────────────────────────────────────────────────────
require('./services/socketService')(io);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 NexusCode backend`);
    console.log(`   Port    : ${PORT}`);
    console.log(`   Env     : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   CORS    : ${ALLOWED_ORIGINS.join(', ')}\n`);
  });
});
