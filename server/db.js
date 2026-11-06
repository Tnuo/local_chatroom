const Database = require('better-sqlite3');
const fs = require('fs');
const { DATA_DIR } = require('./paths');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = require('path').join(DATA_DIR, 'chat.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT,
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_nickname TEXT NOT NULL,
      user_avatar_color TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK(type IN ('text','image','file')),
      content TEXT NOT NULL DEFAULT '',
      file_url TEXT DEFAULT NULL,
      file_name TEXT DEFAULT NULL,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT DEFAULT NULL,
      is_permanent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_messages_room_time_id ON messages(room_id, julianday(created_at), id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages(content);
    CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at);
  `);

  const defaultRoom = db.prepare('SELECT id FROM rooms WHERE is_default = 1').get();
  if (!defaultRoom) {
    const { v4: uuidv4 } = require('uuid');
    db.prepare('INSERT INTO rooms (id, name, is_default) VALUES (?, ?, 1)').run(uuidv4(), '大厅');
  }
}

module.exports = { db, initDb };
