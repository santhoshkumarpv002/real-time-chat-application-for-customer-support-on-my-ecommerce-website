/**
 * Session Routes — CRUD for chat sessions
 * GET  /api/v1/sessions         — List sessions (with ?status= filter)
 * PATCH /api/v1/sessions/:id    — Update session (status, tags)
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authGuard } = require('../middleware/authGuard');

const router = express.Router();
const prisma = new PrismaClient();

// ── List Sessions ──────────────────────────────────────────────
router.get('/', authGuard, async (req, res) => {
  try {
    const { status } = req.query;

    const where = {};
    if (status) {
      where.status = status.toUpperCase();
    }

    const sessions = await prisma.session.findMany({
      where,
      include: {
        agent: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Only latest message for preview
        },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(sessions);
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ── Update Session ─────────────────────────────────────────────
router.patch('/:id', authGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, tags } = req.body;

    const data = {};

    if (status) {
      const validStatuses = ['QUEUED', 'ACTIVE', 'CLOSED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
      data.status = status.toUpperCase();

      if (data.status === 'CLOSED') {
        data.closedAt = new Date();
      }
    }

    if (tags !== undefined) {
      data.tags = JSON.stringify(tags);
    }

    const session = await prisma.session.update({
      where: { id },
      data,
      include: {
        agent: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    res.json(session);
  } catch (err) {
    console.error('Update session error:', err);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

module.exports = router;
