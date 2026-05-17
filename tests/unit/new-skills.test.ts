import { describe, it, expect } from 'vitest';
import { getSkill, listSkills } from '../../server/ai/writingSkills.js';
import { buildUserPrompt } from '../../server/ai/promptBuilder.js';

describe('Phase 47-53 new skills', () => {
  const newSkillIds = [
    'expand', 'compress', 'check-repetition', 'check-dialogue-style',
    'name-generator', 'place-generator', 'plot-card', 'inspiration-collision',
    'reader-simulate',
  ];

  it('should have all new skills registered', () => {
    const skills = listSkills();
    const ids = skills.map(s => s.id);

    for (const id of newSkillIds) {
      expect(ids).toContain(id);
    }
  });

  it('should get each new skill by id', () => {
    for (const id of newSkillIds) {
      const skill = getSkill(id);
      expect(skill).toBeDefined();
      expect(skill!.id).toBe(id);
      expect(skill!.systemPrompt.length).toBeGreaterThan(50);
    }
  });

  it('expand should require selection', () => {
    expect(getSkill('expand')!.needsSelection).toBe(true);
  });

  it('compress should require selection', () => {
    expect(getSkill('compress')!.needsSelection).toBe(true);
  });

  it('name-generator should not require selection', () => {
    expect(getSkill('name-generator')!.needsSelection).toBe(false);
  });

  it('reader-simulate should not require selection', () => {
    expect(getSkill('reader-simulate')!.needsSelection).toBe(false);
  });

  it('should build user prompts for new skills', () => {
    const prompt = buildUserPrompt('expand', { selectedText: 'Hello world' });
    expect(prompt).toContain('Hello world');

    const prompt2 = buildUserPrompt('compress', { selectedText: 'Long text here' });
    expect(prompt2).toContain('Long text here');

    const prompt3 = buildUserPrompt('check-repetition', { selectedText: 'Some text' });
    expect(prompt3).toContain('Some text');

    const prompt4 = buildUserPrompt('name-generator', { question: '仙侠风格' });
    expect(prompt4).toContain('仙侠风格');

    const prompt5 = buildUserPrompt('reader-simulate', { question: '从爽文视角评价' });
    expect(prompt5).toContain('爽文视角');
  });

  it('total skill count should be 63', () => {
    const skills = listSkills();
    expect(skills.length).toBe(63);
  });
});
