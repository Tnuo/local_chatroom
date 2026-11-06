<script>
  import { onMount, onDestroy } from 'svelte';
  import { io } from 'socket.io-client';
  import { currentUser } from '../stores/user.js';
  import { rooms, currentRoomId, onlineUsers, incrementUnread, clearUnread, removeRoom, renameRoom } from '../stores/rooms.js';
  import { messages, addMessage, updateMessage, setMessages, removeMessage, prependMessages } from '../stores/messages.js';
  import { cacheMessages, cacheRooms, getCachedMessages, getCachedRooms } from '../stores/offline.js';
  import RoomList from './RoomList.svelte';
  import ChatRoom from './ChatRoom.svelte';
  import SearchBar from './SearchBar.svelte';
  import Lightbox from './Lightbox.svelte';
  import Settings from './Settings.svelte';
  import { getMediaKind } from '../utils/messageTypes.js';

  let socket;
  let sidebarOpen = false;
  let isMobile = false;
  let lightboxSrc = '';
  let lightboxType = '';
  let lightboxItems = [];
  let lightboxIndex = 0;
  let lightboxHasOlder = false;
  let lightboxHasNewer = false;
  let lightboxLoading = false;
  let lightboxError = '';
  let lightboxRequestId = 0;
  let showSettings = false;
  let pageSize = 50;
  let online = typeof navigator === 'undefined' ? true : navigator.onLine;
  let cachedView = false;
  let started = false;
  let sendError = '';

  function updateOnlineStatus() { online = navigator.onLine; }

  function checkMobile() {
    isMobile = window.innerWidth <= 768;
    if (!isMobile) sidebarOpen = false;
  }

  onMount(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  });

  onMount(async () => {
    started = true;
    let roomList = [];
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) throw new Error('rooms unavailable');
      roomList = await res.json();
      rooms.set(roomList);
      cacheRooms(roomList).catch(console.warn);
    } catch (e) {
      roomList = await getCachedRooms().catch(() => []);
      rooms.set(roomList);
      cachedView = roomList.length > 0;
    }

    if (roomList.length > 0 && !$currentRoomId) {
      currentRoomId.set(roomList[0].id);
    }

    if (!online) {
      if ($currentRoomId) {
        await loadMessages($currentRoomId);
        cachedView = true;
      }
      return;
    }

    connectSocket();
  });

  function connectSocket() {
    if (socket || !online) return;
    socket = io();
    socket.on('connect', () => {
      const user = $currentUser;
      if (!user) return;
      socket.emit('user:join', user);
      if ($currentRoomId) {
        socket.emit('room:join', $currentRoomId);
        loadMessages($currentRoomId);
      }
    });
    socket.on('users:online', list => onlineUsers.set(list));
    socket.on('message:new', msg => {
      addMessage(msg.room_id, msg);
      cacheMessages(msg.room_id, [msg]).catch(console.warn);
      if ($currentRoomId !== msg.room_id) incrementUnread(msg.room_id);
    });
    socket.on('message:updated', msg => {
      updateMessage(msg);
      cacheMessages(msg.room_id, [msg]).catch(console.warn);
    });
    socket.on('message:deleted', data => removeMessage(data.room_id, data.id));
    socket.on('room:renamed', data => {
      renameRoom(data.id, data.name);
      cacheRooms($rooms).catch(console.warn);
    });
    socket.on('room:deleted', data => {
      removeRoom(data.id);
      cacheRooms($rooms.filter(room => room.id !== data.id)).catch(console.warn);
      if ($currentRoomId === data.id && $rooms[0]) currentRoomId.set($rooms[0].id);
    });
  }

  $: if (started && online && $currentUser && !socket) connectSocket();

  $: if (started && !online && $currentRoomId && !cachedView) {
    loadMessages($currentRoomId).then(() => { cachedView = true; });
  }

  onDestroy(() => {
    socket?.disconnect();
    socket = null;
  });

  function handleRoomSwitch(roomId) {
    if ($currentRoomId && socket) {
      socket.emit('room:leave', $currentRoomId);
    }
    currentRoomId.set(roomId);
    clearUnread(roomId);
    if (socket) socket.emit('room:join', roomId);
    loadMessages(roomId);
    if (isMobile) sidebarOpen = false;
  }

  async function loadMessages(roomId) {
    try {
      const res = await fetch(`/api/messages/${roomId}?limit=${pageSize}`);
      if (!res.ok) throw new Error('messages unavailable');
      const msgs = await res.json();
      setMessages(roomId, msgs);
      cacheMessages(roomId, msgs).catch(console.warn);
      cachedView = false;
    } catch (e) {
      const cached = await getCachedMessages(roomId).catch(() => []);
      if (cached.length) {
        setMessages(roomId, cached);
        cachedView = true;
      } else {
        console.error('Failed to load messages:', e);
      }
    }
  }

  async function loadMoreMessages(roomId) {
    if (!online) return false;
    try {
      const roomMsgs = $messages[roomId] || [];
      if (roomMsgs.length === 0) return false;
      const oldest = roomMsgs[0].created_at;
      const res = await fetch(`/api/messages/${roomId}?limit=${pageSize}&before=${encodeURIComponent(oldest)}`);
      if (!res.ok) return false;
      const msgs = await res.json();
      if (msgs.length === 0) return false;
      prependMessages(roomId, msgs);
      cacheMessages(roomId, msgs).catch(console.warn);
      return msgs.length >= pageSize;
    } catch (e) {
      console.error('Failed to load more messages:', e);
      return false;
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      const cfg = await res.json();
      pageSize = cfg.message?.page_size || 50;
    } catch (e) { /* keep default */ }
  }
  loadConfig();

  function refreshRooms() {
    fetch('/api/rooms').then(r => r.json()).then(data => {
      rooms.set(data);
      cacheRooms(data).catch(console.warn);
    });
  }

  function handleSendMessage(data) {
    if (!socket?.connected || !$currentRoomId) {
      sendError = '当前未连接服务器，消息没有发送';
      return;
    }
    sendError = '';
    socket.timeout(8000).emit('message:send', { roomId: $currentRoomId, ...data }, (timeoutError, result) => {
      if (timeoutError) {
        sendError = '发送确认超时，请检查连接后重试';
      } else if (!result?.ok) {
        sendError = result?.error || '消息发送失败';
      } else {
        sendError = '';
      }
    });
  }

  function handleTogglePermanent(detail) {
    if (socket) socket.emit('message:permanent', detail);
  }

  function handleDeleteMessage({ messageId }) {
    if (socket && $currentUser) {
      socket.emit('message:delete', { messageId, userId: $currentUser.id });
    }
  }

  function handleRoomRename({ roomId, name }) {
    if (socket) socket.emit('room:rename', { roomId, name });
  }

  function handleRoomDelete({ roomId }) {
    if (socket) socket.emit('room:delete', { roomId });
  }

  function handleSearchNavigate({ roomId, messageId }) {
    currentRoomId.set(roomId);
    if (isMobile) sidebarOpen = false;
    loadMessages(roomId).then(() => {
      setTimeout(() => {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight');
          setTimeout(() => el.classList.remove('highlight'), 2000);
        }
      }, 300);
    });
  }

  async function handleMediaPreview({ messageId, src, type }) {
    const requestId = ++lightboxRequestId;
    const roomMessages = $messages[$currentRoomId] || [];
    lightboxItems = roomMessages
      .filter(message => message.file_url && (message.type === 'image' || ['image', 'video'].includes(getMediaKind(message.mime_type))))
      .map(message => ({
        id: message.id,
        src: '/uploads/' + message.file_url,
        type: message.type === 'image' ? 'image' : getMediaKind(message.mime_type),
        name: message.file_name || ''
      }));
    lightboxIndex = lightboxItems.findIndex(item => item.id === messageId);
    if (lightboxIndex < 0) {
      lightboxItems = [{ id: messageId, src, type, name: '' }];
      lightboxIndex = 0;
    }
    lightboxSrc = src;
    lightboxType = type;
    lightboxHasOlder = false;
    lightboxHasNewer = false;
    lightboxError = '';
    lightboxLoading = online;

    if (!online) return;

    try {
      const response = await fetch(`/api/messages/${$currentRoomId}/media?around=${encodeURIComponent(messageId)}&limit=40`);
      if (!response.ok) throw new Error('无法加载房间媒体列表');
      const result = await response.json();
      if (requestId !== lightboxRequestId) return;
      lightboxItems = result.items || [];
      lightboxIndex = Math.max(0, lightboxItems.findIndex(item => item.id === messageId));
      lightboxHasOlder = Boolean(result.hasOlder);
      lightboxHasNewer = Boolean(result.hasNewer);
    } catch (error) {
      if (requestId === lightboxRequestId) lightboxError = error.message || '媒体列表加载失败';
    } finally {
      if (requestId === lightboxRequestId) lightboxLoading = false;
    }
  }

  async function loadMediaPage(direction, cursor) {
    if (!online) return { items: [], hasMore: false };
    const params = new URLSearchParams({ limit: '40' });
    if (direction === 'older') {
      params.set('beforeCreatedAt', cursor.created_at);
      params.set('beforeId', cursor.id);
    } else {
      params.set('afterCreatedAt', cursor.created_at);
      params.set('afterId', cursor.id);
    }

    const response = await fetch(`/api/messages/${$currentRoomId}/media?${params}`);
    if (!response.ok) throw new Error('更多媒体加载失败');
    const result = await response.json();
    return {
      items: result.items || [],
      hasMore: Boolean(result.hasMore)
    };
  }

  function closeLightbox() {
    lightboxRequestId++;
    lightboxSrc = '';
    lightboxType = '';
    lightboxLoading = false;
  }

  function toggleSidebar() { sidebarOpen = !sidebarOpen; }
  function closeSidebar() { sidebarOpen = false; }

  $: currentRoom = $rooms.find(r => r.id === $currentRoomId);
</script>

<div class="layout">
  {#if isMobile && sidebarOpen}
    <button class="backdrop" on:click={closeSidebar} aria-label="关闭侧边栏"></button>
  {/if}

  <aside class="sidebar" class:open={sidebarOpen} class:mobile={isMobile}>
    <RoomList
      rooms={$rooms}
      currentRoomId={$currentRoomId}
      onlineUsers={$onlineUsers}
      onRoomSwitch={handleRoomSwitch}
      onRoomCreated={refreshRooms}
      onRoomRename={handleRoomRename}
      onRoomDelete={handleRoomDelete}
      {isMobile}
      onCloseSidebar={closeSidebar}
    />
  </aside>

  <main class="main-area">
    {#if !online || cachedView}
      <div class="offline-banner" role="status">
        {!online ? '离线模式：显示此设备已缓存的聊天记录' : '当前显示本地缓存记录'}
      </div>
    {/if}
    {#if sendError}
      <div class="send-error" role="alert">{sendError}</div>
    {/if}
    <div class="top-bar">
      {#if isMobile}
        <button class="hamburger" on:click={toggleSidebar} aria-label="菜单">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      {/if}
      <span class="room-title">{currentRoom?.name || ''}</span>
      {#if !isMobile}<span class="room-hash-prefix">#</span>{/if}
      <button class="btn-settings" on:click={() => showSettings = true} title="设置" aria-label="设置">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
    <SearchBar onNavigate={handleSearchNavigate} {isMobile} />
    {#if $currentRoomId}
      <ChatRoom
        roomId={$currentRoomId}
        messages={$messages[$currentRoomId] || []}
        currentUser={$currentUser}
        onSend={handleSendMessage}
        onTogglePermanent={handleTogglePermanent}
        onDeleteMessage={handleDeleteMessage}
        onMediaPreview={handleMediaPreview}
        onLoadMore={() => loadMoreMessages($currentRoomId)}
        {isMobile}
      />
    {/if}
  </main>
</div>

{#if lightboxSrc}
  {#if lightboxLoading}
    <div class="media-loading-overlay" role="status">
      <span>正在加载房间媒体…</span>
      <button class="media-loading-close" on:click={closeLightbox} aria-label="关闭媒体预览">×</button>
    </div>
  {:else}
    <Lightbox
      src={lightboxSrc}
      type={lightboxType}
      initialItems={lightboxItems}
      initialIndex={lightboxIndex}
      hasOlder={lightboxHasOlder}
      hasNewer={lightboxHasNewer}
      loadError={lightboxError}
      onLoadMore={loadMediaPage}
      onClose={closeLightbox}
    />
  {/if}
{/if}

{#if showSettings}
  <Settings onClose={() => showSettings = false} />
{/if}

<style>
  .layout {
    display: flex;
    height: 100%;
    min-height: 0;
    flex: 1;
    background: #f0f2f5;
    position: relative;
    overflow: hidden;
  }

  .sidebar {
    width: 280px;
    min-width: 280px;
    background: #1e1e2e;
    display: flex;
    flex-direction: column;
    transition: transform 0.25s ease;
    z-index: 50;
  }

  .sidebar.mobile {
    position: fixed;
    top: env(safe-area-inset-top);
    left: 0;
    bottom: env(safe-area-inset-bottom);
    transform: translateX(-100%);
    box-shadow: none;
    z-index: 200;
  }

  .sidebar.mobile.open {
    transform: translateX(0);
    box-shadow: 4px 0 20px rgba(0,0,0,0.3);
  }

  .backdrop {
    position: fixed;
    top: env(safe-area-inset-top);
    right: env(safe-area-inset-right);
    bottom: env(safe-area-inset-bottom);
    left: env(safe-area-inset-left);
    background: rgba(0,0,0,0.4);
    z-index: 199;
    border: none;
    cursor: pointer;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .offline-banner {
    padding: 8px 14px;
    color: #713f12;
    background: #fef3c7;
    border-bottom: 1px solid #fde68a;
    font-size: 13px;
    text-align: center;
  }

  .media-loading-overlay {
    position: fixed;
    inset: 0;
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    color: white;
    background: rgba(0, 0, 0, 0.94);
  }

  .media-loading-close {
    position: absolute;
    top: max(16px, env(safe-area-inset-top));
    right: max(16px, env(safe-area-inset-right));
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    color: white;
    background: rgba(255, 255, 255, 0.16);
    font-size: 28px;
  }

  .send-error {
    padding: 8px 14px;
    color: #991b1b;
    background: #fee2e2;
    border-bottom: 1px solid #fecaca;
    font-size: 13px;
    text-align: center;
  }

  .top-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: calc(6px + env(safe-area-inset-top)) 16px 6px;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    min-height: 42px;
  }

  .hamburger {
    background: none;
    border: none;
    color: #374151;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    min-height: 36px;
  }

  .hamburger:hover { background: #f3f4f6; }

  .btn-settings {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    min-height: 36px;
  }
  .btn-settings:hover { background: #f3f4f6; color: #6366f1; }

  .room-title {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  @media (max-width: 768px) {
    .sidebar {
      width: 280px;
      min-width: 280px;
    }

    .top-bar {
      padding-left: max(12px, env(safe-area-inset-left));
      padding-right: max(12px, env(safe-area-inset-right));
    }
  }
</style>
