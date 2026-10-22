// Keep it → a real YouTube Music playlist (F13, F14, E5, E6, E8, N4, N14).
// The YouTube permission's tokens are sealed (server/session.ts) and kept only in Upstash, never in
// the cookie or the page (N7). Video ids are found once and cached for everyone, because a search
// costs 100 of the project's 10,000 daily units; adding a track costs 50 and a new playlist 50.

import { createHash, randomBytes } from "node:crypto";
import { getRoutine } from "@/data/routines";
import { energyLabel, genreLabel, playlistTitle } from "@/lib/format";
import type { Mix, MixTrack } from "@/lib/mixTypes";
import { config } from "./config";
import { FAKE_GUEST, refreshAccess, type GoogleTokens } from "./google";
import { getKV } from "./kv";
import { seal, unseal } from "./session";
import { count } from "./usage";

const API = "https://www.googleapis.com/youtube/v3";
const DAY = 86400;
/** Testing mode: Google's refresh tokens last 7 days, so the stored permission does too. */
const PERMISSION_DAYS = 7;
/** Found video ids are kept 60 days; "nothing found" only a day, in case YouTube gets it later. */
const VIDEO_DAYS = 60;
/** N4 asks for 15 seconds; past this the save stops and offers Retry for the rest (E6). */
const SAVE_BUDGET_MS = 20_000;

export const UNITS = { search: 100, insert: 50, playlist: 50 } as const;

/** YouTube's quota day starts at midnight Pacific time. */
export function quotaDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// ——— The permission ———

const permissionKey = (who: string) => `ytauth:${who}`;

export async function storePermission(who: string, tokens: GoogleTokens): Promise<void> {
  // A new consent without a refresh token (Google only sends one sometimes) keeps the old one.
  const old = tokens.refresh ? null : unseal<GoogleTokens>(await getKV().get<string>(permissionKey(who)));
  await getKV().set(permissionKey(who), seal({ ...tokens, refresh: tokens.refresh ?? old?.refresh }), PERMISSION_DAYS * DAY);
}

export const forgetPermission = (who: string) => getKV().del(permissionKey(who));

/**
 * An access token for saving. "permission": never given (or the YouTube box was unticked);
 * "expired": given, but Google won't renew it (Testing mode's 7 days ran out), so a quick sign-in.
 */
async function accessFor(who: string, email: string): Promise<string | "permission" | "expired"> {
  let t: GoogleTokens | null = null;
  try {
    t = unseal<GoogleTokens>(await getKV().get<string>(permissionKey(who)));
  } catch {
    t = null;
  }
  // Stand-in Google (automated tests): the usual test account has already said yes.
  if (!t && config.fakeServices() && email === FAKE_GUEST) return `fake-access-${email}`;
  if (!t?.youtube) return "permission";
  if (t.accessExp > Date.now() + 60_000) return t.access;
  const fresh = t.refresh ? await refreshAccess(t.refresh) : null;
  if (!fresh) {
    await forgetPermission(who);
    return "expired";
  }
  await storePermission(who, fresh);
  return fresh.access;
}

// ——— Talking to YouTube ———

type Call<T> = { ok: true; value: T } | { ok: false; quota: boolean; auth: boolean };

async function youtube<T>(access: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<Call<T>> {
  const res = await fetch(`${API}/${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${access}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { ok: false, quota: false, auth: false };
  const data = (await res.json().catch(() => null)) as { error?: { errors?: { reason?: string }[] } } | null;
  if (res.ok) return { ok: true, value: data as T };
  const reason = data?.error?.errors?.[0]?.reason ?? "";
  return { ok: false, quota: res.status === 403 && /quota|dailyLimit|rateLimit/i.test(reason), auth: res.status === 401 };
}

type SearchAnswer = { items?: { id?: { videoId?: string }; snippet?: { channelTitle?: string } }[] };

/** The best video for a track: the official audio from YouTube Music's "Artist - Topic" channel if there is one. */
const pickVideo = (a: SearchAnswer | undefined) => {
  const items = (a?.items ?? []).filter((i) => typeof i.id?.videoId === "string");
  return (items.find((i) => i.snippet?.channelTitle?.endsWith(" - Topic")) ?? items[0])?.id?.videoId ?? null;
};

/** The calls a save makes. Stand-ins for the automated tests: free and never touching a real account. */
type Service = {
  search(access: string, track: MixTrack): Promise<Call<string | null>>;
  createPlaylist(access: string, title: string, description: string): Promise<Call<string>>;
  insert(access: string, playlistId: string, videoId: string, position: number, index: number): Promise<Call<true>>;
};

const real: Service = {
  async search(access, t) {
    const q = new URLSearchParams({ part: "snippet", type: "video", maxResults: "3", videoCategoryId: "10", q: `${t.artist} ${t.title}` });
    const r = await youtube<SearchAnswer>(access, `search?${q}`);
    return r.ok ? { ok: true, value: pickVideo(r.value) } : r;
  },
  async createPlaylist(access, title, description) {
    const r = await youtube<{ id?: string }>(access, "playlists?part=snippet,status", {
      method: "POST",
      body: { snippet: { title, description }, status: { privacyStatus: "unlisted" } },
    });
    if (!r.ok) return r;
    return r.value.id ? { ok: true, value: r.value.id } : { ok: false, quota: false, auth: false };
  },
  async insert(access, playlistId, videoId, position) {
    const r = await youtube<unknown>(access, "playlistItems?part=snippet", {
      method: "POST",
      body: { snippet: { playlistId, position, resourceId: { kind: "youtube#video", videoId } } },
    });
    return r.ok ? { ok: true, value: true } : r;
  },
};

/** Stand-in YouTube. With the E6 test switch, every fourth track fails to go in the first time. */
function fakeService(forced: string | null, retry: boolean): Service {
  const id = (s: string) => createHash("sha256").update(s).digest("base64url").slice(0, 11);
  return {
    async search(_a, t) {
      return { ok: true, value: /Imaginary/.test(t.title) ? null : id(t.key) };
    },
    async createPlaylist() {
      return { ok: true, value: `PLfake${randomBytes(8).toString("hex")}` };
    },
    async insert(_a, _p, _v, _pos, index) {
      return forced === "e6" && !retry && index % 4 === 3 ? { ok: false, quota: false, auth: false } : { ok: true, value: true };
    },
  };
}

// ——— Units and the search cap (E5, N14) ———

const unitsKey = () => `yt:units:${quotaDay()}`;
const searchesKey = () => `yt:searches:${quotaDay()}`;
const spend = async (units: number) => {
  await count("youtubeUnits", units); // the stats page's daily total
  return getKV().incrBy(unitsKey(), units, 2 * DAY);
};

/** YouTube said the quota is gone: block saves until its day ends. */
const markExhausted = () => getKV().set(unitsKey(), config.youtubeDailyUnits(), 2 * DAY);

/** Is there room today for a save needing this many searches and these units? */
async function roomFor(searches: number, units: number): Promise<boolean> {
  const [usedUnits, usedSearches] = await Promise.all([getKV().get<number>(unitsKey()), getKV().get<number>(searchesKey())]);
  if ((usedSearches ?? 0) + searches > config.youtubeSearchCap()) return false;
  return (usedUnits ?? 0) + units <= config.youtubeDailyUnits();
}

// ——— Video ids, cached for everyone ———

type CachedVideo = { id: string | null };
const videoKey = (t: MixTrack) => `ytvid:${t.key}`;

async function cachedVideo(t: MixTrack): Promise<string | null | undefined> {
  const c = await getKV().get<CachedVideo>(videoKey(t)).catch(() => null);
  return c ? c.id : undefined;
}

// ——— Saving ———

/** What's in a playlist Trailmix made: the video for each track of the mix, null where it isn't in yet (E6). */
type PlaylistRecord = { mixId: string; items: (string | null)[] };
const playlistKey = (who: string, id: string) => `ytlist:${who}:${id}`;

export function playlistDescription(mix: Mix): string {
  const routine = getRoutine(mix.routineId)?.name ?? "Workout";
  const genres = mix.genres.map(genreLabel).join(", ");
  return `${routine} · ${energyLabel(mix.energy)} · ${mix.length} min${genres ? ` · ${genres}` : ""}\nMade with Trailmix`;
}

/** The title the phone shows (its own date), if it's one this mix could have; otherwise today's in the UK. */
export function checkedTitle(mix: Mix, title: unknown, now = Date.now()): string {
  const allowed = [-1, 0, 1].map((d) => playlistTitle(mix, new Date(now + d * DAY * 1000)));
  if (typeof title === "string" && allowed.includes(title)) return title;
  const uk = new Date(new Date(now).toLocaleString("en-US", { timeZone: "Europe/London" }));
  return playlistTitle(mix, uk);
}

export type SaveResult =
  | { ok: true; playlistId: string; saved: number; total: number; missing: number[] }
  | { ok: false; reason: "permission" | "expired" | "quota" | "failed" };

/**
 * Saves the mix as a new unlisted playlist (F13, F14), tracks in mix order. With `retryOf`, adds
 * only the tracks a partial save missed (E6), each in its place.
 */
export async function savePlaylist(opts: {
  who: string;
  email: string;
  mix: Mix;
  title: string;
  retryOf?: string;
  forced: string | null;
}): Promise<SaveResult> {
  const { who, mix, forced } = opts;
  const started = Date.now();
  if (forced === "e5") return { ok: false, reason: "quota" };
  const access = await accessFor(who, opts.email);
  if (access === "permission" || access === "expired") return { ok: false, reason: access };
  const svc = config.fakeServices() ? fakeService(forced, !!opts.retryOf) : real;

  let record: PlaylistRecord | null = null;
  if (opts.retryOf) {
    record = await getKV().get<PlaylistRecord>(playlistKey(who, opts.retryOf));
    if (!record || record.mixId !== mix.id || record.items.length !== mix.tracks.length) return { ok: false, reason: "failed" };
  }
  const todo = mix.tracks.map((_, i) => i).filter((i) => !record?.items[i]);

  // Video ids: the shared cache first, then YouTube's search (Music category) for the rest.
  // A Retry looks again for tracks YouTube had nothing for the first time.
  const known = await Promise.all(todo.map((i) => cachedVideo(mix.tracks[i])));
  const ids = new Map(todo.map((i, k) => [i, known[k] ?? null]));
  const toSearch = todo.filter((_, k) => known[k] === undefined || (record && known[k] === null));
  const units = UNITS.search * toSearch.length + UNITS.insert * todo.length + (record ? 0 : UNITS.playlist);
  if (!(await roomFor(toSearch.length, units))) return { ok: false, reason: "quota" };

  let used = 0;
  let quotaHit = false;
  if (toSearch.length) await getKV().incrBy(searchesKey(), toSearch.length, 2 * DAY);
  for (let at = 0; at < toSearch.length; at += 4) {
    await Promise.all(
      toSearch.slice(at, at + 4).map(async (i) => {
        const r = await svc.search(access, mix.tracks[i]);
        used += UNITS.search;
        if (!r.ok) {
          quotaHit ||= r.quota;
          return;
        }
        ids.set(i, r.value);
        await getKV().set(videoKey(mix.tracks[i]), { id: r.value } satisfies CachedVideo, (r.value ? VIDEO_DAYS : 1) * DAY);
      }),
    );
    if (quotaHit) break;
  }

  let playlistId = opts.retryOf;
  if (!playlistId && !quotaHit) {
    const r = await svc.createPlaylist(access, opts.title, playlistDescription(mix));
    used += UNITS.playlist;
    if (r.ok) playlistId = r.value;
    else quotaHit = r.quota;
  }
  if (!playlistId) {
    await spend(used);
    if (quotaHit) await markExhausted();
    log(mix, { used, searched: toSearch.length, looked: todo.length, saved: 0, total: mix.tracks.length, ms: Date.now() - started, retry: !!opts.retryOf, error: quotaHit ? "quota" : "playlist" });
    return { ok: false, reason: quotaHit ? "quota" : "failed" };
  }

  // In mix order, one at a time (adding several at once can lose the order).
  const items = record?.items.slice() ?? mix.tracks.map(() => null as string | null);
  for (const i of todo) {
    const videoId = ids.get(i);
    if (!videoId || quotaHit || Date.now() - started > SAVE_BUDGET_MS) continue;
    const position = items.slice(0, i).filter(Boolean).length;
    const r = await svc.insert(access, playlistId, videoId, position, i);
    used += UNITS.insert;
    if (r.ok) items[i] = videoId;
    else quotaHit = r.quota;
  }
  await getKV().set(playlistKey(who, playlistId), { mixId: mix.id, items } satisfies PlaylistRecord, PERMISSION_DAYS * DAY);
  await spend(used);
  if (quotaHit) await markExhausted();

  const missing = items.flatMap((v, i) => (v ? [] : [i]));
  const saved = items.length - missing.length;
  log(mix, { used, searched: toSearch.length, looked: todo.length, saved, total: items.length, ms: Date.now() - started, retry: !!opts.retryOf });
  return { ok: true, playlistId, saved, total: items.length, missing };
}

/** N14: units each save used, in the Vercel logs. No names or emails. */
function log(mix: Mix, d: { used: number; searched: number; looked: number; saved: number; total: number; ms: number; retry: boolean; error?: string }) {
  console.log(
    JSON.stringify({
      event: "youtube-save",
      mix: mix.id,
      retry: d.retry,
      tracks: d.total,
      saved: d.saved,
      searches: d.searched,
      cachedIds: d.looked - d.searched,
      units: d.used,
      ms: d.ms,
      ...(d.error ? { error: d.error } : {}),
    }),
  );
}
