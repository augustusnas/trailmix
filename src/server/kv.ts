// Shared storage: counters, the track cache and shared mixes. Upstash Redis in the live app; an
// in-memory stand-in for automated tests, and on a Mac without the Upstash settings.

import { Redis } from "@upstash/redis";
import { config } from "./config";

export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, seconds?: number): Promise<void>;
  /** Adds 1 and returns the new count. A new counter expires after `seconds`. */
  incr(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<void>;
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
  async del(key: string) {
    await this.redis.del(key);
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
  async del(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}

let kv: KV | null = null;

export function getKV(): KV {
  if (kv) return kv;
  // Vercel's Upstash integration may name the settings either way.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  kv = !config.fakeServices() && url && token ? new UpstashKV(new Redis({ url, token })) : new MemoryKV();
  return kv;
}

/** Tests only: start from empty. */
export function resetMemoryKV() {
  const k = getKV();
  if (k instanceof MemoryKV) k.clear();
}
