import { Router } from 'express';
import { listPlugins, getPluginSkills } from '../plugins/registry.js';

const router = Router();

router.get('/', (_req, res) => {
  const plugins = listPlugins();
  res.json({ success: true, data: plugins });
});

router.get('/skills', (_req, res) => {
  const skills = getPluginSkills();
  res.json({ success: true, data: skills });
});

export default router;
