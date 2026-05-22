<script>
  import { afterUpdate } from 'svelte';
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

  function handleScroll() {
    if (!messageContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = messageContainer;
    autoScroll = scrollHeight - scrollTop - clientHeight < 100;
  }

  afterUpdate(() => {
    if (autoScroll && messageContainer) {
      messageContainer.scrollTop = messageContainer.scrollHeight;
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
  <div class="messages-container" bind:this={messageContainer} on:scroll={handleScroll}>
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
  }

  .empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
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
