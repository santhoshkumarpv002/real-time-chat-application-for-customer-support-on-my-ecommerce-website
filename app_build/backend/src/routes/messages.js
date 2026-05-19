/**
 * Message Routes — Chat message history
 * GET /api/v1/sessions/:id/messages — Get full message history for a session
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authGuard } = require('../middleware/authGuard');

const router = express.Router();
const prisma = new PrismaClient();

// ── Get Messages for a Session ─────────────────────────────────
router.get('/:id/messages', authGuard, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify session exists
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = await prisma.message.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
