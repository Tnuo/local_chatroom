const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR } = require('../paths');

const onlineUsers = new Map();

function deleteMessageFile(fileUrl) {
  if (!fileUrl) return;
  const filePath = path.join(UPLOADS_DIR, fileUrl);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    socket.on('user:join', (user) => {
      if (!user || !user.id) return;
      onlineUsers.set(user.id, { ...user, socketId: socket.id });
      socket.userId = user.id;
      socket.userData = user;

      db.prepare('UPDATE users SET last_seen_at = datetime(\'now\') WHERE id = ?').run(user.id);

      io.emit('users:online', Array.from(onlineUsers.values()).map(u => ({
        id: u.id, nickname: u.nickname, avatar_color: u.avatar_color
      })));
    });

    socket.on('message:send', (data) => {
      const { roomId, type, content, file } = data;
      console.log(`[socket] message:send from ${socket.userId} room=${roomId} type=${type} content="${(content||'').substring(0,30)}"`);
      if (!roomId || !type || !socket.userId) {
        console.log('[socket] message:send REJECTED - missing roomId/type/userId', { roomId, type, userId: socket.userId });
        return;
      }

      const user = onlineUsers.get(socket.userId);
      if (!user) return;

      const msg = {
        id: uuidv4(),
        room_id: roomId,
        user_id: user.id,
        user_nickname: user.nickname,
        user_avatar_color: user.avatar_color,
        type,
        content: content || '',
        file_url: file ? file.filename : null,
        file_name: file ? file.originalname : null,
        file_size: file ? file.size : 0,
        mime_type: file ? file.mimetype : null,
        is_permanent: 0,
        created_at: new Date().toISOString()
      };

      db.prepare(`
        INSERT INTO messages (id, room_id, user_id, user_nickname, user_avatar_color,
          type, content, file_url, file_name, file_size, mime_type, is_permanent, created_at)
        VALUES (@id, @room_id, @user_id, @user_nickname, @user_avatar_color,
          @type, @content, @file_url, @file_name, @file_size, @mime_type, @is_permanent, @created_at)
      `).run(msg);

      io.to(roomId).emit('message:new', msg);
    });

    socket.on('message:delete', (data) => {
      const { messageId, userId } = data;
      if (!messageId) return;

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      if (!msg) return;
      if (msg.user_id !== userId) return;

      deleteMessageFile(msg.file_url);
      db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
      io.to(msg.room_id).emit('message:deleted', { id: messageId, room_id: msg.room_id });
    });

    socket.on('room:join', (roomId) => {
      if (!roomId) return;
      socket.join(roomId);
      socket.currentRoom = roomId;
      if (socket.userId) {
        socket.to(roomId).emit('room:user_joined', {
          roomId,
          user: onlineUsers.get(socket.userId)
        });
      }
    });

    socket.on('room:leave', (roomId) => {
      if (!roomId) return;
      socket.leave(roomId);
      if (socket.userId) {
        socket.to(roomId).emit('room:user_left', {
          roomId,
          userId: socket.userId
        });
      }
    });

    socket.on('room:rename', (data) => {
      const { roomId, name } = data;
      if (!roomId || !name || !name.trim()) return;

      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room) return;

      const existing = db.prepare('SELECT * FROM rooms WHERE name = ? AND id != ?').get(name.trim(), roomId);
      if (existing) return;

      db.prepare('UPDATE rooms SET name = ? WHERE id = ?').run(name.trim(), roomId);
      io.emit('room:renamed', { id: roomId, name: name.trim() });
    });

    socket.on('room:delete', (data) => {
      const { roomId } = data;
      if (!roomId) return;

      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room || room.is_default) return;

      db.prepare('DELETE FROM messages WHERE room_id = ?').run(roomId);
      db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
      io.emit('room:deleted', { id: roomId });
    });

    socket.on('message:permanent', (data) => {
      db.prepare('UPDATE messages SET is_permanent = ? WHERE id = ?')
        .run(data.is_permanent ? 1 : 0, data.messageId);
      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(data.messageId);
      if (msg) {
        io.to(msg.room_id).emit('message:updated', msg);
      }
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        io.emit('users:online', Array.from(onlineUsers.values()).map(u => ({
          id: u.id, nickname: u.nickname, avatar_color: u.avatar_color
        })));
      }
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });
}

module.exports = { setupSocket };
