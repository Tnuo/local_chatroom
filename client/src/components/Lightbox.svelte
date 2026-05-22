<script>
  import { onMount, onDestroy } from 'svelte';

  export let src = '';
  export let type = 'image';
  export let onClose;

  function handleKeydown(e) {
    if (e.key === 'Escape') onClose?.();
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose?.();
  }

  onMount(() => {
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

  <div class="lightbox-content">
    {#if type === 'image' || (!type && src.match(/\.(jpg|jpeg|png|gif|webp|svg)/i))}
      <img src={src} alt="" class="preview-image" />
    {:else if type === 'video' || (!type && src.match(/\.(mp4|webm)/i))}
      <video src={src} controls autoplay playsinline class="preview-video"></video>
    {:else if type === 'audio' || (!type && src.match(/\.(mp3|wav|ogg)/i))}
      <div class="audio-wrapper">
        <div class="audio-icon">🎵</div>
        <audio src={src} controls autoplay class="preview-audio"></audio>
      </div>
    {:else}
      <div class="unsupported">
        <p>无法预览此文件</p>
        <a href={src} download class="download-link">下载文件</a>
      </div>
    {/if}
  </div>
</div>

<style>
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 500;
    background: rgba(0,0,0,0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 501;
    background: rgba(255,255,255,0.15);
    border: none;
    color: white;
    cursor: pointer;
    padding: 10px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    backdrop-filter: blur(8px);
  }

  .close-btn:hover { background: rgba(255,255,255,0.25); }

  .lightbox-content {
    max-width: 95vw;
    max-height: 95vh;
    max-height: 95dvh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-image {
    max-width: 95vw;
    max-height: 95vh;
    max-height: 95dvh;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 4px 30px rgba(0,0,0,0.5);
  }

  .preview-video {
    max-width: 95vw;
    max-height: 95vh;
    max-height: 95dvh;
    border-radius: 4px;
    box-shadow: 0 4px 30px rgba(0,0,0,0.5);
  }

  .audio-wrapper {
    text-align: center;
    padding: 40px;
  }

  .audio-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .preview-audio {
    width: 300px;
    max-width: 80vw;
  }

  .unsupported {
    text-align: center;
    color: white;
    padding: 40px;
  }

  .unsupported p {
    font-size: 16px;
    margin-bottom: 12px;
  }

  .download-link {
    color: #6366f1;
    font-size: 14px;
    text-decoration: underline;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .close-btn {
      top: 8px;
      right: 8px;
    }
  }
</style>
