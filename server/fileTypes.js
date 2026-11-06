function normalizeExtension(value) {
  const extension = String(value ?? '').trim().toLowerCase();
  if (!extension) return '';
  return extension.startsWith('.') ? extension : `.${extension}`;
}

function normalizeExtensions(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(normalizeExtension).filter(Boolean))];
}

module.exports = { normalizeExtension, normalizeExtensions };
