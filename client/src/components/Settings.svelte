<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  export let onClose;

  const dispatch = createEventDispatcher();

  let config = null;
  let newExt = '';
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

  function addExtension() {
    if (!newExt.trim()) return;
    let ext = newExt.trim().toLowerCase();
    if (!ext.startsWith('.')) ext = '.' + ext;
    if (!config.files.allowed_extensions.includes(ext)) {
      config.files.allowed_extensions = [...config.files.allowed_extensions, ext];
    }
    newExt = '';
  }

  function removeExtension(ext) {
    config.files.allowed_extensions = config.files.allowed_extensions.filter(e => e !== ext);
  }

  async function save() {
    loading = true;
    saveMsg = '';
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: { allowed_extensions: config.files.allowed_extensions },
          message: { retention_days: Number(config.message.retention_days) }
        })
      });
      if (!res.ok) throw new Error('保存失败');
      saveMsg = '✓ 已保存';
      setTimeout(() => saveMsg = '', 2000);
    } catch (e) {
      saveMsg = '保存失败';
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
          <h3>允许的文件类型</h3>
          <p class="desc">添加或移除可上传的文件扩展名</p>
          <div class="ext-list">
            {#each config.files.allowed_extensions as ext}
              <span class="ext-tag">
                {ext}
                <button on:click={() => removeExtension(ext)} title="移除">×</button>
              </span>
            {/each}
          </div>
          <div class="add-ext-row">
            <input
              type="text"
              bind:value={newExt}
              placeholder=".ext"
              on:keydown={(e) => e.key === 'Enter' && addExtension()}
            />
            <button on:click={addExtension}>添加</button>
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
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .settings-panel {
    background: white;
    border-radius: 16px;
    width: 440px;
    max-width: 92vw;
    max-height: 85vh;
    max-height: 85dvh;
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

  .ext-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .ext-tag {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #f3f4f6;
    padding: 4px 8px 4px 12px;
    border-radius: 20px;
    font-size: 13px;
    color: #374151;
  }

  .ext-tag button {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 16px;
    padding: 0 2px;
    line-height: 1;
  }
  .ext-tag button:hover { color: #ef4444; }

  .add-ext-row {
    display: flex;
    gap: 8px;
  }

  .add-ext-row input {
    flex: 1;
    padding: 8px 12px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
  }
  .add-ext-row input:focus { border-color: #6366f1; }

  .add-ext-row button {
    padding: 8px 16px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    min-height: 40px;
  }

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
