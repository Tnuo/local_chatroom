const path = require('path');
const fs = require('fs');

function getBaseDir() {
  const cwd = process.cwd();
  const hasConfigDir = fs.existsSync(path.join(cwd, 'config'));
  if (hasConfigDir) return cwd;
  const parent = path.dirname(cwd);
  const parentHasConfig = fs.existsSync(path.join(parent, 'config'));
  if (parentHasConfig) return parent;
  return cwd;
}

const baseDir = getBaseDir();

const CONFIG_PATH = path.join(baseDir, 'config', 'config.yaml');
const DATA_DIR = path.join(baseDir, 'data');
const UPLOADS_DIR = path.join(baseDir, 'uploads');
const CLIENT_DIST = path.join(baseDir, 'client', 'dist');

module.exports = { baseDir, CONFIG_PATH, DATA_DIR, UPLOADS_DIR, CLIENT_DIST };
