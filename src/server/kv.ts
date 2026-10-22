// Shared storage: counters, the track cache and shared mixes. Upstash Redis in the live app; an
// in-memory stand-in for automated tests, and on a Mac without the Upstash settings.

import { Redis } from "@upstash/redis";
import { config } from "./config";

export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, seconds?: number): Promise<void>;
  /** Adds 1 and returns the new count. A new counter expires after `seconds`. */
  incr(key: string, seconds: number): Promise<number>;
  /** Adds n to a counter and returns the new total. It never expires (running totals) unless `seconds` is given for a new one. */
  incrBy(key: string, n: number, seconds?: number): Promise<number>;
  del(key: string): Promise<void>;
  /** Several values at once (missing ones are null), in the same order. */
  getMany<T>(keys: string[]): Promise<(T | null)[]>;
}

class UpstashKV implements KV {
  constructor(private redis: Redis) {}
  async get<T>(key: string) {
    return (await this.redis.get<T>(key)) ?? null;
  }
  async set(key: string, value: unknown, seconds?: number) {
    if (seconds) await this.redis.set(key, value, { ex: seconds });
    else await this.redis.set(key, value);
  }
  async incr(key: string, seconds: number) {
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, seconds);
    return n;
  }
  async incrBy(key: string, n: number, seconds?: number) {
    const total = await this.redis.incrby(key, n);
    if (seconds && total === n) await this.redis.expire(key, seconds);
    return total;
  }
  async del(key: string) {
    await this.redis.del(key);
  }
  async getMany<T>(keys: string[]) {
    if (!keys.length) return [];
    return ((await this.redis.mget<(T | null)[]>(...keys)) ?? []).map((v) => v ?? null);
  }
}

export class MemoryKV implements KV {
  private data = new Map<string, { value: unknown; until?: number }>();
  private live(key: string) {
    const e = this.data.get(key);
    if (e?.until && e.until < Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }
  async get<T>(key: string) {
    const e = this.live(key);
    return e ? (structuredClone(e.value) as T) : null;
  }
  async set(key: string, value: unknown, seconds?: number) {
    this.data.set(key, { value: structuredClone(value), until: seconds ? Date.now() + seconds * 1000 : undefined });
  }
  async incr(key: string, seconds: number) {
    const e = this.live(key);
    const n = ((e?.value as number) ?? 0) + 1;
    this.data.set(key, { value: n, until: e?.until ?? Date.now() + seconds * 1000 });
    return n;
  }
  async incrBy(key: string, n: number, seconds?: number) {
    const e = this.live(key);
    const total = ((e?.value as number) ?? 0) + n;
    this.data.set(key, { value: total, until: e?.until ?? (seconds ? Date.now() + seconds * 1000 : undefined) });
    return total;
  }
  async del(key: string) {
    this.data.delete(key);
  }
  async getMany<T>(keys: string[]) {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }
  clear() {
    this.data.clear();
  }
  /** Tests only: everything stored, to check nothing personal is. */
  dump(): Record<string, unknown> {
    return Object.fromEntries([...this.data].map(([k, e]) => [k, e.value]));
  }
}

// One store for the whole server process (pages and API routes are bundled separately, so a plain
// module variable would give each its own in-memory copy).
const holder = globalThis as unknown as { __trailmixKV?: KV };

export function getKV(): KV {
  if (holder.__trailmixKV) return holder.__trailmixKV;
  // Vercel's Upstash integration may name the settings either way.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  holder.__trailmixKV = !config.fakeServices() && url && token ? new UpstashKV(new Redis({ url, token })) : new MemoryKV();
  return holder.__trailmixKV;
}

/** Tests only: start from empty. */
export function resetMemoryKV() {
  const k = getKV();
  if (k instanceof MemoryKV) k.clear();
}
