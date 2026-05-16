interface CacheEntry {
  project: unknown;
  characters: unknown[];
  relations: unknown[];
  worldviews: unknown[];
  outlines: unknown[];
  foreshadowings: unknown[];
  arcs: unknown[];
  threads: unknown[];
  chapters: unknown[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export function getCachedContext(projectId: string): CacheEntry | null {
  const entry = cache.get(projectId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(projectId);
    return null;
  }
  return entry;
}

export function setCachedContext(projectId: string, entry: CacheEntry): void {
  cache.set(projectId, entry);
}

export function invalidateProject(projectId: string): void {
  cache.delete(projectId);
}
