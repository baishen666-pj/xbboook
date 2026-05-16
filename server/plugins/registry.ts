import { createRegistry, registerPlugin, executeHooks, createRegistry as createRegistryFn } from './types.js';
import type { PluginRegistry, PluginManifest, PluginSkill, HookName } from './types.js';

const globalRegistry = createRegistry();

export { globalRegistry as registry };

export function getPluginSkills(): PluginSkill[] {
  return Array.from(globalRegistry.skills.values());
}

export function getPluginSkill(id: string): PluginSkill | undefined {
  return globalRegistry.skills.get(id);
}

export async function runHook(hookName: HookName, context: Record<string, unknown>): Promise<void> {
  await executeHooks(globalRegistry, hookName, context);
}

export function listPlugins(): Array<{ id: string; name: string; version: string; description: string }> {
  return Array.from(globalRegistry.plugins.values()).map((p) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    description: p.description,
  }));
}

export function loadPlugin(manifest: PluginManifest): void {
  registerPlugin(globalRegistry, manifest);
  if (manifest.setup) {
    manifest.setup();
  }
}

export async function loadPluginsFromDirectory(dir: string): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));

  for (const file of files) {
    try {
      const module = await import(path.resolve(dir, file));
      const manifest: PluginManifest = module.default || module.plugin;
      if (manifest?.id && manifest?.name) {
        loadPlugin(manifest);
      }
    } catch (err) {
      console.error(`[Plugins] Failed to load ${file}:`, err instanceof Error ? err.message : err);
    }
  }
}
