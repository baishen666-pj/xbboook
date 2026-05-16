import { Router } from 'express';
import { z } from 'zod';
import * as charRepo from '../db/repositories/characterRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const createCharacterSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  nickname: z.string().max(200).optional(),
  roleType: z.enum(['protagonist', 'antagonist', 'supporting', 'minor']).optional(),
  gender: z.string().max(50).optional(),
  age: z.string().max(50).optional(),
  appearance: z.string().max(5000).optional(),
  personality: z.string().max(5000).optional(),
  background: z.string().max(10000).optional(),
  abilities: z.string().max(5000).optional(),
  notes: z.string().max(10000).optional(),
});

const updateCharacterSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nickname: z.string().max(200).optional(),
  role_type: z.enum(['protagonist', 'antagonist', 'supporting', 'minor']).optional(),
  gender: z.string().max(50).optional(),
  age: z.string().max(50).optional(),
  appearance: z.string().max(5000).optional(),
  personality: z.string().max(5000).optional(),
  background: z.string().max(10000).optional(),
  abilities: z.string().max(5000).optional(),
  notes: z.string().max(10000).optional(),
  sort_order: z.number().int().min(0).optional(),
});

const updateRelationSchema = z.object({
  relationType: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});

const createRelationSchema = z.object({
  characterAId: z.string().uuid(),
  characterBId: z.string().uuid(),
  relationType: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

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
    res.status(404).json({ success: false, error: '角色不存在' });
    return;
  }
  const relations = charRepo.findRelationsForCharacter(req.params.id);
  res.json({ success: true, data: { character, relations } });
});

// Create character
router.post('/', validate(createCharacterSchema), (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const character = charRepo.create({ projectId, ...req.body });
  res.status(201).json({ success: true, data: character });
});

// Update character
router.put('/:id', validate(updateCharacterSchema), (req, res) => {
  const character = charRepo.update(req.params.id as string, req.body);
  if (!character) {
    res.status(404).json({ success: false, error: '角色不存在' });
    return;
  }
  res.json({ success: true, data: character });
});

// Delete character
router.delete('/:id', (req, res) => {
  const deleted = charRepo.deleteById(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: '角色不存在' });
    return;
  }
  res.json({ success: true, data: null });
});

// Create relation
router.post('/relations', validate(createRelationSchema), (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const relation = charRepo.createRelation({ projectId, ...req.body });
  res.status(201).json({ success: true, data: relation });
});

// Update relation
router.put('/relations/:relationId', validate(updateRelationSchema), (req, res) => {
  const relation = charRepo.updateRelation(req.params.relationId, req.body);
  if (!relation) {
    res.status(404).json({ success: false, error: '关系不存在' });
    return;
  }
  res.json({ success: true, data: relation });
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
