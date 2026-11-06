const DB_NAME = 'local-chatroom-offline';
const DB_VERSION = 1;
let databasePromise;

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('rooms')) db.createObjectStore('rooms', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('room_id', 'room_id', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

async function runTransaction(storeName, mode, action) {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const result = action(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(result?.result ?? null);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function cacheRooms(rooms) {
  const db = await openDatabase();
  if (!db || !rooms?.length) return;
  await new Promise((resolve, reject) => {
    const transaction = db.transaction('rooms', 'readwrite');
    const store = transaction.objectStore('rooms');
    rooms.forEach(room => store.put(room));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCachedRooms() {
  return (await runTransaction('rooms', 'readonly', store => store.getAll())) || [];
}

export async function cacheMessages(roomId, messages) {
  const db = await openDatabase();
  if (!db || !roomId || !messages?.length) return;
  await new Promise((resolve, reject) => {
    const transaction = db.transaction('messages', 'readwrite');
    const store = transaction.objectStore('messages');
    messages.forEach(message => store.put(message));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCachedMessages(roomId) {
  const db = await openDatabase();
  if (!db || !roomId) return [];
  return new Promise((resolve, reject) => {
    const request = db.transaction('messages', 'readonly').objectStore('messages').index('room_id').getAll(roomId);
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.created_at.localeCompare(b.created_at)));
    request.onerror = () => reject(request.error);
  });
}
