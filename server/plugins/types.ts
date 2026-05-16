/**
 * Plugin system for extending xbboook functionality.
 *
 * Plugins can:
 * - Register custom AI skills
 * - Add editor toolbar actions
 * - Hook into chapter lifecycle events
 * - Provide custom export formats
 */

export interface PluginSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  needsSelection: boolean;
  temperature: number;
  maxTokens: number;
}

export interface PluginToolbarAction {
  id: string;
  label: string;
  icon: string;
  action: string;
}

export type HookName = 'chapter:create' | 'chapter:update' | 'chapter:delete' | 'project:create' | 'checkin:after' | 'export:before';

export interface PluginHook {
  name: HookName;
  handler: (context: Record<string, unknown>) => void | Promise<void>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  skills?: PluginSkill[];
  toolbarActions?: PluginToolbarAction[];
  hooks?: PluginHook[];
  setup?: () => void | Promise<void>;
}

export interface PluginRegistry {
  plugins: Map<string, PluginManifest>;
  skills: Map<string, PluginSkill>;
  hooks: Map<HookName, Array<(ctx: Record<string, unknown>) => void | Promise<void>>>;
}

export function createRegistry(): PluginRegistry {
  return {
    plugins: new Map(),
    skills: new Map(),
    hooks: new Map(),
  };
}

export function registerPlugin(registry: PluginRegistry, manifest: PluginManifest): void {
  if (registry.plugins.has(manifest.id)) {
    throw new Error(`Plugin "${manifest.id}" is already registered`);
  }

  registry.plugins.set(manifest.id, manifest);

  if (manifest.skills) {
    for (const skill of manifest.skills) {
      registry.skills.set(skill.id, skill);
    }
  }

  if (manifest.hooks) {
    for (const hook of manifest.hooks) {
      const existing = registry.hooks.get(hook.name) || [];
      existing.push(hook.handler);
      registry.hooks.set(hook.name, existing);
    }
  }
}

export async function executeHooks(
  registry: PluginRegistry,
  hookName: HookName,
  context: Record<string, unknown>,
): Promise<void> {
  const handlers = registry.hooks.get(hookName);
  if (!handlers) return;
  await Promise.all(handlers.map((h) => h(context)));
}
