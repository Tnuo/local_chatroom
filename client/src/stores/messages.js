import { writable } from 'svelte/store';

export const messages = writable({});

export function addMessage(roomId, msg) {
  messages.update(msgs => {
    const roomMessages = [...(msgs[roomId] || [])];
    const exists = roomMessages.find(m => m.id === msg.id);
    if (!exists) {
      roomMessages.push(msg);
    }
    return { ...msgs, [roomId]: roomMessages };
  });
}

export function updateMessage(msg) {
  messages.update(msgs => {
    const roomMessages = [...(msgs[msg.room_id] || [])];
    const index = roomMessages.findIndex(m => m.id === msg.id);
    if (index !== -1) {
      roomMessages[index] = msg;
    }
    return { ...msgs, [msg.room_id]: roomMessages };
  });
}

export function setMessages(roomId, msgs) {
  messages.update(all => ({ ...all, [roomId]: msgs }));
}

export function removeMessage(roomId, msgId) {
  messages.update(msgs => {
    const roomMessages = (msgs[roomId] || []).filter(m => m.id !== msgId);
    return { ...msgs, [roomId]: roomMessages };
  });
}
