import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router({ mergeParams: true });

// Get all tags used in project with counts
router.get('/tags', (req, res) => {
  const { projectId } = req.params;
  const db = getDb();

  const chapters = db
    .prepare('SELECT tags FROM chapters WHERE project_id = ?')
    .all(projectId) as { tags: string }[];

  const tagCounts = new Map<string, number>();
  for (const ch of chapters) {
    try {
      const tags: string[] = JSON.parse(ch.tags || '[]');
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    } catch {}
  }

  const tags = [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  res.json({ success: true, data: tags });
});

// Search chapters by tags
router.post('/search', (req, res) => {
  const { projectId } = req.params;
  const { tags, mode = 'any' } = req.body as { tags: string[]; mode?: 'any' | 'all' };

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ success: false, error: 'tags 参数必填' });
  }

  const db = getDb();
  const chapters = db
    .prepare('SELECT * FROM chapters WHERE project_id = ? ORDER BY sort_order ASC')
    .all(projectId) as any[];

  const filtered = chapters.filter((ch) => {
    try {
      const chTags: string[] = JSON.parse(ch.tags || '[]');
      if (mode === 'all') {
        return tags.every((t) => chTags.includes(t));
      }
      return tags.some((t) => chTags.includes(t));
    } catch {
      return false;
    }
  });

  res.json({ success: true, data: filtered });
});

export default router;
