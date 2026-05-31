const express = require('express');
const router = express.Router();
const { getConfig, saveConfig } = require('../config');

router.get('/', (_req, res) => {
  const config = getConfig();
  res.json({
    server: config.server,
    message: config.message,
    rooms: config.rooms,
    files: config.files
  });
});

router.put('/', (req, res) => {
  try {
    const updates = req.body;
    const config = saveConfig(updates);
    res.json({ ok: true, config });
  } catch (e) {
    res.status(500).json({ error: '保存配置失败: ' + e.message });
  }
});

module.exports = router;
