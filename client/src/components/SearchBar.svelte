<script>
  import { onMount } from 'svelte';
  import { searchQuery, searchResults } from '../stores/search.js';

  export let onNavigate;
  export let isMobile = false;

  let searchInput;
  let showResults = false;
  let debounceTimer;
  let results = [];

  onMount(() => {
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  });

  function handleGlobalKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput?.focus();
    }
    if (e.key === '/' && document.activeElement === document.body) {
      e.preventDefault();
      searchInput?.focus();
    }
  }

  function handleInput() {
    clearTimeout(debounceTimer);
    const q = searchInput?.value?.trim();
    $searchQuery = q;

    if (!q) {
      results = [];
      showResults = false;
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        results = await res.json();
        searchResults.set(results);
        showResults = true;
      } catch (e) {
        console.error(e);
      }
    }, 200);
  }

  function navigateTo(msg) {
    showResults = false;
    if (searchInput) searchInput.value = '';
    results = [];
    searchResults.set([]);
    onNavigate?.({ roomId: msg.room_id, messageId: msg.id });
  }

  function handleFocus() {
    if (searchInput?.value?.trim()) {
      showResults = true;
    }
  }

  function handleBlur() {
    setTimeout(() => { showResults = false; }, 250);
  }

  function truncate(text, len = 60) {
    if (!text) return '';
    return text.length > len ? text.substring(0, len) + '...' : text;
  }

  function formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="search-container">
  <div class="search-bar">
    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input
      bind:this={searchInput}
      type="search"
      placeholder="搜索消息..."
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
    />
    {#if !isMobile}
      <span class="shortcut-hint">Ctrl+K</span>
    {/if}
  </div>

  {#if showResults && results.length > 0}
    <div class="results-dropdown">
      {#each results as msg}
        <button class="result-item" on:click={() => navigateTo(msg)}>
          <span class="result-room">#{msg.room_name}</span>
          <span class="result-text">{truncate(msg.content, 50)}</span>
          <span class="result-meta">{msg.user_nickname} · {formatTime(msg.created_at)}</span>
        </button>
      {/each}
    </div>
  {:else if showResults && $searchQuery}
    <div class="results-dropdown empty">
      <p>未找到相关消息</p>
    </div>
  {/if}
</div>

<style>
  .search-container {
    position: relative;
    z-index: 50;
  }

  .search-bar {
    display: flex;
    align-items: center;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    padding: 6px 12px;
    gap: 8px;
  }

  .search-icon {
    color: #9ca3af;
    flex-shrink: 0;
  }

  .search-bar input {
    flex: 1;
    border: none;
    background: #f3f4f6;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 14px;
    outline: none;
    -webkit-appearance: none;
  }

  .search-bar input:focus {
    background: #e5e7eb;
  }

  .shortcut-hint {
    font-size: 11px;
    color: #9ca3af;
    background: #f3f4f6;
    padding: 3px 6px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .results-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    max-height: 50vh;
    max-height: 50dvh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .results-dropdown.empty {
    padding: 28px;
    text-align: center;
    color: #9ca3af;
    font-size: 14px;
  }

  .result-item {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 12px 14px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    border-bottom: 1px solid #f3f4f6;
    gap: 2px;
    min-height: 48px;
  }

  .result-item:hover {
    background: #f9fafb;
  }

  .result-room {
    font-size: 11px;
    color: #6366f1;
    font-weight: 500;
  }

  .result-text {
    font-size: 13px;
    color: #1f2937;
    line-height: 1.4;
  }

  .result-meta {
    font-size: 11px;
    color: #9ca3af;
  }

  @media (max-width: 768px) {
    .search-bar {
      padding: 6px 10px;
    }

    .search-bar input {
      font-size: 16px;
      padding: 10px 12px;
    }

    .result-item {
      padding: 14px 14px;
      min-height: 52px;
    }
  }
</style>
