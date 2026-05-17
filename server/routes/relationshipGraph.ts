import { Router } from 'express';
import { getDb } from '../db/database.js';
import { readChapter } from '../services/fileService.js';

const router = Router({ mergeParams: true });

interface CharacterRow {
  id: string;
  name: string;
  nickname: string | null;
  role_type: string | null;
  gender: string | null;
}

interface ChapterRow {
  id: string;
  title: string;
  sort_order: number;
}

router.get('/', async (req, res) => {
  const { projectId } = req.params as { projectId: string };

  try {
    const db = getDb();

    const characters = db.prepare(
      'SELECT id, name, nickname, role_type, gender FROM characters WHERE project_id = ? ORDER BY name'
    ).all(projectId) as CharacterRow[];

    const nodes = characters.map(c => ({
      id: c.id,
      name: c.name,
      nickname: c.nickname || '',
      roleType: c.role_type || 'unknown',
      gender: c.gender || '',
    }));

    const chapters = db.prepare(
      'SELECT id, title, sort_order FROM chapters WHERE project_id = ? ORDER BY sort_order'
    ).all(projectId) as ChapterRow[];

    const charNameMap = new Map<string, string>();
    for (const c of characters) {
      charNameMap.set(c.name, c.id);
    }

    const cooccurrence: Record<string, number> = {};

    for (const ch of chapters.slice(0, 30)) {
      let content: string;
      try {
        content = await readChapter(projectId, ch.id);
      } catch {
        continue;
      }

      if (!content.trim()) continue;

      const presentCharIds: string[] = [];
      for (const [name, id] of charNameMap) {
        if (content.includes(name)) {
          presentCharIds.push(id);
        }
      }

      for (let i = 0; i < presentCharIds.length; i++) {
        for (let j = i + 1; j < presentCharIds.length; j++) {
          const key = presentCharIds[i] < presentCharIds[j]
            ? `${presentCharIds[i]}::${presentCharIds[j]}`
            : `${presentCharIds[j]}::${presentCharIds[i]}`;
          cooccurrence[key] = (cooccurrence[key] || 0) + 1;
        }
      }
    }

    const edges = Object.entries(cooccurrence)
      .filter(([, count]) => count >= 1)
      .map(([key, count]) => {
        const [source, target] = key.split('::');
        const sourceChar = characters.find(c => c.id === source);
        const targetChar = characters.find(c => c.id === target);
        return {
          source,
          target,
          weight: count,
          relationType: 'co-occurrence',
          description: `${sourceChar?.name || source} 与 ${targetChar?.name || target} 共同出现 ${count} 次`,
        };
      });

    res.json({ success: true, data: { nodes, edges } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取关系图谱失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
