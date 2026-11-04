type Entry = { at: number; value: unknown };

type CacheGlobal = {
  buckets: Map<string, Map<string, Entry>>;
  inflight: Map<string, Promise<unknown>>;
};

function state(): CacheGlobal {
  const g = globalThis as unknown as { __oswalMemoryCache?: CacheGlobal };
  if (!g.__oswalMemoryCache) {
    g.__oswalMemoryCache = { buckets: new Map(), inflight: new Map() };
  }
  return g.__oswalMemoryCache;
}

function bucket(name: string) {
  const root = state();
  let map = root.buckets.get(name);
  if (!map) {
    map = new Map();
    root.buckets.set(name, map);
  }
  return map;
}

/** Process-wide cache. A database row would still cost a round trip on every read. */
export async function remember<T>(
  name: string,
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  options?: { refresh?: boolean; cache?: boolean },
): Promise<T> {
  const enabled = options?.cache ?? !process.env.VITEST;
  if (!enabled) return load();
  const map = bucket(name);
  const root = state();
  const flightKey = `${name}\n${key}`;
  if (!options?.refresh) {
    const hit = map.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
    const pending = root.inflight.get(flightKey);
    if (pending) return pending as Promise<T>;
  }
  const promise = load()
    .then((value) => {
      map.delete(key);
      map.set(key, { at: Date.now(), value });
      while (map.size > 80) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
      return value;
    })
    .finally(() => {
      if (root.inflight.get(flightKey) === promise) root.inflight.delete(flightKey);
    });
  root.inflight.set(flightKey, promise);
  return promise;
}

export function forget(name?: string) {
  const root = state();
  if (!name) {
    root.buckets.clear();
    root.inflight.clear();
    return;
  }
  root.buckets.delete(name);
  for (const key of root.inflight.keys()) {
    if (key.startsWith(`${name}\n`)) root.inflight.delete(key);
  }
}
