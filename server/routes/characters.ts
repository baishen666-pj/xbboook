import { Router } from 'express';
import * as charRepo from '../db/repositories/characterRepo.js';

const router = Router({ mergeParams: true });

// List characters for a project
router.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const characters = charRepo.findByProject(projectId);
  const relations = charRepo.findRelations(projectId);
  res.json({ success: true, data: { characters, relations } });
});

// Get single character
router.get('/:id', (req, res) => {
  const character = charRepo.findById(req.params.id);
  if (!character) {
    res.status(404).json({ success: false, error: 'Character not found' });
    return;
  }
  const relations = charRepo.findRelationsForCharacter(req.params.id);
  res.json({ success: true, data: { character, relations } });
});

// Create character
router.post('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { name, nickname, roleType, gender, age, appearance, personality, background, abilities, notes } = req.body;

  if (!name) {
    res.status(400).json({ success: false, error: 'name is required' });
    return;
  }

  const character = charRepo.create({
    projectId,
    name,
    nickname,
    roleType,
    gender,
    age,
    appearance,
    personality,
    background,
    abilities,
    notes,
  });

  res.status(201).json({ success: true, data: character });
});

// Update character
router.put('/:id', (req, res) => {
  const character = charRepo.update(req.params.id, req.body);
  if (!character) {
    res.status(404).json({ success: false, error: 'Character not found' });
    return;
  }
  res.json({ success: true, data: character });
});

// Delete character
router.delete('/:id', (req, res) => {
  const deleted = charRepo.deleteById(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Character not found' });
    return;
  }
  res.json({ success: true, data: null });
});

// Create relation
router.post('/relations', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { characterAId, characterBId, relationType, description } = req.body;

  if (!characterAId || !characterBId || !relationType) {
    res.status(400).json({ success: false, error: 'characterAId, characterBId, and relationType are required' });
    return;
  }

  const relation = charRepo.createRelation({
    projectId,
    characterAId,
    characterBId,
    relationType,
    description,
  });

  res.status(201).json({ success: true, data: relation });
});

// Delete relation
router.delete('/relations/:relationId', (req, res) => {
  const deleted = charRepo.deleteRelation(req.params.relationId);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Relation not found' });
    return;
  }
  res.json({ success: true, data: null });
});

export default router;
