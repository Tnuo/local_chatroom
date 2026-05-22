const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/', (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.json([]);
  }

  const keyword = `%${q.trim()}%`;
  const messages = db.prepare(`
    SELECT m.*, r.name as room_name
    FROM messages m
    JOIN rooms r ON m.room_id = r.id
    WHERE m.content LIKE ?
    ORDER BY m.created_at DESC
    LIMIT 50
  `).all(keyword);

  res.json(messages);
});

module.exports = router;
