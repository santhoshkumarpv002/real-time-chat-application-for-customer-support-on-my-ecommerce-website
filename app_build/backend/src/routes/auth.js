/**
 * Auth Routes — Agent Login & Dev Seed
 * POST /api/v1/auth/login
 * POST /api/v1/auth/seed  (dev only)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { JWT_SECRET } = require('../middleware/authGuard');

const router = express.Router();
const prisma = new PrismaClient();

// ── Agent Login ────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const agent = await prisma.agent.findUnique({ where: { email } });

    if (!agent) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, agent.passwordHash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: agent.id, email: agent.email, name: agent.name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        avatarUrl: agent.avatarUrl,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Seed Demo Agent (dev only) ─────────────────────────────────
router.post('/seed', async (req, res) => {
  try {
    const existing = await prisma.agent.findUnique({
      where: { email: 'agent@demo.com' },
    });

    if (existing) {
      return res.json({
        message: 'Demo agent already exists',
        agent: { email: 'agent@demo.com', password: 'demo123' },
      });
    }

    const passwordHash = await bcrypt.hash('demo123', 12);

    const agent = await prisma.agent.create({
      data: {
        name: 'Alex Support',
        email: 'agent@demo.com',
        passwordHash,
        avatarUrl: null,
      },
    });

    res.json({
      message: 'Demo agent created successfully',
      agent: {
        id: agent.id,
        email: 'agent@demo.com',
        password: 'demo123',
      },
    });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: 'Failed to seed demo agent' });
  }
});

module.exports = router;
