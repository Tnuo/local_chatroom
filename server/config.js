const fs = require('fs');
const yaml = require('js-yaml');
const { CONFIG_PATH } = require('./paths');

let _config = null;

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    _config = yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } else {
    _config = getDefaults();
  }
  return _config;
}

function getDefaults() {
  return {
    server: { port: 3000, upload_limit: 52428800 },
    message: { retention_days: 30, cleanup_time: '03:00', page_size: 50 },
    rooms: { default: '大厅', max_rooms: 20 }
  };
}

function getConfig() {
  if (!_config) loadConfig();
  return _config;
}

function reloadConfig() {
  _config = null;
  return loadConfig();
}

function saveConfig(updates) {
  const config = getConfig();
  const currentConfig = { ...config };
  delete currentConfig.files;
  const merged = {
    ...currentConfig,
    server: { ...config.server, ...(updates.server || {}) },
    message: { ...config.message, ...(updates.message || {}) },
    rooms: { ...config.rooms, ...(updates.rooms || {}) }
  };
  fs.writeFileSync(CONFIG_PATH, yaml.dump(merged, { lineWidth: -1 }), 'utf8');
  _config = merged;
  return merged;
}

module.exports = { getConfig, reloadConfig, saveConfig };
