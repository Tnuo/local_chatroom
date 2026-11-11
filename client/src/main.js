import App from './App.svelte';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

if ('caches' in window) {
  caches.delete('chat-uploads').catch(() => {});
}

const app = new App({
  target: document.getElementById('app')
});

export default app;
