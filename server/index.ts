import fs from 'fs';
import path from 'path';
import http from 'http';
import app from './app.js';
import { runMigrations } from './db/migrations.js';
import { seedBuiltins } from './db/repositories/templateRepo.js';
import { createWsServer } from './ws/wsServer.js';

const PORT = 3210;

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

runMigrations();
seedBuiltins();

const server = http.createServer(app);
createWsServer(server);

server.listen(PORT, () => {
  console.log(`[Xbboook] Server running at http://localhost:${PORT}`);
  console.log(`[Xbboook] API available at http://localhost:${PORT}/api`);
  console.log(`[Xbboook] WebSocket available at ws://localhost:${PORT}/ws`);
});
