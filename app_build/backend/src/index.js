/**
 * Entry Point — Express + Socket.IO Bootstrap
 * Real-Time Customer Support Chat Backend
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Route imports
const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const messageRoutes = require('./routes/messages');

// Socket handler
const { registerSocketEvents } = require('./socket/events');

const app = express();
const server = http.createServer(app);

// ── CORS Configuration ─────────────────────────────────────────
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

app.use(express.json());

const path = require('path');
app.use('/widget', express.static(path.join(__dirname, '../../widget')));

// ── Rate Limiting (API) ────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api', apiLimiter);

// ── REST Routes ────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/sessions', messageRoutes);

// ── Health Check ───────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Socket.IO Server ──────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Allow all origins for the widget (it can be on any domain)
  allowEIO3: true,
});

// Register all socket event handlers
registerSocketEvents(io);

// ── Start Server ───────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`\n  🚀 Support Chat Backend running on http://localhost:${PORT}`);
  console.log(`  📡 Socket.IO listening for connections`);
  console.log(`  🔗 CORS origins: ${corsOrigins.join(', ')}\n`);
});
