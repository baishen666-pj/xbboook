import { Router } from 'express';
import * as achievementRepo from '../db/repositories/achievementRepo.js';

const router = Router({ mergeParams: true });

router.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const earned = achievementRepo.findByProject(projectId);
  res.json({
    success: true,
    data: {
      earned,
      definitions: achievementRepo.BADGE_DEFINITIONS,
    },
  });
});

export default router;
