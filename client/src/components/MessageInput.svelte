<script>
  export let onSend;
  export let roomId = null;
  export let isMobile = false;
  export let uploadQueue = [];
  export let onFiles;
  export let onRetryUpload;
  export let onRemoveUpload;

  let text = '';
  let sendError = '';
  let fileInput;
  let showEmoji = false;

  function sendText() {
    if (!text.trim()) return;
    sendError = '';
    try {
      onSend?.({ type: 'text', content: text.trim() });
    } catch(e) {
      sendError = '发送失败';
      console.error('[send]', e);
      return;
    }
    text = '';
    showEmoji = false;
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  }

  function handleFileSelect(e) {
    onFiles?.(Array.from(e.currentTarget.files || []));
    e.currentTarget.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    onFiles?.(Array.from(e.dataTransfer.files || []));
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = Array.from(items).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
    if (files.length) {
      e.preventDefault();
      onFiles?.(files);
    }
  }

  const EMOJIS = ['😀','😂','🤣','😍','😎','🥳','😢','😡','👍','👎','🎉','❤️','🔥','⭐','💯','✅','❌','⚡','🍕','☕','🐱','🐶','💻','📱','🎵','📷','🎮','🚀','🌈','🍀'];

  function insertEmoji(emoji) {
    text += emoji;
  }

  function toggleEmoji() {
    showEmoji = !showEmoji;
  }
</script>

<div class="input-area">
  {#if uploadQueue.length}
    <div class="upload-queue" role="region" aria-label="文件上传队列">
      {#each uploadQueue as item (item.id)}
        <div class="upload-item">
          <div class="upload-info">
            <span class="upload-name" title={item.file.name}>{item.file.name}</span>
            {#if item.status === 'uploading'}
              <span class="upload-status">上传中 {item.progress}%</span>
              <div class="upload-progress" role="progressbar" aria-label={`上传 ${item.file.name}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={item.progress}>
                <span style={`width: ${item.progress}%`}></span>
              </div>
            {:else if item.status === 'queued'}
              <span class="upload-status">等待上传</span>
            {:else}
              <span class="upload-error" role="alert">{item.error}</span>
            {/if}
            {#if item.roomId !== roomId && item.roomName}
              <span class="upload-status">发送至 #{item.roomName}</span>
            {/if}
          </div>
          {#if item.status === 'failed'}
            <button class="upload-action retry-upload" on:click={() => onRetryUpload?.(item.id)} aria-label={`重试上传 ${item.file.name}`}>重试</button>
          {:else if item.status === 'queued'}
            <button class="upload-action" on:click={() => onRemoveUpload?.(item.id)} aria-label={`取消上传 ${item.file.name}`}>取消</button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if showEmoji}
    <div class="emoji-panel">
      {#each EMOJIS as emoji}
        <button class="emoji-btn" on:click={() => insertEmoji(emoji)} aria-label={`插入表情 ${emoji}`}>{emoji}</button>
      {/each}
    </div>
  {/if}

  <div class="input-row">
    <input
      type="file"
      bind:this={fileInput}
      multiple
      hidden
      on:change={handleFileSelect}
    />

    <button class="tool-btn" on:click={() => fileInput.click()} title="发送文件" aria-label="发送文件">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
      </svg>
    </button>

    <button class="tool-btn" on:click={toggleEmoji} title="表情" aria-label="表情">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    </button>

    <div
      class="text-input-wrapper"
      role="group"
      aria-label="消息输入和文件拖放区域"
      on:dragover={(e) => e.preventDefault()}
      on:drop={handleDrop}
    >
      <textarea
        bind:value={text}
        on:keydown={handleKeydown}
        on:paste={handlePaste}
        placeholder={isMobile ? '输入消息...' : '输入消息... (Enter 发送)'}
        rows="1"
        aria-label="输入消息"
        inputmode="text"
        enterkeyhint="send"
      ></textarea>
    </div>

    <button class="btn-send" on:click={sendText} disabled={!text.trim()} aria-label="发送消息">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="send-icon">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      {#if !isMobile}发送{/if}
    </button>
  </div>
</div>

<style>
  .input-area {
    background: white;
    border-top: 1px solid #e5e7eb;
    padding: 8px 12px;
  }

  .upload-queue {
    display: grid;
    gap: 6px;
    max-height: 128px;
    overflow-y: auto;
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 10px;
    background: #f9fafb;
  }

  .upload-item {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .upload-info { flex: 1; min-width: 0; display: grid; gap: 3px; }
  .upload-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: #374151; }
  .upload-status, .upload-error { font-size: 11px; color: #6b7280; }
  .upload-error { color: #b91c1c; overflow-wrap: anywhere; }
  .upload-progress { height: 4px; overflow: hidden; border-radius: 4px; background: #e5e7eb; }
  .upload-progress span { display: block; height: 100%; background: #6366f1; transition: width 0.12s linear; }
  .upload-action { min-height: 36px; padding: 4px 10px; border: 0; border-radius: 8px; color: #4b5563; background: #e5e7eb; cursor: pointer; }
  .upload-action.retry-upload { color: #fff; background: #6366f1; }

  .emoji-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 8px;
    max-height: 140px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .emoji-btn {
    background: none;
    border: none;
    font-size: 22px;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    transition: background 0.15s;
    min-width: 40px;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .emoji-btn:hover {
    background: #f3f4f6;
  }

  .input-row {
    display: flex;
    align-items: flex-end;
    gap: 6px;
  }

  .tool-btn {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: background 0.15s, color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    min-height: 40px;
  }

  .tool-btn:hover {
    background: #f3f4f6;
    color: #6366f1;
  }

  .text-input-wrapper {
    flex: 1;
  }

  textarea {
    width: 100%;
    padding: 10px 14px;
    border: 2px solid #e5e7eb;
    border-radius: 20px;
    font-size: 15px;
    line-height: 1.5;
    resize: none;
    outline: none;
    font-family: inherit;
    min-height: 42px;
    max-height: 120px;
    transition: border-color 0.2s;
  }

  textarea:focus {
    border-color: #6366f1;
  }

  .btn-send {
    padding: 8px 12px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
    min-width: 42px;
    min-height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .btn-send:hover {
    opacity: 0.9;
  }

  .btn-send:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .input-area {
      padding: 8px max(10px, env(safe-area-inset-right)) 8px max(10px, env(safe-area-inset-left));
      padding-bottom: max(8px, env(safe-area-inset-bottom));
    }

    .tool-btn {
      min-width: 44px;
      min-height: 44px;
    }

    .btn-send {
      min-width: 44px;
      min-height: 44px;
      border-radius: 50%;
      padding: 0;
    }

    .emoji-btn { min-width: 44px; min-height: 44px; }
    .upload-action { min-height: 44px; }

    textarea {
      font-size: 16px;
      padding: 10px 14px;
      min-height: 44px;
    }
  }
</style>
