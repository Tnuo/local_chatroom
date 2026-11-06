const DEFAULT_UPLOAD_LIMIT = 50 * 1024 * 1024;

export async function uploadAttachment(file) {
  let limit = DEFAULT_UPLOAD_LIMIT;

  try {
    const configResponse = await fetch('/api/config');
    if (configResponse.ok) {
      const config = await configResponse.json();
      limit = config.server?.upload_limit || limit;
    }
  } catch (_) {
    // The upload endpoint remains the authoritative limit check.
  }

  if (file.size > limit) {
    throw new Error(`文件大小超过限制 (${(limit / 1024 / 1024).toFixed(0)}MB)`);
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', { method: 'POST', body: formData });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '上传失败');
  return result;
}
