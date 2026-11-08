<script>
  import { onMount, onDestroy } from 'svelte';
  import { searchQuery, searchResults } from '../stores/search.js';

  export let onNavigate;
  export let isMobile = false;

  let searchInput;
  let showResults = false;
  let debounceTimer;
  let blurTimer;
  let searchController;
  let searchRequestId = 0;
  let searching = false;
  let searchError = '';
  let results = [];

  onMount(() => {
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  });

  onDestroy(() => {
    clearTimeout(debounceTimer);
    clearTimeout(blurTimer);
    searchController?.abort();
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
    searchController?.abort();
    searchController = null;
    const requestId = ++searchRequestId;
    const q = searchInput?.value?.trim();
    $searchQuery = q;
    searchError = '';

    if (!q) {
      results = [];
      showResults = false;
      searching = false;
      searchResults.set([]);
      return;
    }

    results = [];
    searchResults.set([]);
    showResults = true;
    searching = true;
    debounceTimer = setTimeout(async () => {
      const controller = new AbortController();
      searchController = controller;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error('搜索暂时不可用');
        const nextResults = await res.json();
        if (requestId !== searchRequestId) return;
        results = nextResults;
        searchResults.set(results);
      } catch (e) {
        if (e.name !== 'AbortError' && requestId === searchRequestId) {
          searchError = e.message || '搜索失败，请重试';
        }
      } finally {
        if (requestId === searchRequestId) searching = false;
      }
    }, 200);
  }

  function navigateTo(msg) {
    clearTimeout(debounceTimer);
    searchController?.abort();
    searchRequestId++;
    searching = false;
    searchError = '';
    $searchQuery = '';
    showResults = false;
    if (searchInput) searchInput.value = '';
    results = [];
    searchResults.set([]);
    onNavigate?.({ roomId: msg.room_id, messageId: msg.id });
  }

  function handleFocus() {
    clearTimeout(blurTimer);
    if (searchInput?.value?.trim() && (results.length || searching || searchError)) {
      showResults = true;
    }
  }

  function handleBlur() {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => { showResults = false; }, 250);
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
      aria-label="搜索消息"
      autocomplete="off"
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
  {:else if showResults && searching}
    <div class="results-dropdown empty" role="status">
      <p>搜索中…</p>
    </div>
  {:else if showResults && searchError}
    <div class="results-dropdown empty error" role="alert">
      <p>{searchError}</p>
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
    min-height: 44px;
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
  .results-dropdown.empty.error { color: #b91c1c; }

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
