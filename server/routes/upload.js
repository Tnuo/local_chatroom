const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getConfig } = require('../config');
const { UPLOADS_DIR } = require('../paths');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

function createUpload() {
  const config = getConfig();
  return multer({
    storage,
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const allowed = config.files?.allowed_extensions || [];
      if (allowed.length === 0 || allowed.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`文件类型 ${ext} 不被允许`));
      }
    },
    limits: { fileSize: config.server?.upload_limit || 52428800 }
  });
}

router.post('/', (req, res, next) => {
  createUpload().single('file')(req, res, next);
});

router.post('/', (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }

  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

  res.json({
    filename: req.file.filename,
    originalname: originalName,
    size: req.file.size,
    mimetype: req.file.mimetype
  });
});

router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小超过限制' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  _next();
});

module.exports = router;
