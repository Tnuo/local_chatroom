const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4'];

router.post('/register', (req, res) => {
  const { nickname } = req.body;
  if (!nickname || !nickname.trim()) {
    return res.status(400).json({ error: '昵称不能为空' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE nickname = ?').get(nickname.trim());
  if (existing) {
    db.prepare('UPDATE users SET last_seen_at = datetime(\'now\') WHERE id = ?').run(existing.id);
    return res.json(existing);
  }

  const user = {
    id: uuidv4(),
    nickname: nickname.trim(),
    avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)],
    last_seen_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO users (id, nickname, avatar_color, last_seen_at, created_at)
    VALUES (@id, @nickname, @avatar_color, @last_seen_at, @created_at)
  `).run(user);

  res.json(user);
});

router.get('/', (_req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY last_seen_at DESC').all();
  res.json(users);
});

router.put('/:id/heartbeat', (req, res) => {
  db.prepare('UPDATE users SET last_seen_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
