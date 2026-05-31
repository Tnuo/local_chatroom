<script>
  import { afterUpdate, tick } from 'svelte';
  import MessageBubble from './MessageBubble.svelte';
  import MessageInput from './MessageInput.svelte';

  export let roomId;
  export let messages = [];
  export let currentUser;
  export let onSend;
  export let onTogglePermanent;
  export let onDeleteMessage;
  export let onMediaPreview;
  export let isMobile = false;

  let messageContainer;
  let autoScroll = true;
  let dragOver = false;
  let bottomAnchor;

  $: if (roomId) { autoScroll = true; }

  function handleScroll() {
    if (!messageContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = messageContainer;
    autoScroll = scrollHeight - scrollTop - clientHeight < 120;
  }

  function scrollToBottom() {
    if (!autoScroll || !messageContainer) return;
    bottomAnchor?.scrollIntoView({ block: 'end' });
  }

  afterUpdate(() => {
    if (autoScroll) {
      tick().then(() => {
        scrollToBottom();
        requestAnimationFrame(() => {
          scrollToBottom();
          setTimeout(() => scrollToBottom(), 200);
          setTimeout(() => scrollToBottom(), 600);
        });
      });
    }
  });

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return '今天';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return '昨天';
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  function determineType(mime) {
    if (!mime) return 'file';
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'file';
  }

  async function uploadFile(file) {
    const resp = await fetch('/api/config');
    const config = await resp.json();
    const limit = config.server?.upload_limit || 52428800;

    if (file.size > limit) {
      alert(`文件 "${file.name}" 超过大小限制`);
      return null;
    }

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
    }
  }

  async function handleDrop(e) {
    e.preventDefault();
    dragOver = false;
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

  function handleDragOver(e) {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave(e) {
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) {
      dragOver = false;
    }
  }

  $: messagesWithDates = (() => {
    let lastDate = '';
    return messages.map(msg => {
      const date = formatDate(msg.created_at);
      const showDate = date && date !== lastDate;
      if (showDate) lastDate = date;
      return { ...msg, showDate, dateLabel: date };
    });
  })();
</script>

<div class="chat-room">
  <div
    class="messages-container"
    class:drag-over={dragOver}
    bind:this={messageContainer}
    on:scroll={handleScroll}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
  >
    {#if messages.length === 0}
      <div class="empty-chat">
        <div class="empty-icon">💬</div>
        <p>暂无消息，发送第一条消息吧</p>
      </div>
    {/if}

    {#each messagesWithDates as msg}
      {#if msg.showDate}
        <div class="date-separator">
          <span>{msg.dateLabel}</span>
        </div>
      {/if}

      <MessageBubble
        {msg}
        isMine={msg.user_id === currentUser?.id}
        {onTogglePermanent}
        {onDeleteMessage}
        {onMediaPreview}
        {isMobile}
      />
    {/each}
    <div bind:this={bottomAnchor}></div>
  </div>

  <MessageInput {onSend} {roomId} {isMobile} />
</div>

<style>
  .chat-room {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: #f0f2f5;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
    -webkit-overflow-scrolling: touch;
    transition: background 0.15s;
  }

  .messages-container.drag-over {
    background: rgba(99, 102, 241, 0.06);
    outline: 2px dashed #6366f1;
    outline-offset: -2px;
  }

  .empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #9ca3af;
    gap: 12px;
  }

  .empty-icon {
    font-size: 48px;
    opacity: 0.5;
  }

  .empty-chat p {
    font-size: 15px;
  }

  .date-separator {
    display: flex;
    justify-content: center;
    margin: 16px 0 8px;
  }

  .date-separator span {
    font-size: 12px;
    color: #9ca3af;
    background: #f0f2f5;
    padding: 4px 12px;
    border-radius: 10px;
  }

  @media (max-width: 768px) {
    .messages-container {
      padding: 12px 8px;
    }
  }
</style>
