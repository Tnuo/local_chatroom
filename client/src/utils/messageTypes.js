export const MESSAGE_TYPES = Object.freeze({
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file'
});

export function getAttachmentMessageType(mimeType = '') {
  return String(mimeType || '').toLowerCase().startsWith('image/')
    ? MESSAGE_TYPES.IMAGE
    : MESSAGE_TYPES.FILE;
}

export function getMediaKind(mimeType = '') {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('video/')) return 'video';
  if (normalized.startsWith('audio/')) return 'audio';
  return 'file';
}
