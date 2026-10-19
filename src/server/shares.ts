// Shared mix pages: stored in Upstash under a long random id that can't be guessed, for 90 days.
// View-only: reading one never calls Claude or YouTube.

import { randomBytes } from "node:crypto";
import { getRoutine } from "@/data/routines";
import { sanitizeMix, type Mix } from "@/lib/mixTypes";
import { LIMITS } from "./config";
import { getKV } from "./kv";

export const SHARE_ID = /^[A-Za-z0-9_-]{22}$/;

export async function storeShare(mix: Mix): Promise<string> {
  const id = randomBytes(16).toString("base64url"); // 128 random bits → 22 characters
  const { shareId: _ignored, ...rest } = mix;
  await getKV().set(`share:${id}`, { ...rest, createdAt: new Date().toISOString() }, LIMITS.shareDays * 86400);
  return id;
}

/** The stored mix, or null if the id is mistyped, unknown or expired (E16). */
export async function readShare(id: string): Promise<Mix | null> {
  if (!SHARE_ID.test(id)) return null;
  const raw = await getKV().get<unknown>(`share:${id}`).catch(() => null);
  const mix = sanitizeMix(raw);
  return mix && getRoutine(mix.routineId) ? { ...mix, shareId: id } : null;
}
