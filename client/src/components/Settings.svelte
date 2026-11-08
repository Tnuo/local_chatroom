<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  export let onClose;

  const dispatch = createEventDispatcher();

  let config = null;
  let saveMsg = '';
  let loading = false;

  onMount(async () => {
    try {
      const res = await fetch('/api/config');
      config = await res.json();
    } catch (e) {
      console.error(e);
    }
  });

  async function save() {
    loading = true;
    saveMsg = '';
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            retention_days: Number(config.message.retention_days),
            page_size: Number(config.message.page_size)
          }
        })
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || '保存失败');
      }
      const result = await res.json();
      config = result.config;
      saveMsg = '✓ 已保存';
      setTimeout(() => saveMsg = '', 2000);
    } catch (e) {
      saveMsg = e.message || '保存失败';
    } finally {
      loading = false;
    }
  }
</script>

<div class="settings-overlay" on:click|self={() => onClose?.()}>
  <div class="settings-panel">
    <div class="panel-header">
      <h2>设置</h2>
      <button class="close-btn" on:click={() => onClose?.()} aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    {#if config}
      <div class="panel-body">
        <section class="setting-section">
          <h3>消息留存</h3>
          <p class="desc">超过天数的消息将自动清理（永久保存的消息不受影响）</p>
          <div class="field-row">
            <input type="number" bind:value={config.message.retention_days} min="1" max="365" class="num-input" />
            <span>天</span>
          </div>
        </section>

        <section class="setting-section">
          <h3>每次加载消息数</h3>
          <p class="desc">打开房间时加载的最新消息条数，上滑加载更多</p>
          <div class="field-row">
            <input type="number" bind:value={config.message.page_size} min="10" max="200" class="num-input" />
            <span>条</span>
          </div>
        </section>

        <div class="save-row">
          {#if saveMsg}
            <span class="save-msg" class:error={saveMsg.includes('失败')}>{saveMsg}</span>
          {/if}
          <button class="btn-save" on:click={save} disabled={loading}>
            {loading ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    {:else}
      <div class="panel-body loading">加载中...</div>
    {/if}
  </div>
</div>

<style>
  .settings-overlay {
    position: fixed;
    inset: 0;
    z-index: 400;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .settings-panel {
    background: white;
    border-radius: 16px;
    width: 440px;
    max-width: 92vw;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 12px;
    border-bottom: 1px solid #f3f4f6;
  }

  .panel-header h2 {
    font-size: 18px;
    color: #1a1a2e;
  }

  .close-btn {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    min-width: 36px;
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .close-btn:hover { background: #f3f4f6; }

  .panel-body {
    padding: 20px 24px;
    overflow-y: auto;
    flex: 1;
  }

  .panel-body.loading {
    text-align: center;
    color: #9ca3af;
    padding: 40px;
  }

  .setting-section {
    margin-bottom: 24px;
  }

  .setting-section h3 {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
    margin-bottom: 4px;
  }

  .desc {
    font-size: 12px;
    color: #9ca3af;
    margin-bottom: 10px;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .num-input {
    width: 80px;
    padding: 8px 12px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
  }
  .num-input:focus { border-color: #6366f1; }

  .save-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid #f3f4f6;
  }

  .save-msg {
    font-size: 13px;
    color: #10b981;
  }
  .save-msg.error { color: #ef4444; }

  .btn-save {
    padding: 10px 24px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
  }
  .btn-save:hover { opacity: 0.9; }
  .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
