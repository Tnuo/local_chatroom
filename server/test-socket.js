const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');

const userId = 'test-user-' + Date.now();

socket.on('connect', () => {
  console.log('[TEST] connected:', socket.id);

  socket.emit('user:join', {
    id: userId,
    nickname: 'TestBot',
    avatar_color: '#10b981'
  });

  setTimeout(() => {
    const res = fetch('http://localhost:3000/api/rooms')
      .then(r => r.json())
      .then(rooms => {
        const roomId = rooms[0].id;
        console.log('[TEST] sending message to room:', roomId);

        socket.emit('message:send', {
          roomId: roomId,
          type: 'text',
          content: 'Hello from test! ' + new Date().toISOString()
        });
      });
  }, 500);
});

socket.on('message:new', (msg) => {
  console.log('[TEST] message:new received:', JSON.stringify(msg));
  console.log('[TEST] PASS: Message round-trip succeeded');
  process.exit(0);
});

socket.on('users:online', (list) => {
  console.log('[TEST] online users:', list.length);
});

socket.on('connect_error', (err) => {
  console.error('[TEST] connection error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('[TEST] FAIL: No message received within 10s');
  process.exit(1);
}, 10000);
