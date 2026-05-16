import { describe, it, expect, beforeEach } from 'vitest';
import { createRegistry, registerPlugin, executeHooks, type PluginManifest, type PluginRegistry } from '../../server/plugins/types.js';
import { getPluginSkill, getPluginSkills, listPlugins, loadPlugin, type globalRegistry } from '../../server/plugins/registry.js';

describe('Plugin Registry (types)', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('creates an empty registry', () => {
    expect(registry.plugins.size).toBe(0);
    expect(registry.skills.size).toBe(0);
    expect(registry.hooks.size).toBe(0);
  });

  it('registers a plugin with skills', () => {
    const manifest: PluginManifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'test',
      skills: [
        {
          id: 'custom-skill',
          name: 'Custom Skill',
          description: 'A custom skill',
          icon: '🔧',
          systemPrompt: 'You are a custom skill',
          needsSelection: false,
          temperature: 0.5,
          maxTokens: 1024,
        },
      ],
    };

    registerPlugin(registry, manifest);

    expect(registry.plugins.has('test-plugin')).toBe(true);
    expect(registry.skills.has('custom-skill')).toBe(true);
    expect(registry.skills.get('custom-skill')!.name).toBe('Custom Skill');
  });

  it('throws on duplicate plugin id', () => {
    const manifest: PluginManifest = {
      id: 'dup',
      name: 'Dup',
      version: '1.0.0',
      description: 'dup',
      author: 'test',
    };

    registerPlugin(registry, manifest);
    expect(() => registerPlugin(registry, manifest)).toThrow('already registered');
  });

  it('registers hooks and executes them', async () => {
    const calls: string[] = [];

    const manifest: PluginManifest = {
      id: 'hook-plugin',
      name: 'Hook Plugin',
      version: '1.0.0',
      description: 'hook test',
      author: 'test',
      hooks: [
        {
          name: 'chapter:create',
          handler: (ctx) => { calls.push(`create:${ctx.chapterId}`); },
        },
        {
          name: 'chapter:update',
          handler: (ctx) => { calls.push(`update:${ctx.chapterId}`); },
        },
      ],
    };

    registerPlugin(registry, manifest);

    await executeHooks(registry, 'chapter:create', { chapterId: 'ch-1' });
    expect(calls).toEqual(['create:ch-1']);

    await executeHooks(registry, 'chapter:update', { chapterId: 'ch-2' });
    expect(calls).toEqual(['create:ch-1', 'update:ch-2']);
  });

  it('does nothing for unregistered hooks', async () => {
    await expect(executeHooks(registry, 'project:create', {})).resolves.toBeUndefined();
  });

  it('registers plugin without skills or hooks', () => {
    const manifest: PluginManifest = {
      id: 'minimal',
      name: 'Minimal',
      version: '1.0.0',
      description: 'minimal plugin',
      author: 'test',
    };

    registerPlugin(registry, manifest);
    expect(registry.plugins.size).toBe(1);
    expect(registry.skills.size).toBe(0);
  });
});
