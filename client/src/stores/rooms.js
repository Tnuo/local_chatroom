import { writable } from 'svelte/store';

export const rooms = writable([]);
export const currentRoomId = writable(null);
export const onlineUsers = writable([]);

export let unreadCounts = {};
const unreadStore = writable({});

export function incrementUnread(roomId) {
  if (!unreadCounts[roomId]) unreadCounts[roomId] = 0;
  unreadCounts[roomId]++;
  unreadStore.set({ ...unreadCounts });
}

export function clearUnread(roomId) {
  unreadCounts[roomId] = 0;
  unreadStore.set({ ...unreadCounts });
}

export { unreadStore };

export function removeRoom(roomId) {
  rooms.update(all => all.filter(r => r.id !== roomId));
  delete unreadCounts[roomId];
  unreadStore.set({ ...unreadCounts });
}

export function renameRoom(roomId, name) {
  rooms.update(all => all.map(r => r.id === roomId ? { ...r, name } : r));
}
