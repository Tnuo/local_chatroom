<script>
  import { onMount, onDestroy } from 'svelte';

  export let src = '';
  export let type = 'image';
  export let initialItems = [];
  export let initialIndex = 0;
  export let hasOlder = false;
  export let hasNewer = false;
  export let loadError = '';
  export let onLoadMore;
  export let onClose;

  let activeIndex = 0;
  let gallery = [];
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let gesture = null;
  let lastTapAt = 0;
  let olderAvailable = hasOlder;
  let newerAvailable = hasNewer;
  let moreLoading = '';
  let moreError = loadError;
  let cacheSaved = false;
  let cacheSaving = false;
  let cacheProgress = null;
  let cacheError = '';
  let checkedCacheUrl = '';
  let cacheCheckId = 0;

  $: currentItem = gallery[Math.min(activeIndex, gallery.length - 1)] || { src, type, name: '' };
  $: isImage = currentItem.type === 'image';

  $: if (currentItem.src && currentItem.src !== checkedCacheUrl) {
    checkedCacheUrl = currentItem.src;
    checkOfflineCache(currentItem.src);
  }

  function resetZoom() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    gesture = null;
  }

  function preloadNeighborImages() {
    for (const index of [activeIndex - 1, activeIndex + 1]) {
      const item = gallery[index];
      if (item?.type === 'image') {
        const image = new Image();
        image.src = item.src;
      }
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') onClose?.();
    if (event.key === 'ArrowRight') showItem(activeIndex + 1);
    if (event.key === 'ArrowLeft') showItem(activeIndex - 1);
    if (event.key === '+' || event.key === '=') setZoom(Math.min(4, scale + 0.5));
    if (event.key === '-') setZoom(Math.max(1, scale - 0.5));
  }

  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) onClose?.();
  }

  async function showItem(index) {
    if (index < 0 && olderAvailable) {
      await loadMore('older');
      return;
    }
    if (index >= gallery.length && newerAvailable) {
      await loadMore('newer');
      return;
    }
    if (index < 0 || index >= gallery.length) return;
    activeIndex = (index + gallery.length) % gallery.length;
    resetZoom();
    preloadNeighborImages();
  }

  async function loadMore(direction) {
    if (moreLoading || typeof onLoadMore !== 'function') return;
    const cursor = direction === 'older' ? gallery[0] : gallery[gallery.length - 1];
    if (!cursor) return;
    moreLoading = direction;
    moreError = '';
    try {
      const page = await onLoadMore(direction, cursor);
      const existingIds = new Set(gallery.map(item => item.id));
      const newItems = (page?.items || []).filter(item => !existingIds.has(item.id));
      if (direction === 'older') {
        gallery = [...newItems, ...gallery];
        if (newItems.length) activeIndex = newItems.length - 1;
        olderAvailable = Boolean(page?.hasMore);
      } else {
        const oldLength = gallery.length;
        gallery = [...gallery, ...newItems];
        if (newItems.length) activeIndex = oldLength;
        newerAvailable = Boolean(page?.hasMore);
      }
      if (!newItems.length && page?.hasMore) moreError = '没有取得新媒体，请重试';
      if (newItems.length) resetZoom();
      if (newItems.length) preloadNeighborImages();
    } catch (error) {
      moreError = error.message || '媒体加载失败';
    } finally {
      moreLoading = '';
    }
  }

  function setZoom(nextScale) {
    scale = Math.max(1, Math.min(4, nextScale));
    if (scale === 1) {
      offsetX = 0;
      offsetY = 0;
    }
  }

  function toggleZoom() {
    setZoom(scale > 1 ? 1 : 2);
  }

  function distanceBetween(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function handleTouchStart(event) {
    if (!isImage) return;
    if (event.touches.length === 2) {
      gesture = { mode: 'pinch', distance: distanceBetween(event.touches), scale };
      return;
    }
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      gesture = {
        mode: scale > 1 ? 'pan' : 'swipe',
        x: touch.clientX,
        y: touch.clientY,
        offsetX,
        offsetY
      };
    }
  }

  function handleTouchMove(event) {
    if (!gesture || !isImage) return;
    if (gesture.mode === 'pinch' && event.touches.length === 2) {
      event.preventDefault();
      setZoom(gesture.scale * distanceBetween(event.touches) / gesture.distance);
      return;
    }
    if (gesture.mode === 'pan' && event.touches.length === 1) {
      event.preventDefault();
      const touch = event.touches[0];
      const boundX = window.innerWidth * (scale - 1) / 2;
      const boundY = window.innerHeight * (scale - 1) / 2;
      offsetX = Math.max(-boundX, Math.min(boundX, gesture.offsetX + touch.clientX - gesture.x));
      offsetY = Math.max(-boundY, Math.min(boundY, gesture.offsetY + touch.clientY - gesture.y));
    }
  }

  function handleTouchEnd(event) {
    if (!gesture) return;
    if (gesture.mode === 'swipe' && event.changedTouches.length && scale === 1) {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - gesture.x;
      const dy = touch.clientY - gesture.y;
      const now = Date.now();
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        showItem(activeIndex + (dx < 0 ? 1 : -1));
      } else if (now - lastTapAt < 320 && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        toggleZoom();
        lastTapAt = 0;
      } else {
        lastTapAt = now;
      }
    }
    gesture = null;
  }

  function handleWheel(event) {
    if (!isImage) return;
    event.preventDefault();
    setZoom(scale + (event.deltaY < 0 ? 0.25 : -0.25));
  }

  async function checkOfflineCache(url) {
    const checkId = ++cacheCheckId;
    cacheSaved = false;
    cacheError = '';
    if (!('caches' in window)) return;
    try {
      const cache = await caches.open('chat-uploads');
      const cached = await cache.match(url);
      if (checkId === cacheCheckId) cacheSaved = Boolean(cached);
    } catch (_) {
      if (checkId === cacheCheckId) cacheError = '无法读取离线缓存状态';
    }
  }

  async function saveForOffline() {
    if (cacheSaving || cacheSaved || !('caches' in window)) return;
    cacheSaving = true;
    cacheProgress = null;
    cacheError = '';
    try {
      const response = await fetch(currentItem.src);
      if (!response.ok) throw new Error('媒体下载失败');
      const cache = await caches.open('chat-uploads');
      const total = Number(response.headers.get('content-length')) || 0;
      if (response.body?.tee && total > 0) {
        const [cacheStream, progressStream] = response.body.tee();
        const cacheWrite = cache.put(currentItem.src, new Response(cacheStream, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        }));
        const reader = progressStream.getReader();
        let loaded = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          loaded += value.byteLength;
          cacheProgress = Math.min(99, Math.round(loaded / total * 100));
        }
        await cacheWrite;
        cacheProgress = 100;
      } else {
        await cache.put(currentItem.src, response.clone());
      }
      cacheSaved = true;
    } catch (error) {
      cacheError = error.message || '离线保存失败';
    } finally {
      cacheSaving = false;
    }
  }

  onMount(() => {
    gallery = initialItems.length ? [...initialItems] : [{ src, type, name: '' }];
    activeIndex = Math.max(0, Math.min(initialIndex, gallery.length - 1));
    olderAvailable = hasOlder;
    newerAvailable = hasNewer;
    moreError = loadError;
    preloadNeighborImages();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.body.style.overflow = '';
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="lightbox-overlay" on:click={handleOverlayClick}>
  <button class="close-btn" on:click={() => onClose?.()} aria-label="关闭">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </button>

  {#if isImage}
    <button class="zoom-btn" on:click={toggleZoom} aria-label={scale > 1 ? '缩小图片' : '放大图片'} title={scale > 1 ? '缩小' : '放大'}>
      {scale > 1 ? '−' : '+'}
    </button>
  {/if}

  <button class="offline-btn" class:saved={cacheSaved} on:click={saveForOffline} disabled={cacheSaved || cacheSaving || !('caches' in window)} aria-label={cacheSaved ? '已保存到离线缓存' : '保存媒体供离线查看'}>
    {cacheSaved ? '已离线' : cacheSaving ? (cacheProgress === null ? '保存中…' : `保存中 ${cacheProgress}%`) : '离线保存'}
  </button>

  <a class="download-btn" href={currentItem.src} download={currentItem.name || undefined} title="下载文件" aria-label="下载文件">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  </a>

  {#if gallery.length > 1 || olderAvailable || newerAvailable}
    <button class="nav-btn previous" on:click={() => showItem(activeIndex - 1)} aria-label="上一张">‹</button>
    <button class="nav-btn next" on:click={() => showItem(activeIndex + 1)} aria-label="下一张">›</button>
    <div class="item-count">{activeIndex + 1} / {gallery.length}</div>
  {/if}

  {#if moreLoading}
    <div class="media-status" role="status">正在加载{moreLoading === 'older' ? '更早' : '更新'}媒体…</div>
  {:else if moreError || cacheError}
    <div class="media-status error" role="status">{moreError || cacheError}</div>
  {/if}

  <div
    class="lightbox-content"
    class:zoomed={scale > 1}
    class:touch-gestures={isImage}
    on:touchstart={handleTouchStart}
    on:touchmove|nonpassive={handleTouchMove}
    on:touchend={handleTouchEnd}
    on:touchcancel={() => gesture = null}
    on:wheel|nonpassive={handleWheel}
  >
    {#key currentItem.src}
      {#if currentItem.type === 'image'}
        <img
          src={currentItem.src}
          alt={currentItem.name || ''}
          class="preview-image"
          style="transform: translate({offsetX}px, {offsetY}px) scale({scale})"
          on:dblclick={toggleZoom}
          draggable="false"
        />
      {:else if currentItem.type === 'video'}
        <video src={currentItem.src} controls autoplay playsinline class="preview-video"></video>
      {:else if currentItem.type === 'audio'}
        <div class="audio-wrapper">
          <div class="audio-icon">🎵</div>
          <audio src={currentItem.src} controls autoplay class="preview-audio"></audio>
        </div>
      {:else}
        <div class="unsupported">
          <p>无法预览此文件</p>
          <a href={currentItem.src} download class="download-link">下载文件</a>
        </div>
      {/if}
    {/key}
  </div>
</div>

<style>
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 500;
    background: rgba(0,0,0,0.94);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .lightbox-content {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .lightbox-content.touch-gestures { touch-action: none; }
  .lightbox-content:not(.touch-gestures) { touch-action: auto; }
  .lightbox-content.zoomed { cursor: grab; }
  .lightbox-content.zoomed:active { cursor: grabbing; }

  .preview-image {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 4px 30px rgba(0,0,0,0.5);
    -webkit-touch-callout: default;
    user-select: none;
    transition: transform 0.12s ease-out;
    will-change: transform;
  }

  .preview-video { max-width: 100%; max-height: 100%; border-radius: 4px; background: #000; }

  .close-btn, .download-btn, .zoom-btn, .nav-btn, .offline-btn {
    position: absolute;
    z-index: 501;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    background: rgba(255,255,255,0.16);
    cursor: pointer;
    backdrop-filter: blur(8px);
    text-decoration: none;
  }

  .close-btn { top: max(16px, env(safe-area-inset-top)); right: max(16px, env(safe-area-inset-right)); }
  .download-btn { top: max(16px, env(safe-area-inset-top)); right: calc(max(16px, env(safe-area-inset-right)) + 56px); }
  .zoom-btn { top: max(16px, env(safe-area-inset-top)); right: calc(max(16px, env(safe-area-inset-right)) + 112px); font-size: 28px; }
  .offline-btn { top: max(16px, env(safe-area-inset-top)); right: calc(max(16px, env(safe-area-inset-right)) + 168px); width: auto; padding: 0 12px; border-radius: 22px; font-size: 12px; }
  .offline-btn.saved { background: rgba(16,185,129,0.88); }
  .offline-btn:disabled { opacity: 0.85; cursor: default; }
  .nav-btn { top: 50%; transform: translateY(-50%); font-size: 40px; line-height: 1; }
  .nav-btn.previous { left: max(18px, env(safe-area-inset-left)); }
  .nav-btn.next { right: max(18px, env(safe-area-inset-right)); }
  .item-count { position: absolute; bottom: max(16px, env(safe-area-inset-bottom)); color: white; font-size: 14px; z-index: 501; }
  .media-status { position: absolute; bottom: max(44px, calc(env(safe-area-inset-bottom) + 36px)); z-index: 502; color: white; background: rgba(0,0,0,0.66); border-radius: 10px; padding: 8px 12px; font-size: 13px; }
  .media-status.error { color: #fecaca; }

  .audio-wrapper { text-align: center; padding: 40px; color: white; }
  .audio-icon { font-size: 64px; margin-bottom: 16px; }
  .preview-audio { width: 300px; max-width: 80vw; }
  .unsupported { text-align: center; color: white; padding: 40px; }
  .unsupported p { font-size: 16px; margin-bottom: 12px; }
  .download-link { color: #a5b4fc; font-size: 14px; text-decoration: underline; cursor: pointer; }

  @media (max-width: 768px) {
    .nav-btn { width: 40px; height: 48px; background: rgba(0,0,0,0.35); }
    .nav-btn.previous { left: max(8px, env(safe-area-inset-left)); }
    .nav-btn.next { right: max(8px, env(safe-area-inset-right)); }
  }
</style>
