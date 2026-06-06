<script>
  import { currentUser } from '../stores/user.js';
  import { unreadStore as unread } from '../stores/rooms.js';

  export let rooms = [];
  export let currentRoomId = null;
  export let onlineUsers = [];
  export let onRoomSwitch;
  export let onRoomCreated;
  export let onRoomRename;
  export let onRoomDelete;
  export let isMobile = false;
  export let onCloseSidebar;

  let showNewRoom = false;
  let newRoomName = '';
  let contextMenu = null;
  let renameRoomId = null;
  let renameRoomValue = '';

  function switchRoom(id) {
    onRoomSwitch?.(id);
  }

  async function createRoom() {
    if (!newRoomName.trim()) return;
    try {
      await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName.trim(), created_by: $currentUser?.id })
      });
      newRoomName = '';
      showNewRoom = false;
      onRoomCreated?.();
    } catch (e) {
      console.error(e);
    }
  }

  function handleLogout() {
    currentUser.set(null);
  }

  function showContextMenu(e, room) {
    if (room.is_default) return;
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    contextMenu = { x, y, room };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function startRename() {
    renameRoomId = contextMenu.room.id;
    renameRoomValue = contextMenu.room.name;
    contextMenu = null;
  }

  function submitRename() {
    if (!renameRoomValue.trim()) { renameRoomId = null; return; }
    onRoomRename?.({ roomId: renameRoomId, name: renameRoomValue.trim() });
    renameRoomId = null;
  }

  function confirmDelete() {
    const room = contextMenu.room;
    contextMenu = null;
    if (window.confirm(`确定删除房间 "${room.name}"？\n所有消息将被永久删除。`)) {
      onRoomDelete?.({ roomId: room.id });
    }
  }

  function handleRoomKeydown(e) {
    if (e.key === 'Enter') submitRename();
    if (e.key === 'Escape') renameRoomId = null;
  }

  let longPressActive = false;

  function startLongPress(e, room) {
    clearTimeout(longPressTimer);
    longPressActive = false;
    longPressTimer = setTimeout(() => {
      longPressActive = true;
      showContextMenu(e, room);
    }, 600);
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  function handleRoomClick(e, room) {
    if (longPressActive) {
      longPressActive = false;
      return;
    }
    switchRoom(room.id);
  }
</script>

<div class="sidebar-inner">
  <div class="sidebar-header">
    <div class="user-info">
      <span class="avatar" style="background: {$currentUser?.avatar_color || '#6366f1'}">
        {$currentUser?.nickname?.charAt(0) || '?'}
      </span>
      <span class="nickname">{$currentUser?.nickname || 'Unknown'}</span>
    </div>
    <div class="header-actions">
      {#if isMobile}
        <button class="btn-close-sidebar" on:click={() => onCloseSidebar?.()} title="关闭菜单" aria-label="关闭菜单">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      {/if}
      <button class="btn-logout" on:click={handleLogout} title="退出">↪</button>
    </div>
  </div>

  <div class="room-section">
    <div class="section-title">
      <span>聊天房间</span>
      <button class="btn-add-room" on:click={() => showNewRoom = !showNewRoom} title="创建房间">
        {showNewRoom ? '−' : '+'}
      </button>
    </div>

    {#if showNewRoom}
      <div class="new-room-form">
        <input
          type="text"
          bind:value={newRoomName}
          placeholder="房间名..."
          maxlength="15"
          on:keydown={(e) => e.key === 'Enter' && createRoom()}
        />
        <button on:click={createRoom}>创建</button>
      </div>
    {/if}

    <div class="room-list">
      {#each rooms as room (room.id)}
        {#if renameRoomId === room.id}
          <div class="rename-form">
            <input
              type="text"
              bind:value={renameRoomValue}
              on:keydown={handleRoomKeydown}
              on:blur={submitRename}
              maxlength="15"
            />
          </div>
        {:else}
          <button
            class="room-item"
            class:active={room.id === currentRoomId}
            on:click={(e) => handleRoomClick(e, room)}
            on:contextmenu|preventDefault={(e) => showContextMenu(e, room)}
            on:touchstart={(e) => startLongPress(e, room)}
            on:touchend={cancelLongPress}
            on:touchmove={cancelLongPress}
            on:touchcancel={cancelLongPress}
          >
            <span class="room-hash">#</span>
            <span class="room-name">{room.name}</span>
            {#if ($unread[room.id] || 0) > 0 && room.id !== currentRoomId}
              <span class="badge">{$unread[room.id]}</span>
            {/if}
          </button>
        {/if}
      {/each}
    </div>
  </div>

  <div class="online-section">
    <div class="section-title">
      <span>在线 ({onlineUsers.length})</span>
    </div>
    <div class="online-list">
      {#each onlineUsers as user (user.id)}
        <div class="online-user">
          <span class="dot"></span>
          <span class="on-avatar" style="background: {user.avatar_color}">{user.nickname.charAt(0)}</span>
          <span class="on-name">{user.nickname}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

{#if contextMenu}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="context-overlay" on:click|stopPropagation={closeContextMenu} on:contextmenu|preventDefault={closeContextMenu}>
    <div class="context-menu" style="left: {Math.min(contextMenu.x, window.innerWidth - 160)}px; top: {Math.min(contextMenu.y, window.innerHeight - 100)}px;">
      <button on:click|stopPropagation={startRename}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        重命名
      </button>
      <button class="danger" on:click|stopPropagation={confirmDelete}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        删除房间
      </button>
    </div>
  </div>
{/if}

<style>
  .sidebar-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: #cdd6f4;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid #313244;
  }

  .user-info { display: flex; align-items: center; gap: 10px; min-width: 0; }

  .avatar {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: white; font-weight: 600; font-size: 16px; flex-shrink: 0;
  }

  .nickname {
    font-size: 15px; font-weight: 500;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .header-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

  .btn-close-sidebar {
    background: none; border: none; color: #a6adc8; cursor: pointer;
    padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
    min-width: 36px; min-height: 36px;
  }
  .btn-close-sidebar:hover { background: #313244; color: #cdd6f4; }

  .btn-logout {
    background: none; border: none; color: #a6adc8; font-size: 18px; cursor: pointer;
    padding: 4px 8px; border-radius: 6px; min-width: 36px; min-height: 36px;
  }
  .btn-logout:hover { background: #313244; }

  .room-section { flex: 1; overflow-y: auto; padding: 12px 0; }

  .section-title {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 16px; font-size: 12px; text-transform: uppercase;
    color: #6c7086; letter-spacing: 0.5px;
  }

  .btn-add-room {
    background: none; border: none; color: #a6adc8; font-size: 20px; cursor: pointer;
    min-width: 36px; min-height: 36px; display: flex; align-items: center; justify-content: center;
    border-radius: 6px;
  }
  .btn-add-room:hover { background: #313244; color: #cdd6f4; }

  .new-room-form, .rename-form { display: flex; gap: 6px; padding: 6px 16px; }

  .new-room-form input, .rename-form input {
    flex: 1; padding: 10px 12px; border: 1px solid #313244; border-radius: 6px;
    background: #181825; color: #cdd6f4; font-size: 14px; outline: none; min-height: 40px;
  }
  .new-room-form input:focus, .rename-form input:focus { border-color: #6366f1; }

  .new-room-form button {
    padding: 10px 14px; background: #6366f1; color: white; border: none;
    border-radius: 6px; cursor: pointer; font-size: 14px; min-height: 40px;
  }

  .room-list { padding: 4px 8px; }

  .room-item {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 12px 12px; border: none; background: none; color: #a6adc8;
    cursor: pointer; border-radius: 8px; text-align: left; font-size: 14px;
    transition: background 0.15s; min-height: 44px;
    user-select: none; -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .room-item:hover { background: #313244; }
  .room-item.active { background: #45475a; color: #cdd6f4; }

  .room-hash { color: #6366f1; font-weight: 600; }

  .room-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .badge {
    background: #6366f1; color: white; font-size: 11px; min-width: 20px; height: 20px;
    border-radius: 10px; display: flex; align-items: center; justify-content: center; padding: 0 6px;
  }

  .online-section { border-top: 1px solid #313244; padding: 12px 0; max-height: 200px; overflow-y: auto; }
  .online-list { padding: 4px 8px; }

  .online-user { display: flex; align-items: center; gap: 8px; padding: 8px 12px; font-size: 13px; }

  .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; flex-shrink: 0; }

  .on-avatar {
    width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    color: white; font-weight: 600; font-size: 12px; flex-shrink: 0;
  }
  .on-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .context-overlay {
    position: fixed; inset: 0; z-index: 300;
  }

  .context-menu {
    position: fixed; z-index: 301;
    background: #313244; border: 1px solid #45475a;
    border-radius: 10px; padding: 6px; min-width: 150px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    animation: popIn 0.15s ease;
  }

  @keyframes popIn {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .context-menu button {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 10px 12px; border: none; background: none;
    color: #cdd6f4; cursor: pointer; border-radius: 6px;
    font-size: 14px; text-align: left;
  }
  .context-menu button:hover { background: #45475a; }
  .context-menu button.danger { color: #f87171; }
  .context-menu button.danger:hover { background: #7f1d1d; }

  @media (max-width: 768px) {
    .sidebar-header { padding: 12px 12px; }
    .room-item { padding: 14px 12px; }
    .context-menu button { padding: 12px 14px; font-size: 15px; }
  }
</style>
