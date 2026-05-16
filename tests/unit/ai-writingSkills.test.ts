import { describe, it, expect } from 'vitest';
import { getSkill, listSkills, WRITING_SKILLS } from '../../server/ai/writingSkills.js';

describe('writingSkills', () => {
  describe('getSkill', () => {
    it('returns skill by id', () => {
      const skill = getSkill('continue');
      expect(skill).toBeDefined();
      expect(skill!.id).toBe('continue');
      expect(skill!.name).toBe('续写');
    });

    it('returns undefined for unknown skill', () => {
      expect(getSkill('nonexistent')).toBeUndefined();
    });

    it('all skills have required fields', () => {
      for (const id of Object.keys(WRITING_SKILLS)) {
        const skill = WRITING_SKILLS[id];
        expect(skill.id).toBe(id);
        expect(skill.name).toBeTruthy();
        expect(skill.systemPrompt).toBeTruthy();
        expect(typeof skill.needsSelection).toBe('boolean');
        expect(skill.temperature).toBeGreaterThan(0);
        expect(skill.temperature).toBeLessThanOrEqual(2);
        expect(skill.maxTokens).toBeGreaterThan(0);
      }
    });
  });

  describe('listSkills', () => {
    it('returns all skills', () => {
      const skills = listSkills();
      expect(skills.length).toBeGreaterThanOrEqual(9);
      const ids = skills.map((s: { id: string }) => s.id);
      expect(ids).toContain('plot-planning');
      expect(ids).toContain('chapter-summary');
      expect(ids).toContain('writing-advice');
      expect(ids).toContain('character-design');
    });

    it('includes expected skill ids', () => {
      const skills = listSkills();
      const ids = skills.map((s) => s.id);
      expect(ids).toContain('continue');
      expect(ids).toContain('rewrite');
      expect(ids).toContain('polish');
      expect(ids).toContain('deai');
    });
  });

  describe('selection-requiring skills', () => {
    it('marks rewrite, polish, style, deai as needing selection', () => {
      expect(getSkill('rewrite')!.needsSelection).toBe(true);
      expect(getSkill('polish')!.needsSelection).toBe(true);
      expect(getSkill('style')!.needsSelection).toBe(true);
      expect(getSkill('deai')!.needsSelection).toBe(true);
    });

    it('marks continue, dialogue, consistency, inspiration, qa as not needing selection', () => {
      expect(getSkill('continue')!.needsSelection).toBe(false);
      expect(getSkill('dialogue')!.needsSelection).toBe(false);
      expect(getSkill('consistency')!.needsSelection).toBe(false);
      expect(getSkill('inspiration')!.needsSelection).toBe(false);
      expect(getSkill('qa')!.needsSelection).toBe(false);
    });
  });
});
