const DEFAULT_UPLOAD_LIMIT = 50 * 1024 * 1024;

export async function uploadAttachment(file, onProgress = () => {}) {
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

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/upload');
    request.upload.addEventListener('progress', event => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100)));
    });
    request.addEventListener('load', () => {
      let result = {};
      try { result = JSON.parse(request.responseText || '{}'); } catch (_) {}
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(result.error || '上传失败'));
        return;
      }
      resolve(result);
    });
    request.addEventListener('error', () => reject(new Error('网络连接失败，请检查连接后重试')));
    request.addEventListener('abort', () => reject(new Error('上传已取消')));
    request.send(formData);
  });
}
