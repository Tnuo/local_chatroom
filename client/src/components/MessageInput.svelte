<script>
  import { createEventDispatcher } from 'svelte';

  export let onSend;
  export let roomId;
  export let isMobile = false;

  const dispatch = createEventDispatcher();
  let text = '';
  let uploading = false;
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

  async function uploadFile(file) {
    let limit = 52428800;
    try {
      const config = await fetch('/api/config').then(r => r.json());
      limit = config.server?.upload_limit || limit;
    } catch (_) { /* use the fallback while offline */ }

    if (file.size > limit) {
      alert(`文件大小超过限制 (${(limit / 1024 / 1024).toFixed(0)}MB)`);
      return;
    }

    uploading = true;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch (e) {
      alert('上传失败: ' + e.message);
      return null;
    } finally {
      uploading = false;
    }
  }

  function determineType(mime) {
    if (!mime) return 'file';
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'file';
  }

  async function handleFileSelect(e) {
    const files = e.target.files;
    for (const file of files) {
      const uploaded = await uploadFile(file);
      if (uploaded) {
        onSend?.({
          type: determineType(file.type),
          content: '',
          file: uploaded
        });
      }
    }
    if (fileInput) fileInput.value = '';
  }

  async function handleDrop(e) {
    e.preventDefault();
    for (const item of e.dataTransfer.items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        const uploaded = await uploadFile(file);
        if (uploaded) {
          onSend?.({
            type: determineType(file.type),
            content: '',
            file: uploaded
          });
        }
      }
    }
  }

  async function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        const uploaded = await uploadFile(file);
        if (uploaded) {
          onSend?.({
            type: determineType(file.type),
            content: '',
            file: uploaded
          });
        }
      }
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
  {#if showEmoji}
    <div class="emoji-panel">
      {#each EMOJIS as emoji}
        <button class="emoji-btn" on:click={() => insertEmoji(emoji)}>{emoji}</button>
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

    <button class="btn-send" on:click={sendText} disabled={uploading || !text.trim()}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="send-icon">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      {#if uploading}{isMobile ? '…' : '上传中…'}{:else if !isMobile}发送{/if}
    </button>
  </div>
</div>

<style>
  .input-area {
    background: white;
    border-top: 1px solid #e5e7eb;
    padding: 8px 12px;
  }

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

    textarea {
      font-size: 16px;
      padding: 10px 14px;
      min-height: 44px;
    }
  }
</style>
