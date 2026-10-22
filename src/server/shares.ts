// Shared mix pages: stored in Upstash under a long random id that can't be guessed, for 90 days.
// View-only: reading one never calls Claude or YouTube.

import { randomBytes } from "node:crypto";
import { getRoutine } from "@/data/routines";
import { sanitizeMix, type Mix } from "@/lib/mixTypes";
import { LIMITS } from "./config";
import { getKV } from "./kv";

export const SHARE_ID = /^[A-Za-z0-9_-]{22}$/;

/** Who shared it: their Google first name (shown as "Shared by …") and account fingerprint (never shown). */
export type Sharer = { who: string; firstName: string };

type Stored = Record<string, unknown> & { sharedBy?: string; owner?: string };

const key = (id: string) => `share:${id}`;

export async function storeShare(mix: Mix, by: Sharer): Promise<string> {
  const id = randomBytes(16).toString("base64url"); // 128 random bits → 22 characters
  const { shareId: _ignored, remixes: _phoneOnly, ...rest } = mix;
  const record: Stored = { ...rest, createdAt: new Date().toISOString(), sharedBy: by.firstName.slice(0, 40), owner: by.who };
  await getKV().set(key(id), record, LIMITS.shareDays * 86400);
  return id;
}

/**
 * Keep it in YouTube Music: the shared page now opens the real playlist too, including a link sent
 * before the mix was kept. Only the person who shared it can do this (links from before sign-in
 * have no owner; their ids can't be guessed, so whoever has one shared it).
 */
export async function attachPlaylist(id: string, playlistId: string, who: string): Promise<boolean> {
  if (!SHARE_ID.test(id)) return false;
  const raw = await getKV().get<Stored>(key(id)).catch(() => null);
  if (!raw || (raw.owner && raw.owner !== who)) return false;
  await getKV().set(key(id), { ...raw, playlistId }, LIMITS.shareDays * 86400);
  return true;
}

export type SharedMix = { mix: Mix; sharedBy?: string };

/** The stored mix and who shared it, or null if the id is mistyped, unknown or expired (E16). */
export async function readShare(id: string): Promise<SharedMix | null> {
  if (!SHARE_ID.test(id)) return null;
  const raw = await getKV().get<Stored>(key(id)).catch(() => null);
  const mix = sanitizeMix(raw);
  if (!mix || !getRoutine(mix.routineId)) return null;
  const sharedBy = typeof raw?.sharedBy === "string" && raw.sharedBy.trim() ? raw.sharedBy.trim() : undefined;
  return { mix: { ...mix, shareId: id }, sharedBy };
}
