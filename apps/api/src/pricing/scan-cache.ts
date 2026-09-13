import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

/** Public reference data only. Never persist user photographs or scan results. */
export class ScanCache {
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly memory = new Map<string, { expires: number; value: unknown }>();
  private readonly root: string;

  constructor(directory = '.cache/scanner') { this.root = resolve(directory); }

  async peek<T>(key: string): Promise<T | undefined> {
    const memory = this.memory.get(key);
    if (memory && memory.expires > Date.now()) return memory.value as T;
    try {
      const path = join(this.root, `${createHash('sha256').update(key).digest('hex')}.json`);
      const entry = JSON.parse(await readFile(path, 'utf8'));
      if (entry.expires > Date.now() && 'value' in entry) return entry.value as T;
    } catch { /* Cache is optional. */ }
    return undefined;
  }

  async get<T>(key: string, ttl: number, fetchValue: () => Promise<T>): Promise<T> {
    const cached = this.memory.get(key);
    if (cached && cached.expires > Date.now()) return cached.value as T;
    const pending = this.pending.get(key);
    if (pending) return pending as Promise<T>;
    const task = this.load(key, ttl, fetchValue);
    this.pending.set(key, task);
    try { return await task; } finally { this.pending.delete(key); }
  }

  private async load<T>(key: string, ttl: number, fetchValue: () => Promise<T>): Promise<T> {
    const path = join(this.root, `${createHash('sha256').update(key).digest('hex')}.json`);
    try {
      const entry = JSON.parse(await readFile(path, 'utf8'));
      if (typeof entry.expires === 'number' && entry.expires > Date.now() && 'value' in entry) {
        this.remember(key, entry);
        return entry.value as T;
      }
    } catch { /* Missing or corrupt cache: rebuild from the source. */ }
    const value = await fetchValue();
    const entry = { expires: Date.now() + ttl, value };
    this.remember(key, entry);
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await mkdir(this.root, { recursive: true });
      await writeFile(temporary, JSON.stringify(entry));
      await rename(temporary, path);
    } catch { /* A read-only cache must not break a scan. */ }
    finally { await rm(temporary, { force: true }).catch(() => undefined); }
    return value;
  }

  private remember(key: string, entry: { expires: number; value: unknown }) {
    if (this.memory.size >= 256) this.memory.delete(this.memory.keys().next().value!);
    this.memory.set(key, entry);
  }
}
