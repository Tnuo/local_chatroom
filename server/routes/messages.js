const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { UPLOADS_DIR } = require('../paths');

router.get('/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { limit = 50, before } = req.query;

  let query = 'SELECT * FROM messages WHERE room_id = ?';
  const params = [roomId];

  if (before) {
    query += ' AND created_at < ?';
    params.push(before);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit));

  const messages = db.prepare(query).all(...params).reverse();
  res.json(messages);
});

router.post('/:roomId/permanent/:messageId', (req, res) => {
  const { is_permanent } = req.body;
  db.prepare('UPDATE messages SET is_permanent = ? WHERE id = ?').run(is_permanent ? 1 : 0, req.params.messageId);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.messageId);
  res.json(msg);
});

router.delete('/:id', (req, res) => {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!msg) return res.status(404).json({ error: '消息不存在' });

  if (msg.file_url) {
    const filePath = path.join(UPLOADS_DIR, msg.file_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  res.json({ ok: true, room_id: msg.room_id, id: msg.id });
});

router.delete('/:roomId', (req, res) => {
  db.prepare('DELETE FROM messages WHERE room_id = ?').run(req.params.roomId);
  res.json({ ok: true });
});

module.exports = router;
