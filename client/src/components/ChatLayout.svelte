<script>
  import { onMount, onDestroy } from 'svelte';
  import { io } from 'socket.io-client';
  import { currentUser } from '../stores/user.js';
  import { rooms, currentRoomId, onlineUsers, incrementUnread, clearUnread, removeRoom, renameRoom } from '../stores/rooms.js';
  import { messages, addMessage, updateMessage, setMessages, removeMessage, prependMessages } from '../stores/messages.js';
  import RoomList from './RoomList.svelte';
  import ChatRoom from './ChatRoom.svelte';
  import SearchBar from './SearchBar.svelte';
  import Lightbox from './Lightbox.svelte';
  import Settings from './Settings.svelte';

  let socket;
  let sidebarOpen = false;
  let isMobile = false;
  let lightboxSrc = '';
  let lightboxType = '';
  let showSettings = false;
  let pageSize = 50;

  function checkMobile() {
    isMobile = window.innerWidth <= 768;
    if (!isMobile) sidebarOpen = false;
  }

  onMount(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
  });

  onMount(async () => {
    const res = await fetch('/api/rooms');
    const roomList = await res.json();
    rooms.set(roomList);

    if (roomList.length > 0) {
      currentRoomId.set(roomList[0].id);
    }

    socket = io();

    socket.on('connect', () => {
      const user = $currentUser;
      if (user) {
        socket.emit('user:join', user);
        if ($currentRoomId) {
          socket.emit('room:join', $currentRoomId);
          loadMessages($currentRoomId);
        }
      }
    });

    socket.on('users:online', (list) => onlineUsers.set(list));
    socket.on('message:new', (msg) => {
      addMessage(msg.room_id, msg);
      if ($currentRoomId !== msg.room_id) incrementUnread(msg.room_id);
    });
    socket.on('message:updated', (msg) => updateMessage(msg));
    socket.on('message:deleted', (data) => removeMessage(data.room_id, data.id));
    socket.on('room:renamed', (data) => renameRoom(data.id, data.name));
    socket.on('room:deleted', (data) => {
      removeRoom(data.id);
      if ($currentRoomId === data.id) {
        const roomList = $rooms;
        const fallback = roomList.find(r => r.id !== data.id);
        if (fallback) currentRoomId.set(fallback.id);
      }
    });
    socket.on('room:user_joined', () => {});
    socket.on('room:user_left', () => {});
  });

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
      const msgs = await res.json();
      setMessages(roomId, msgs);
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  }

  async function loadMoreMessages(roomId) {
    try {
      const roomMsgs = $messages[roomId] || [];
      if (roomMsgs.length === 0) return false;
      const oldest = roomMsgs[0].created_at;
      const res = await fetch(`/api/messages/${roomId}?limit=${pageSize}&before=${encodeURIComponent(oldest)}`);
      const msgs = await res.json();
      if (msgs.length === 0) return false;
      prependMessages(roomId, msgs);
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
    fetch('/api/rooms').then(r => r.json()).then(data => rooms.set(data));
  }

  function handleSendMessage(data) {
    if (!socket || !$currentRoomId) return;
    socket.emit('message:send', { roomId: $currentRoomId, ...data });
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

  function handleMediaPreview({ src, type }) {
    lightboxSrc = src;
    lightboxType = type;
  }

  function closeLightbox() {
    lightboxSrc = '';
    lightboxType = '';
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
  <Lightbox src={lightboxSrc} type={lightboxType} onClose={closeLightbox} />
{/if}

{#if showSettings}
  <Settings onClose={() => showSettings = false} />
{/if}

<style>
  .layout {
    display: flex;
    height: 100vh;
    height: 100dvh;
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
    top: 0;
    left: 0;
    bottom: 0;
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
    inset: 0;
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

  .top-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 16px;
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
  }
</style>
