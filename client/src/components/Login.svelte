<script>
  import { currentUser } from '../stores/user.js';

  let nickname = '';
  let loading = false;
  let error = '';

  const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4'];
  let selectedColor = COLORS[Math.floor(Math.random() * COLORS.length)];

  async function handleSubmit() {
    if (!nickname.trim()) {
      error = '请输入昵称';
      return;
    }

    loading = true;
    error = '';

    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '注册失败');
      }

      const user = await res.json();
      currentUser.set({ ...user, avatar_color: selectedColor });
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') handleSubmit();
  }
</script>

<div class="login-container">
  <div class="login-card">
    <div class="logo">
      <div class="logo-icon">💬</div>
      <h1>局域网聊天室</h1>
      <p>设置您的昵称开始聊天</p>
    </div>

    <div class="form-group">
      <label for="nickname">昵称</label>
      <input
        id="nickname"
        type="text"
        bind:value={nickname}
        on:keydown={handleKeydown}
        placeholder="输入您的昵称..."
        maxlength="20"
        autocomplete="off"
      />
    </div>

    <div class="form-group">
      <label>头像颜色</label>
      <div class="color-picker">
        {#each COLORS as color}
          <button
            class="color-dot"
            style="background: {color}"
            class:active={selectedColor === color}
            on:click={() => selectedColor = color}
            aria-label="选择颜色"
          ></button>
        {/each}
      </div>
    </div>

    {#if error}
      <div class="error-msg">{error}</div>
    {/if}

    <button class="btn-submit" on:click={handleSubmit} disabled={loading}>
      {loading ? '进入中...' : '进入聊天'}
    </button>
  </div>
</div>

<style>
  .login-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .login-card {
    background: white;
    border-radius: 20px;
    padding: 36px 32px;
    width: 380px;
    max-width: 92vw;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  }

  .logo {
    text-align: center;
    margin-bottom: 28px;
  }

  .logo-icon {
    font-size: 44px;
    margin-bottom: 8px;
  }

  .logo h1 {
    font-size: 22px;
    color: #1a1a2e;
    margin-bottom: 4px;
  }

  .logo p {
    color: #6b7280;
    font-size: 14px;
  }

  .form-group {
    margin-bottom: 18px;
  }

  label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 8px;
  }

  input[type="text"] {
    width: 100%;
    padding: 14px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    font-size: 16px;
    transition: border-color 0.2s;
    outline: none;
    -webkit-appearance: none;
  }

  input[type="text"]:focus {
    border-color: #6366f1;
  }

  .color-picker {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .color-dot {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.15s, border-color 0.15s;
  }

  .color-dot:hover {
    transform: scale(1.15);
  }

  .color-dot.active {
    border-color: #1a1a2e;
    transform: scale(1.1);
  }

  .error-msg {
    color: #ef4444;
    font-size: 13px;
    margin-bottom: 12px;
    text-align: center;
  }

  .btn-submit {
    width: 100%;
    padding: 15px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
    margin-top: 8px;
    min-height: 50px;
  }

  .btn-submit:hover {
    opacity: 0.9;
  }

  .btn-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .login-card {
      padding: 28px 20px;
      border-radius: 16px;
    }

    .login-container {
      align-items: flex-start;
      padding-top: 10vh;
      padding-top: 10dvh;
    }

    .color-dot {
      width: 40px;
      height: 40px;
    }

    input[type="text"] {
      padding: 14px 16px;
      font-size: 16px;
    }
  }
</style>
