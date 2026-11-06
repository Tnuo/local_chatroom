const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { UPLOADS_DIR } = require('../paths');

const MEDIA_FILTER = `file_url IS NOT NULL AND (
  type = 'image'
  OR lower(COALESCE(mime_type, '')) LIKE 'image/%'
  OR lower(COALESCE(mime_type, '')) LIKE 'video/%'
)`;

function toMediaItem(message) {
  const mime = String(message.mime_type || '').toLowerCase();
  const extension = path.extname(message.file_name || '').toLowerCase();
  let mediaType = 'file';
  if (message.type === 'image' || mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.heic', '.heif'].includes(extension)) {
    mediaType = 'image';
  } else if (mime.startsWith('video/') || ['.mp4', '.webm', '.mov', '.m4v', '.ogv'].includes(extension)) {
    mediaType = 'video';
  }
  return {
    id: message.id,
    src: `/uploads/${message.file_url}`,
    type: mediaType,
    name: message.file_name || '',
    mime_type: message.mime_type || '',
    created_at: message.created_at
  };
}

router.get('/:roomId/media', (req, res) => {
  const { roomId } = req.params;
  const limit = Math.max(2, Math.min(80, Number.parseInt(req.query.limit, 10) || 40));
  const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
  if (!room) return res.status(404).json({ error: '聊天室不存在' });

  const cursor = req.query.beforeCreatedAt
    ? { time: req.query.beforeCreatedAt, id: String(req.query.beforeId || '') }
    : req.query.afterCreatedAt
      ? { time: req.query.afterCreatedAt, id: String(req.query.afterId || '') }
      : null;

  if (req.query.around) {
    const selected = db.prepare(`SELECT * FROM messages WHERE room_id = ? AND id = ? AND ${MEDIA_FILTER}`).get(roomId, req.query.around);
    if (!selected) return res.status(404).json({ error: '媒体不存在' });

    const beforeCount = Math.floor((limit - 1) / 2);
    const afterCount = limit - beforeCount - 1;
    const beforeRows = db.prepare(`
      SELECT * FROM messages WHERE room_id = ? AND ${MEDIA_FILTER}
        AND (julianday(created_at) < julianday(?) OR (julianday(created_at) = julianday(?) AND id < ?))
      ORDER BY julianday(created_at) DESC, id DESC LIMIT ?
    `).all(roomId, selected.created_at, selected.created_at, selected.id, beforeCount + 1);
    const afterRows = db.prepare(`
      SELECT * FROM messages WHERE room_id = ? AND ${MEDIA_FILTER}
        AND (julianday(created_at) > julianday(?) OR (julianday(created_at) = julianday(?) AND id > ?))
      ORDER BY julianday(created_at) ASC, id ASC LIMIT ?
    `).all(roomId, selected.created_at, selected.created_at, selected.id, afterCount + 1);

    const older = beforeRows.slice(0, beforeCount).reverse();
    const newer = afterRows.slice(0, afterCount);
    const rows = [...older, selected, ...newer];
    return res.json({
      items: rows.map(toMediaItem),
      hasOlder: beforeRows.length > beforeCount,
      hasNewer: afterRows.length > afterCount
    });
  }

  if (cursor?.time && cursor.id) {
    const isBefore = Boolean(req.query.beforeCreatedAt);
    const comparison = isBefore ? '<' : '>';
    const order = isBefore ? 'DESC' : 'ASC';
    const rows = db.prepare(`
      SELECT * FROM messages WHERE room_id = ? AND ${MEDIA_FILTER}
        AND (julianday(created_at) ${comparison} julianday(?) OR (julianday(created_at) = julianday(?) AND id ${comparison} ?))
      ORDER BY julianday(created_at) ${order}, id ${order} LIMIT ?
    `).all(roomId, cursor.time, cursor.time, cursor.id, limit + 1);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    if (isBefore) page.reverse();
    return res.json({ items: page.map(toMediaItem), hasMore });
  }

  const rows = db.prepare(`
    SELECT * FROM messages WHERE room_id = ? AND ${MEDIA_FILTER}
    ORDER BY julianday(created_at) DESC, id DESC LIMIT ?
  `).all(roomId, limit + 1);
  const hasOlder = rows.length > limit;
  return res.json({ items: rows.slice(0, limit).reverse().map(toMediaItem), hasOlder, hasNewer: false });
});

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
