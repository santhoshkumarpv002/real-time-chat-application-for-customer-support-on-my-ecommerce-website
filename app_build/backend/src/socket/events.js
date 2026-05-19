/**
 * Socket.IO Event Handlers
 * Manages real-time communication between customers and agents
 *
 * Rooms:
 *   - `agents`              → All connected agents receive queue updates
 *   - `session:<sessionId>` → Both customer + assigned agent receive messages
 */

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { JWT_SECRET } = require('../middleware/authGuard');

const prisma = new PrismaClient();

// ── In-memory state for real-time routing ──────────────────────
// Maps sessionId → customer socketId (for direct messaging without DB lookup)
const customerSockets = new Map();  // sessionId → socketId
const agentSockets = new Map();     // agentId → socketId

// Rate limiting: track message counts per session
const messageCounts = new Map(); // sessionId → { count, resetTime }
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(sessionId) {
  const now = Date.now();
  const entry = messageCounts.get(sessionId);

  if (!entry || now > entry.resetTime) {
    messageCounts.set(sessionId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ── Sanitize input (strip any HTML tags) ───────────────────────
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

function registerSocketEvents(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ─────────────────────────────────────────────────────────
    // CUSTOMER EVENTS
    // ─────────────────────────────────────────────────────────

    /**
     * session:start — Customer initiates a new chat session
     * Payload: { name?: string, email?: string }
     */
    socket.on('session:start', async (data = {}) => {
      try {
        const customerName = sanitize(data.name || '') || 'Visitor';
        const customerEmail = sanitize(data.email || '') || null;

        // Create session in DB
        const session = await prisma.session.create({
          data: {
            customerName,
            customerEmail,
            status: 'QUEUED',
          },
        });

        // Create system message
        const sysMessage = await prisma.message.create({
          data: {
            sessionId: session.id,
            sender: 'SYSTEM',
            content: `${customerName} started a chat session.`,
          },
        });

        // Track the customer's socket for this session
        customerSockets.set(session.id, socket.id);

        // Join the session room
        socket.join(`session:${session.id}`);

        // Notify the customer with session info
        socket.emit('session:started', {
          session: {
            id: session.id,
            customerName,
            status: 'QUEUED',
            createdAt: session.createdAt,
          },
        });

        // Broadcast to all agents that a new session is queued
        io.to('agents').emit('session:queued', {
          session: {
            id: session.id,
            customerName,
            customerEmail,
            status: 'QUEUED',
            createdAt: session.createdAt,
            messages: [sysMessage],
            _count: { messages: 1 },
          },
        });

        console.log(`💬 New session: ${session.id} from ${customerName}`);
      } catch (err) {
        console.error('session:start error:', err);
        socket.emit('error', { message: 'Failed to start session' });
      }
    });

    /**
     * session:rejoin — Customer reconnects to existing session
     * Payload: { sessionId: string }
     */
    socket.on('session:rejoin', async (data = {}) => {
      try {
        const { sessionId } = data;
        if (!sessionId) return;

        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          include: {
            agent: { select: { id: true, name: true, avatarUrl: true } },
            messages: { orderBy: { createdAt: 'asc' } },
          },
        });

        if (!session || session.status === 'CLOSED') {
          socket.emit('session:invalid', { sessionId });
          return;
        }

        // Update tracking
        customerSockets.set(sessionId, socket.id);
        socket.join(`session:${sessionId}`);

        // Send full session state back to customer
        socket.emit('session:rejoined', { session });

        console.log(`🔄 Session rejoined: ${sessionId}`);
      } catch (err) {
        console.error('session:rejoin error:', err);
      }
    });

    /**
     * message:send (Customer) — Customer sends a message
     * Payload: { sessionId: string, content: string }
     */
    socket.on('message:send', async (data = {}) => {
      try {
        const { sessionId, content } = data;

        if (!sessionId || !content) return;

        // Rate limit check
        if (!checkRateLimit(sessionId)) {
          socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
          return;
        }

        const sanitizedContent = sanitize(content);
        if (!sanitizedContent) return;

        // Determine sender type based on whether socket is in agents room
        const isAgent = socket.rooms.has('agents');
        const sender = isAgent ? 'AGENT' : 'CUSTOMER';

        // Persist message to DB
        const message = await prisma.message.create({
          data: {
            sessionId,
            sender,
            content: sanitizedContent,
          },
        });

        // Broadcast to everyone in the session room
        io.to(`session:${sessionId}`).emit('message:received', { message });

        // If it's a customer message, also notify the agents room
        // (so agents see new messages in the queue even if not in the session room)
        if (sender === 'CUSTOMER') {
          io.to('agents').emit('session:updated', {
            sessionId,
            latestMessage: message,
          });
        }
      } catch (err) {
        console.error('message:send error:', err);
      }
    });

    /**
     * typing:start / typing:stop — Typing indicators
     * Payload: { sessionId: string }
     */
    socket.on('typing:start', (data = {}) => {
      const { sessionId } = data;
      if (!sessionId) return;

      const isAgent = socket.rooms.has('agents');
      socket.to(`session:${sessionId}`).emit('typing:indicator', {
        sessionId,
        sender: isAgent ? 'AGENT' : 'CUSTOMER',
        isTyping: true,
      });
    });

    socket.on('typing:stop', (data = {}) => {
      const { sessionId } = data;
      if (!sessionId) return;

      const isAgent = socket.rooms.has('agents');
      socket.to(`session:${sessionId}`).emit('typing:indicator', {
        sessionId,
        sender: isAgent ? 'AGENT' : 'CUSTOMER',
        isTyping: false,
      });
    });

    // ─────────────────────────────────────────────────────────
    // AGENT EVENTS (require authentication)
    // ─────────────────────────────────────────────────────────

    /**
     * agent:auth — Agent authenticates via JWT and joins agents room
     * Payload: { token: string }
     */
    socket.on('agent:auth', async (data = {}) => {
      try {
        const { token } = data;
        if (!token) {
          socket.emit('auth:error', { message: 'Token is required' });
          return;
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        socket.agentData = decoded; // Attach agent info to socket

        // Join the agents broadcast room
        socket.join('agents');

        // Track agent socket
        agentSockets.set(decoded.id, socket.id);

        socket.emit('auth:success', {
          agent: { id: decoded.id, name: decoded.name, email: decoded.email },
        });

        console.log(`🟢 Agent authenticated: ${decoded.name} (${socket.id})`);
      } catch (err) {
        socket.emit('auth:error', { message: 'Invalid or expired token' });
      }
    });

    /**
     * session:accept — Agent claims a queued session
     * Payload: { sessionId: string }
     */
    socket.on('session:accept', async (data = {}) => {
      try {
        if (!socket.agentData) {
          socket.emit('error', { message: 'Not authenticated as agent' });
          return;
        }

        const { sessionId } = data;
        if (!sessionId) return;

        // Update session in DB
        const session = await prisma.session.update({
          where: { id: sessionId },
          data: {
            status: 'ACTIVE',
            agentId: socket.agentData.id,
          },
          include: {
            agent: { select: { id: true, name: true, avatarUrl: true } },
            messages: { orderBy: { createdAt: 'asc' } },
          },
        });

        // Create system message
        const sysMessage = await prisma.message.create({
          data: {
            sessionId,
            sender: 'SYSTEM',
            content: `${socket.agentData.name} has joined the chat.`,
          },
        });

        // Agent joins the session room
        socket.join(`session:${sessionId}`);

        // Notify customer that agent has been assigned
        io.to(`session:${sessionId}`).emit('session:assigned', {
          session: {
            id: session.id,
            status: 'ACTIVE',
            agent: session.agent,
          },
        });

        // Broadcast the assignment system message
        io.to(`session:${sessionId}`).emit('message:received', {
          message: sysMessage,
        });

        // Notify all agents about queue change
        io.to('agents').emit('session:accepted', {
          sessionId,
          agentId: socket.agentData.id,
          agentName: socket.agentData.name,
        });

        // Send full session (with messages) to the accepting agent
        socket.emit('session:data', { session });

        console.log(`✅ Agent ${socket.agentData.name} accepted session ${sessionId}`);
      } catch (err) {
        console.error('session:accept error:', err);
        socket.emit('error', { message: 'Failed to accept session' });
      }
    });

    /**
     * session:close — Agent closes a session
     * Payload: { sessionId: string, tags?: string[] }
     */
    socket.on('session:close', async (data = {}) => {
      try {
        if (!socket.agentData) {
          socket.emit('error', { message: 'Not authenticated as agent' });
          return;
        }

        const { sessionId, tags } = data;
        if (!sessionId) return;

        const updateData = {
          status: 'CLOSED',
          closedAt: new Date(),
        };

        if (tags && Array.isArray(tags)) {
          updateData.tags = JSON.stringify(tags);
        }

        await prisma.session.update({
          where: { id: sessionId },
          data: updateData,
        });

        // System message
        const sysMessage = await prisma.message.create({
          data: {
            sessionId,
            sender: 'SYSTEM',
            content: 'This chat session has been closed.',
          },
        });

        io.to(`session:${sessionId}`).emit('message:received', {
          message: sysMessage,
        });

        io.to(`session:${sessionId}`).emit('session:closed', { sessionId });

        // Notify agents room
        io.to('agents').emit('session:closed', { sessionId });

        // Cleanup
        customerSockets.delete(sessionId);

        console.log(`🔴 Session closed: ${sessionId}`);
      } catch (err) {
        console.error('session:close error:', err);
      }
    });

    /**
     * message:read — Mark a message as read
     * Payload: { messageId: string }
     */
    socket.on('message:read', async (data = {}) => {
      try {
        const { messageId } = data;
        if (!messageId) return;

        const message = await prisma.message.update({
          where: { id: messageId },
          data: { readAt: new Date() },
        });

        io.to(`session:${message.sessionId}`).emit('message:read', {
          messageId: message.id,
          readAt: message.readAt,
        });
      } catch (err) {
        // Silently ignore read receipt errors
      }
    });

    // ─────────────────────────────────────────────────────────
    // DISCONNECT
    // ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      // Clean up agent tracking
      if (socket.agentData) {
        agentSockets.delete(socket.agentData.id);
        console.log(`🔴 Agent disconnected: ${socket.agentData.name}`);
      }

      // Clean up customer tracking
      for (const [sessionId, socketId] of customerSockets.entries()) {
        if (socketId === socket.id) {
          customerSockets.delete(sessionId);
          break;
        }
      }

      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { registerSocketEvents };
