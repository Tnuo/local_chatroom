const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');
const { getConfig } = require('./config');
const { initDb } = require('./db');
const { CLIENT_DIST, UPLOADS_DIR } = require('./paths');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 50 * 1024 * 1024
});

app.use(cors());
app.use(express.json());

initDb();

const config = getConfig();

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

const { setupSocket } = require('./socket');
setupSocket(io);

app.use('/uploads', express.static(UPLOADS_DIR));

if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({ message: 'Chatroom API server running. Frontend not found — run "npm run dev" in client/ for local dev.' });
  });
}

const { scheduleCleanup } = require('./cleanup');
scheduleCleanup();

const PORT = config.server?.port || 3000;
server.listen(PORT, () => {
  console.log(`Chatroom server running on port ${PORT}`);
});
