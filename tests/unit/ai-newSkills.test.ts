import { describe, it, expect } from 'vitest';
import { getSkill, listSkills } from '../../server/ai/writingSkills.js';

describe('new writing skills (Phase 100-110)', () => {
  const newSkillIds = [
    'cover-prompt', 'title-optimize', 'synopsis-generate',
    'story-architecture', 'retention-predict',
    'character-profile', 'character-arc',
    'book-summary', 'coherence-engine',
  ];

  it('all new skills are registered', () => {
    for (const id of newSkillIds) {
      const skill = getSkill(id);
      expect(skill, `Skill "${id}" should exist`).toBeDefined();
      expect(skill!.id).toBe(id);
      expect(skill!.name).toBeTruthy();
      expect(skill!.systemPrompt).toBeTruthy();
      expect(skill!.icon).toBeTruthy();
      expect(skill!.temperature).toBeGreaterThan(0);
      expect(skill!.maxTokens).toBeGreaterThan(0);
    }
  });

  it('total skill count includes all new skills', () => {
    const skills = listSkills();
    // 54 original + 9 new = 63
    expect(skills.length).toBeGreaterThanOrEqual(63);
  });

  it('each new skill has a category', () => {
    for (const id of newSkillIds) {
      const skill = getSkill(id);
      expect(skill!.category).toBeTruthy();
    }
  });

  describe('cover-prompt', () => {
    it('has correct properties', () => {
      const skill = getSkill('cover-prompt')!;
      expect(skill.category).toBe('publishing');
      expect(skill.needsSelection).toBe(false);
    });
  });

  describe('title-optimize', () => {
    it('has correct properties', () => {
      const skill = getSkill('title-optimize')!;
      expect(skill.category).toBe('publishing');
      expect(skill.temperature).toBe(0.85);
    });
  });

  describe('story-architecture', () => {
    it('has correct properties', () => {
      const skill = getSkill('story-architecture')!;
      expect(skill.category).toBe('planning');
      expect(skill.temperature).toBe(0.5);
    });
  });

  describe('retention-predict', () => {
    it('has correct properties', () => {
      const skill = getSkill('retention-predict')!;
      expect(skill.category).toBe('analysis');
    });
  });

  describe('character-profile', () => {
    it('has correct properties', () => {
      const skill = getSkill('character-profile')!;
      expect(skill.category).toBe('character');
    });
  });

  describe('book-summary', () => {
    it('has correct properties', () => {
      const skill = getSkill('book-summary')!;
      expect(skill.category).toBe('analysis');
      expect(skill.maxTokens).toBe(5000);
    });
  });

  describe('coherence-engine', () => {
    it('has correct properties', () => {
      const skill = getSkill('coherence-engine')!;
      expect(skill.category).toBe('review');
      expect(skill.temperature).toBe(0.3);
    });
  });
});
