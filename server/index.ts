import fs from 'fs';
import path from 'path';
import app from './app.js';
import { runMigrations } from './db/migrations.js';
import { seedBuiltins } from './db/repositories/templateRepo.js';

const PORT = 3210;

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

runMigrations();
seedBuiltins();

app.listen(PORT, () => {
  console.log(`[Xbboook] Server running at http://localhost:${PORT}`);
  console.log(`[Xbboook] API available at http://localhost:${PORT}/api`);
});
