<script>
  import { currentUser } from './stores/user.js';
  import Login from './components/Login.svelte';
  import ChatLayout from './components/ChatLayout.svelte';

  $: showChat = $currentUser !== null;
</script>

{#if showChat}
  <ChatLayout />
{:else}
  <Login />
{/if}

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: #f0f2f5;
    color: #1a1a2e;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }

  :global(#app) {
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  :global(::-webkit-scrollbar) {
    width: 5px;
  }

  :global(::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(::-webkit-scrollbar-thumb) {
    background: #c1c1c1;
    border-radius: 10px;
  }
</style>
