<script>
  import { createEventDispatcher } from 'svelte';
  import { getMediaKind } from '../utils/messageTypes.js';

  export let msg;
  export let isMine = false;
  export let onTogglePermanent;
  export let onDeleteMessage;
  export let onMediaPreview;
  export let isMobile = false;

  const dispatch = createEventDispatcher();

  function formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function togglePermanent() {
    const detail = { messageId: msg.id, is_permanent: !msg.is_permanent };
    dispatch('togglePermanent', detail);
    onTogglePermanent?.(detail);
  }

  function handleDelete() {
    if (window.confirm('确定删除这条消息？')) {
      onDeleteMessage?.({ messageId: msg.id });
    }
  }

  function openPreview() {
    if (msg.file_url) {
      onMediaPreview?.({ messageId: msg.id, src: '/uploads/' + msg.file_url, type: getMediaKind(msg.mime_type) });
    }
  }

  function isImage(mime) { return getMediaKind(mime) === 'image'; }
  function isVideo(mime) { return getMediaKind(mime) === 'video'; }
  function isAudio(mime) { return getMediaKind(mime) === 'audio'; }
  function isPDF(mime) { return String(mime || '').toLowerCase() === 'application/pdf'; }
</script>

<div class="msg-row" class:mine={isMine} id="msg-{msg.id}">
  {#if isMine}
    <div class="msg-avatar" style="background: {msg.user_avatar_color || '#6366f1'}">
      {msg.user_nickname?.charAt(0) || '?'}
    </div>
  {/if}
  {#if !isMine}
    <div class="msg-avatar" style="background: {msg.user_avatar_color || '#6366f1'}">
      {msg.user_nickname?.charAt(0) || '?'}
    </div>
  {/if}

  <div class="msg-body">
    {#if !isMine}
      <span class="msg-sender">{msg.user_nickname}</span>
    {/if}

    <div class="bubble" class:mine={isMine} class:permanent={msg.is_permanent}>
      {#if msg.type === 'image' && isImage(msg.mime_type)}
        <button class="media-trigger" on:click={openPreview} aria-label="查看大图">
          <img class="msg-image" src="/uploads/{msg.file_url}" alt={msg.content} loading="lazy" />
        </button>
        {#if msg.content}
          <div class="msg-text">{msg.content}</div>
        {/if}
      {:else if (msg.type === 'file' || msg.type === 'video') && isVideo(msg.mime_type)}
        <div class="video-attachment">
          <video class="msg-video" src="/uploads/{msg.file_url}" controls preload="metadata" playsinline></video>
          <button class="video-expand" on:click={openPreview} aria-label="放大视频" title="放大视频">⛶</button>
        </div>
      {:else if (msg.type === 'file' || msg.type === 'audio') && isAudio(msg.mime_type)}
        <audio src="/uploads/{msg.file_url}" controls preload="metadata"></audio>
      {:else if msg.type === 'file'}
        <div class="file-card">
          <div class="file-icon">
            {isImage(msg.mime_type) ? '🖼' : isVideo(msg.mime_type) ? '🎬' : isAudio(msg.mime_type) ? '🎵' : isPDF(msg.mime_type) ? '📄' : '📎'}
          </div>
          <div class="file-info">
            <a class="file-name" href="/uploads/{msg.file_url}" download={msg.file_name} target="_blank">{msg.file_name}</a>
            <span class="file-size">{formatFileSize(msg.file_size)}</span>
          </div>
          {#if isImage(msg.mime_type)}
            <button class="media-trigger thumb-btn" on:click={openPreview} aria-label="查看大图">
              <img class="file-thumb" src="/uploads/{msg.file_url}" alt="" loading="lazy" />
            </button>
          {/if}
        </div>
      {:else}
        <div class="msg-text">{msg.content}</div>
      {/if}

      <div class="msg-footer">
        <span class="time">{formatTime(msg.created_at)}</span>
        {#if isMine}
          <button class="action-btn" class:mobile-show={isMobile} on:click={togglePermanent} title={msg.is_permanent ? '取消永久保存' : '永久保存'}>
            {msg.is_permanent ? '📌' : '📍'}
          </button>
          <button class="action-btn del-btn" class:mobile-show={isMobile} on:click={handleDelete} title="删除">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .msg-row {
    display: flex;
    gap: 8px;
    padding: 4px 16px;
    align-items: flex-end;
  }

  .msg-row.mine {
    flex-direction: row-reverse;
  }

  .msg-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 13px;
    flex-shrink: 0;
  }

  .msg-body {
    display: flex;
    flex-direction: column;
    max-width: 65%;
    min-width: 0;
    flex-shrink: 1;
  }

  .msg-row.mine .msg-body {
    align-items: flex-end;
  }

  .msg-sender {
    font-size: 12px;
    color: #6366f1;
    margin-bottom: 3px;
    padding: 0 6px;
    font-weight: 500;
  }

  .bubble {
    background: white;
    border-radius: 16px;
    padding: 8px 14px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    position: relative;
    min-width: 0;
    max-width: 100%;
  }

  .bubble.mine {
    background: #6366f1;
    color: white;
    border-bottom-right-radius: 6px;
  }

  .msg-row:not(.mine) .bubble {
    border-bottom-left-radius: 6px;
  }

  .bubble.permanent {
    box-shadow: 0 0 0 1.5px #f59e0b;
  }

  .msg-text {
    font-size: 15px;
    line-height: 1.45;
    word-break: break-word;
    color: #1f2937;
    white-space: pre-wrap;
  }

  .bubble.mine .msg-text {
    color: #fff;
  }

  .msg-image {
    max-width: 260px;
    max-height: 280px;
    border-radius: 8px;
    object-fit: cover;
    display: block;
    transition: opacity 0.15s;
  }

  .media-trigger {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: block;
  }

  .media-trigger:hover .msg-image {
    opacity: 0.85;
  }

  .msg-video {
    max-width: 260px;
    max-height: 280px;
    border-radius: 8px;
    background: #000;
  }

  .video-attachment {
    position: relative;
    display: inline-flex;
  }

  .video-expand {
    position: absolute;
    right: 8px;
    top: 8px;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    color: white;
    background: rgba(0, 0, 0, 0.62);
    font-size: 22px;
    cursor: pointer;
  }

  .file-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    width: 100%;
    max-width: 100%;
    background: rgba(0,0,0,0.05);
    border-radius: 10px;
    min-width: 0;
    overflow: hidden;
  }

  .bubble.mine .file-card {
    background: rgba(255,255,255,0.15);
  }

  .file-icon {
    font-size: 26px;
    flex-shrink: 0;
  }

  .file-info {
    flex: 1;
    min-width: 0;
  }

  .file-name {
    font-size: 13px;
    font-weight: 500;
    color: inherit;
    text-decoration: underline;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 3px;
  }

  .bubble.mine .file-name { color: #fff; }

  .file-size {
    font-size: 11px;
    color: #9ca3af;
  }

  .bubble.mine .file-size { color: rgba(255,255,255,0.65); }

  .thumb-btn {
    padding: 0;
    display: block;
  }

  .file-thumb {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
    transition: opacity 0.15s;
  }

  .thumb-btn:hover .file-thumb { opacity: 0.85; }

  .msg-footer {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: 2px;
    justify-content: flex-end;
  }

  .time {
    font-size: 11px;
    color: #9ca3af;
    margin-top: 2px;
  }

  .bubble.mine .time {
    color: rgba(255,255,255,0.55);
  }

  .action-btn {
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
    padding: 2px 3px;
    min-width: 24px;
    min-height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    font-size: 11px;
    color: inherit;
  }

  .bubble:hover .action-btn,
  .action-btn.mobile-show {
    opacity: 0.7;
  }

  .action-btn:hover { opacity: 1 !important; }
  .del-btn:hover { color: #fca5a5; background: rgba(239,68,68,0.2); }

  :global(.highlight) {
    animation: highlightFlash 1.5s ease-in-out;
  }

  @keyframes highlightFlash {
    0%, 100% { background-color: transparent; }
    50% { background-color: rgba(99, 102, 241, 0.12); }
  }

  @media (max-width: 768px) {
    .msg-row {
      padding: 3px 8px;
      gap: 6px;
    }

    .msg-body {
      max-width: 80%;
    }

    .bubble {
      padding: 8px 12px;
      border-radius: 14px;
    }

    .bubble.mine {
      border-bottom-right-radius: 4px;
    }

    .msg-row:not(.mine) .bubble {
      border-bottom-left-radius: 4px;
    }

    .msg-text {
      font-size: 16px;
    }

    .msg-image {
      max-width: 100%;
      max-height: 240px;
    }

    .msg-video {
      max-width: 100%;
      max-height: 240px;
    }

    .msg-avatar {
      width: 28px;
      height: 28px;
      font-size: 11px;
    }
  }
</style>
