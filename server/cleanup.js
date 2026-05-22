const cron = require('node-cron');
const { db } = require('./db');
const { getConfig } = require('./config');
const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR } = require('./paths');

function runCleanup() {
  const config = getConfig();
  const retentionDays = config.message?.retention_days || 30;

  if (retentionDays <= 0) {
    console.log('[cleanup] retention_days is 0 or negative, skipping cleanup');
    return;
  }

  console.log(`[cleanup] Running cleanup - removing messages older than ${retentionDays} days...`);

  const expiredMessages = db.prepare(`
    SELECT id, file_url FROM messages
    WHERE is_permanent = 0
      AND created_at < datetime('now', '-' || ? || ' days')
  `).all(String(retentionDays));

  if (expiredMessages.length === 0) {
    console.log('[cleanup] No expired messages found');
    return;
  }

  const ids = expiredMessages.map(m => m.id);
  const idPlaceholders = ids.map(() => '?').join(',');

  const deleteStmt = db.prepare(`DELETE FROM messages WHERE id IN (${idPlaceholders})`);
  deleteStmt.run(...ids);

  for (const msg of expiredMessages) {
    if (msg.file_url) {
      const filePath = path.join(UPLOADS_DIR, msg.file_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  console.log(`[cleanup] Removed ${ids.length} expired messages`);
}

function scheduleCleanup() {
  const config = getConfig();
  const cleanupTime = config.message?.cleanup_time || '03:00';
  const [hour, minute] = cleanupTime.split(':').map(Number);

  const cronExpression = `${minute} ${hour} * * *`;
  console.log(`[cleanup] Scheduled daily cleanup at ${cleanupTime} (cron: ${cronExpression})`);

  cron.schedule(cronExpression, runCleanup);
}

module.exports = { scheduleCleanup, runCleanup };
