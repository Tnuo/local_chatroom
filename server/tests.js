const http = require('http');
const { io } = require('socket.io-client');

const BASE = 'http://localhost:3000';
let testUser = null;
let defaultRoomId = null;
let createdRoomId = null;
let createdMessageId = null;
let passed = 0;
let failed = 0;

function log(label, ok, detail) {
  const mark = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${mark} ${label}${detail ? ': ' + detail : ''}`);
  if (ok) passed++; else failed++;
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url, BASE);
    const req = http.request(u, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...opts.headers },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\n═══ LocalChatroom Test Suite ═══\n');

  // ─── User tests ───
  console.log('━ User ━━━━━━━━━━━━━━━━━━━━━━━━');
  {
    const res = await fetch('/api/users/register', {
      method: 'POST', body: { nickname: 'TestUser_' + Date.now() }
    });
    log('POST /api/users/register', res.status === 200, 'returns user object');
    testUser = res.data;
    assert(testUser.id, 'user has id');
    assert(testUser.nickname, 'user has nickname');
    log('User has nickname', !!testUser.nickname, testUser.nickname);
    log('User has avatar_color', !!testUser.avatar_color, testUser.avatar_color);
  }
  {
    const res = await fetch('/api/users');
    log('GET /api/users', res.status === 200, 'returns array');
    log('User list contains test user', Array.isArray(res.data) && res.data.some(u => u.id === testUser.id));
  }
  {
    const res = await fetch('/api/users/' + testUser.id + '/heartbeat', { method: 'PUT' });
    log('PUT /api/users/:id/heartbeat', res.status === 200);
  }

  // ─── Room tests ───
  console.log('\n━ Room ━━━━━━━━━━━━━━━━━━━━━━━━');
  {
    const res = await fetch('/api/rooms');
    log('GET /api/rooms', res.status === 200, res.data.length + ' rooms');
    log('Default room exists', res.data.some(r => r.is_default === 1));
    log('Default room name', res.data.some(r => r.name), null);
    defaultRoomId = res.data.find(r => r.is_default === 1)?.id;
    assert(defaultRoomId, 'default room has id');
  }

  // Create room
  {
    const res = await fetch('/api/rooms', {
      method: 'POST', body: { name: 'TestRoom_' + Date.now(), created_by: testUser.id }
    });
    log('POST /api/rooms', res.status === 200, 'creates room');
    createdRoomId = res.data?.id;
    assert(createdRoomId, 'created room has id');
    log('Created room has name', res.data?.name, res.data?.name);
  }

  // Rename room
  {
    const res = await fetch('/api/rooms/' + createdRoomId, {
      method: 'PUT', body: { name: 'RenamedRoom_' + Date.now() }
    });
    log('PUT /api/rooms/:id (rename)', res.status === 200);
    log('Name updated', res.data?.name && !res.data.name.startsWith('TestRoom'), res.data?.name);
  }

  // Max rooms
  {
    const res = await fetch('/api/config');
    const maxRooms = res.data.rooms.max_rooms;
    log('GET /api/config', res.status === 200, 'max_rooms=' + maxRooms);
  }

  // ─── Message APIs ───
  console.log('\n━ Message API ━━━━━━━━━━━━━━━━━━');
  {
    const res = await fetch('/api/messages/' + defaultRoomId + '?limit=10');
    log('GET /api/messages/:roomId', res.status === 200, Array.isArray(res.data) ? res.data.length + ' messages' : 'not array');
  }

  // ─── Search ───
  console.log('\n━ Search ━━━━━━━━━━━━━━━━━━━━━━━');
  {
    const res = await fetch('/api/search?q=nothing');
    log('GET /api/search (no results)', res.status === 200, 'array length=' + res.data.length);
  }

  // ─── Socket message send/receive ───
  console.log('\n━ Socket ━━━━━━━━━━━━━━━━━━━━━━━');
  let socketTestPassed = false;
  await new Promise((resolve, reject) => {
    const socket = io(BASE, { transports: ['websocket'], timeout: 5000 });
    const timeout = setTimeout(() => {
      log('Socket message round-trip', false, 'timeout');
      socket.close();
      resolve();
    }, 8000);

    socket.on('connect', () => {
      log('Socket connected', true, socket.id);
      socket.emit('user:join', testUser);

      socket.on('users:online', () => {
        socket.emit('room:join', defaultRoomId);
        socket.emit('message:send', {
          roomId: defaultRoomId,
          type: 'text',
          content: 'Test message from test suite'
        });
      });

      socket.on('message:new', (msg) => {
        if (msg.content === 'Test message from test suite') {
          clearTimeout(timeout);
          socketTestPassed = true;
          createdMessageId = msg.id;
          log('Socket message:send + message:new round-trip', true, 'id=' + msg.id.slice(0,8));
          // Test permanent toggle
          socket.emit('message:permanent', { messageId: msg.id, is_permanent: true });
          setTimeout(() => {
            socket.emit('message:permanent', { messageId: msg.id, is_permanent: false });
          }, 500);
        }
      });

      socket.on('message:updated', (msg) => {
        if (msg.id === createdMessageId) {
          log('Socket message:permanent toggle', true, 'is_permanent=' + msg.is_permanent);
        }
      });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      log('Socket connection', false, err.message);
      socket.close();
      resolve();
    });

    setTimeout(() => {
      if (socketTestPassed) {
        // Test message delete
        socket.emit('message:delete', {
          messageId: createdMessageId,
          userId: testUser.id
        });

        socket.on('message:deleted', (data) => {
          log('Socket message:delete', true, 'id=' + data.id.slice(0,8));
          socket.close();
          resolve();
        });
      }
    }, 3000);
  });

  // ─── Cleanup round-trip ───
  console.log('\n━ Cleanup ━━━━━━━━━━━━━━━━━━━━━━');
  {
    const res = await fetch('/api/messages/' + defaultRoomId + '?limit=5');
    const msgs = res.data || [];
    const testMsg = msgs.find(m => m.id === createdMessageId);
    log('Message deleted from DB', !testMsg, testMsg ? 'still exists' : 'gone');
  }

  // Delete created room
  {
    const res = await fetch('/api/rooms/' + createdRoomId, { method: 'DELETE' });
    log('DELETE /api/rooms/:id', res.status === 200);
  }
  {
    const res = await fetch('/api/rooms');
    log('Room removed from list', res.data.every(r => r.id !== createdRoomId));
  }

  // Default room not deletable
  {
    const res = await fetch('/api/rooms/' + defaultRoomId, { method: 'DELETE' });
    log('DELETE default room blocked', res.status === 400, res.data.error);
  }

  // ─── Summary ───
  console.log('\n═══ Results ═══');
  console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed > 0) {
    console.log('\x1b[31m  SOME TESTS FAILED\x1b[0m');
    process.exit(1);
  } else {
    console.log('\x1b[32m  ALL TESTS PASSED\x1b[0m');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('\n\x1b[31mFATAL:', err.message, '\x1b[0m');
  process.exit(1);
});
