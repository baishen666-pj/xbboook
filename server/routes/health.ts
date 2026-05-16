import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  let dbStatus = 'ok';
  try {
    db.prepare('SELECT 1').get();
  } catch {
    dbStatus = 'error';
  }

  res.json({
    success: true,
    data: {
      status: dbStatus === 'ok' ? 'healthy' : 'degraded',
      db: dbStatus,
      uptime: Math.floor(process.uptime()),
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;