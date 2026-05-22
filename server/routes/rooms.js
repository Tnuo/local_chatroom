const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { getConfig } = require('../config');
const { v4: uuidv4 } = require('uuid');

router.get('/', (_req, res) => {
  const rooms = db.prepare(`
    SELECT r.*, 
      (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id) as message_count
    FROM rooms r ORDER BY r.is_default DESC, r.created_at ASC
  `).all();
  res.json(rooms);
});

router.post('/', (req, res) => {
  const { name, created_by } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '房间名不能为空' });
  }

  const config = getConfig();
  const maxRooms = config.rooms?.max_rooms || 20;
  const count = db.prepare('SELECT COUNT(*) as cnt FROM rooms').get();

  if (count.cnt >= maxRooms) {
    return res.status(400).json({ error: `最多创建 ${maxRooms} 个房间` });
  }

  const existing = db.prepare('SELECT * FROM rooms WHERE name = ?').get(name.trim());
  if (existing) {
    return res.status(400).json({ error: '房间名已存在' });
  }

  const room = {
    id: uuidv4(),
    name: name.trim(),
    created_by: created_by || null,
    created_at: new Date().toISOString()
  };

  db.prepare('INSERT INTO rooms (id, name, created_by, created_at) VALUES (@id, @name, @created_by, @created_at)').run(room);
  res.json(room);
});

router.put('/:id', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '房间名不能为空' });
  }

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: '房间不存在' });

  const existing = db.prepare('SELECT * FROM rooms WHERE name = ? AND id != ?').get(name.trim(), req.params.id);
  if (existing) return res.status(400).json({ error: '房间名已存在' });

  db.prepare('UPDATE rooms SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  res.json({ ...room, name: name.trim() });
});

router.delete('/:id', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: '房间不存在' });
  if (room.is_default) return res.status(400).json({ error: '默认房间不能删除' });

  db.prepare('DELETE FROM messages WHERE room_id = ?').run(req.params.id);
  db.prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
