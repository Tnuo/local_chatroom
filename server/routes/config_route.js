const express = require('express');
const router = express.Router();
const { getConfig, reloadConfig } = require('../config');

router.get('/', (_req, res) => {
  const config = getConfig();
  res.json({
    server: config.server,
    rooms: config.rooms,
    files: config.files
  });
});

router.post('/reload', (_req, res) => {
  const config = reloadConfig();
  res.json({ ok: true, message: '配置已重新加载' });
});

module.exports = router;
