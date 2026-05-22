import { writable } from 'svelte/store';

const stored = typeof localStorage !== 'undefined'
  ? JSON.parse(localStorage.getItem('chat_user') || 'null')
  : null;

export const currentUser = writable(stored);

currentUser.subscribe((value) => {
  if (typeof localStorage !== 'undefined') {
    if (value) {
      localStorage.setItem('chat_user', JSON.stringify(value));
    } else {
      localStorage.removeItem('chat_user');
    }
  }
});
