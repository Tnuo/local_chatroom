<script>
  import MessageBubble from './MessageBubble.svelte';
  import MessageInput from './MessageInput.svelte';
  import { getAttachmentMessageType } from '../utils/messageTypes.js';
  import { uploadAttachment } from '../utils/uploadAttachment.js';

  export let roomId;
  export let roomName = '';
  export let messages = [];
  export let currentUser;
  export let onSend;
  export let onTogglePermanent;
  export let onDeleteMessage;
  export let onMediaPreview;
  export let isMobile = false;
  export let onLoadMore;

  let messageContainer;
  let dragOver = false;
  let loadingMore = false;
  let hasMore = true;
  let prefetchHeight = 0;
  let uploadQueue = [];
  let uploadWorkerActive = false;
  let nextUploadId = 0;

  $: if (roomId) { hasMore = true; loadingMore = false; }

  function handleScroll() {
    if (!messageContainer) return;
    const { scrollTop } = messageContainer;
    const distFromVisualTop = scrollTop;

    if (distFromVisualTop < 120 && hasMore && !loadingMore) {
      loadingMore = true;
      prefetchHeight = messageContainer.scrollHeight - messageContainer.scrollTop;
      Promise.resolve(onLoadMore?.()).then(more => {
        hasMore = more !== false;
        loadingMore = false;
      });
    }
  }

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

  function updateUpload(id, updates) {
    uploadQueue = uploadQueue.map(item => item.id === id ? { ...item, ...updates } : item);
  }

  function enqueueUploads(files) {
    const queued = Array.from(files || []).filter(Boolean).map(file => ({
      id: ++nextUploadId,
      file,
      roomId,
      roomName,
      status: 'queued',
      progress: 0,
      error: ''
    }));
    if (!queued.length) return;
    uploadQueue = [...uploadQueue, ...queued];
    processUploadQueue();
  }

  async function processUploadQueue() {
    if (uploadWorkerActive) return;
    uploadWorkerActive = true;
    try {
      while (true) {
        const item = uploadQueue.find(upload => upload.status === 'queued');
        if (!item) break;
        updateUpload(item.id, { status: 'uploading', progress: 0, error: '' });
        try {
          const uploaded = await uploadAttachment(item.file, progress => updateUpload(item.id, { progress }));
          onSend?.({
            type: getAttachmentMessageType(uploaded.mimetype),
            content: '',
            file: uploaded
          }, item.roomId);
          uploadQueue = uploadQueue.filter(upload => upload.id !== item.id);
        } catch (error) {
          updateUpload(item.id, { status: 'failed', error: error.message || '上传失败' });
        }
      }
    } finally {
      uploadWorkerActive = false;
    }
  }

  function retryUpload(id) {
    updateUpload(id, { status: 'queued', progress: 0, error: '' });
    processUploadQueue();
  }

  function removeUpload(id) {
    if (uploadQueue.some(item => item.id === id && item.status === 'uploading')) return;
    uploadQueue = uploadQueue.filter(item => item.id !== id);
  }

  async function handleDrop(e) {
    e.preventDefault();
    dragOver = false;
    enqueueUploads(e.dataTransfer.files);
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
    return [...messages].reverse().map(msg => {
      const date = formatDate(msg.created_at);
      const showDate = date && date !== lastDate;
      if (showDate) lastDate = date;
      return { ...msg, showDate, dateLabel: date };
    });
  })();

  $: if (typeof document !== 'undefined' && loadingMore && messageContainer && prefetchHeight > 0) {
    const target = messageContainer.scrollHeight - prefetchHeight;
    messageContainer.scrollTop = target;
    prefetchHeight = 0;
  }
</script>

<div class="chat-room">
  <div
    class="messages-container"
    role="region"
    aria-label="聊天消息，可拖放文件上传"
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
      <MessageBubble
        {msg}
        isMine={msg.user_id === currentUser?.id}
        {onTogglePermanent}
        {onDeleteMessage}
        {onMediaPreview}
        {isMobile}
      />
      {#if msg.showDate}
        <div class="date-separator">
          <span>{msg.dateLabel}</span>
        </div>
      {/if}
    {/each}

    {#if loadingMore}
      <div class="load-more-spinner">
        <div class="spinner"></div>
      </div>
    {/if}
  </div>

  <MessageInput
    {onSend}
    {isMobile}
    {roomId}
    {uploadQueue}
    onFiles={enqueueUploads}
    onRetryUpload={retryUpload}
    onRemoveUpload={removeUpload}
  />
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
    display: flex;
    flex-direction: column-reverse;
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

  .load-more-spinner {
    display: flex;
    justify-content: center;
    padding: 16px 0;
    order: 999;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #e5e7eb;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
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
    margin: 8px 0 16px;
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
