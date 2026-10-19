// Track lookup. Before a mix is shown: cache → Deezer (is it real? how long?). Fast, no key, and it
// allows 50 searches every 5 seconds, so a whole mix is checked at once.
// Afterwards, in the background: iTunes for each track's exact Apple Music link, paced to iTunes's
// limit of about 20 searches a minute. Spotify and YouTube Music links are searches for the song
// (built on the phone, see data/apps.ts). Results are cached in Upstash for everyone.

import { trackKey } from "@/lib/mixTypes";
import { config } from "./config";
import { fakeCatalogue, fakeItunes } from "./fakes";
import { getKV } from "./kv";

export type TrackInfo = {
  title: string;
  artist: string;
  durationMs: number;
  /** The exact Apple Music song, once iTunes has been asked. */
  appleUrl?: string;
  /** iTunes has been asked (whether or not it found the song). */
  appleDone?: boolean;
};

type Cached = TrackInfo | { missing: true };

const CACHE_DAYS = 30;
const cacheKey = (key: string) => `track:${key}`;

async function readCache(key: string): Promise<Cached | null> {
  try {
    return await getKV().get<Cached>(cacheKey(key));
  } catch {
    return null;
  }
}

async function writeCache(key: string, value: Cached) {
  try {
    // Unknown tracks are remembered for a day only, in case they're added.
    await getKV().set(cacheKey(key), value, "missing" in value ? 86400 : CACHE_DAYS * 86400);
  } catch {
    // the cache is a speed-up, never required
  }
}

// ---------- matching ----------

/** Lower case, accents and punctuation gone, "feat." parts and bracketed versions dropped. */
export function simplify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    // one bracketed note at a time: "(feat. X)", "[2019 Remaster]", "(Radio Edit)"…
    .replace(/\s*[([][^)\]]*\b(feat|ft|with|remaster(ed)?|version|edit|mix|live|radio)\b[^)\]]*[)\]]/g, "")
    .replace(/\s+(feat\.?|ft\.?|featuring)\s.*$/, "")
    .replace(/^the\s+/, "")
    .replace(/\b2pac\b/, "tupac") // Deezer's name for him
    .replace(/(\w)\.(?=\w)/g, "$1") // "Still D.R.E." is "Still DRE"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Album-length jams (15-minute "Chameleon") would swallow a workout; extended house and techno often run 9–10. */
export const MAX_TRACK_MS = 10 * 60_000;
/** Shorter than this is an intro, edit or snippet (a 54-second "Bitches Brew"), not the song. */
export const MIN_TRACK_MS = 90_000;

export type Candidate = { title: string; artist: string; durationMs: number; url?: string };

/** The first result that's the same song by the same artist (not a cover or karaoke), 1½ to 10 minutes long. */
export function bestMatch<C extends Candidate>(results: C[], title: string, artist: string): C | undefined {
  const t = simplify(title);
  const a = simplify(artist);
  const titleOk = (c: C) => {
    const ct = simplify(c.title);
    return ct === t || ct.startsWith(`${t} `) || t.startsWith(`${ct} `);
  };
  const artistOk = (c: C) => {
    const ca = simplify(c.artist);
    return ca.length > 0 && (ca.includes(a) || a.includes(ca));
  };
  return results.find((c) => c.durationMs >= MIN_TRACK_MS && c.durationMs <= MAX_TRACK_MS && titleOk(c) && artistOk(c));
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Deezer: does it exist, and how long is it ----------

type DeezerResult = { title?: string; title_short?: string; duration?: number; readable?: boolean; artist?: { name?: string } };

/** "unavailable" means Deezer didn't answer properly (busy or down), which is not the same as "doesn't exist". */
async function deezerSearch(title: string, artist: string, forced?: string | null, deadline = Infinity): Promise<{ durationMs: number } | null | "unavailable"> {
  if (forced === "e2") return "unavailable"; // test switch: the catalogue is down
  if (config.fakeServices()) return fakeCatalogue(title, artist);
  const url = `https://api.deezer.com/search?${new URLSearchParams({ q: `${artist} ${title}`, limit: "25" })}`;
  for (const wait of [0, 1000, 2500]) {
    // Never run past the request's time limit: a busy answer is better than no answer.
    const left = deadline - Date.now() - wait;
    if (left < 800) break;
    if (wait) await pause(wait);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(Math.min(5000, left)), cache: "no-store" });
      if (!res.ok) continue;
      // Deezer reports being busy inside a normal answer: { error: { code: 4, ... } }
      const data = (await res.json()) as { data?: DeezerResult[]; error?: unknown };
      if (data.error || !Array.isArray(data.data)) continue;
      const candidates = data.data
        .filter((r) => r.readable !== false)
        .map((r) => ({ title: r.title_short ?? r.title ?? "", artist: r.artist?.name ?? "", durationMs: (r.duration ?? 0) * 1000 }));
      const m = bestMatch(candidates, title, artist);
      return m ? { durationMs: m.durationMs } : null;
    } catch {
      // timed out or unreadable: try again
    }
  }
  return "unavailable";
}

/** Test switches "mostfail" and "short": two in three tracks "aren't in the catalogue" (the same ones every time). */
export const failsOnPurpose = (key: string) => [...key].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7) % 3 !== 0;

/** Before showing a mix: cache, then Deezer. Returns null when the track doesn't seem to exist (E1). */
export async function confirmTrack(title: string, artist: string, forced?: string | null, deadline?: number): Promise<TrackInfo | null | "unavailable"> {
  const key = trackKey(title, artist);
  if ((forced === "mostfail" || forced === "short") && failsOnPurpose(key)) return null;
  const cached = forced === "e2" ? null : await readCache(key);
  if (cached) return "missing" in cached ? null : cached;
  const found = await deezerSearch(title, artist, forced, deadline);
  if (found === "unavailable") return found;
  if (!found) {
    await writeCache(key, { missing: true });
    return null;
  }
  const info: TrackInfo = { title, artist, ...found };
  await writeCache(key, info);
  return info;
}

/** Runs lookups a few at a time. */
export async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

// ---------- iTunes: the exact Apple Music link, in the background ----------

/** iTunes allows about 20 searches a minute from one address; stay under it, shared by everyone. */
const itunesPerMinute = () => (config.fakeServices() ? 1000 : 15);

async function itunesSlot(): Promise<boolean> {
  return (await getKV().incr(`itunes:${Math.floor(Date.now() / 60000)}`, 120)) <= itunesPerMinute();
}

type ItunesResult = { trackName?: string; artistName?: string; trackViewUrl?: string; trackTimeMillis?: number; kind?: string };

/** iTunes links are album pages; the `i` part says which song to play. Everything else is tracking. */
export function appleSongUrl(trackViewUrl: string): string {
  const u = new URL(trackViewUrl);
  const song = u.searchParams.get("i");
  return `${u.origin}${u.pathname}${song ? `?i=${encodeURIComponent(song)}` : ""}`;
}

/** The song's Apple Music link, null if iTunes doesn't have it, "unavailable" if iTunes is busy. */
async function itunesSearch(title: string, artist: string): Promise<string | null | "unavailable"> {
  if (config.fakeServices()) return fakeItunes(title, artist);
  // 25 results cost the same one request as 10, and more often include the original recording.
  const url = `https://itunes.apple.com/search?${new URLSearchParams({ term: `${artist} ${title}`, entity: "song", limit: "25", country: "GB" })}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return "unavailable"; // 403 is iTunes saying "too many": ask again next minute
    const data = (await res.json()) as { results?: ItunesResult[] };
    const candidates = (data.results ?? [])
      .filter((r) => r.kind === "song" && r.trackViewUrl)
      .map((r) => ({ title: r.trackName ?? "", artist: r.artistName ?? "", durationMs: r.trackTimeMillis ?? 0, url: r.trackViewUrl! }));
    const m = bestMatch(candidates, title, artist);
    return m ? appleSongUrl(m.url) : null;
  } catch {
    return "unavailable";
  }
}

export type AppleLink = { key: string; appleUrl?: string; done: boolean };

/**
 * One track's Apple Music link. `done: false` means "iTunes is busy, ask again shortly".
 * When iTunes doesn't have the song, it's done without a link and opens an Apple Music search instead.
 */
export async function findAppleLink(t: { title: string; artist: string }): Promise<AppleLink> {
  const key = trackKey(t.title, t.artist);
  const cached = await readCache(key);
  if (cached && !("missing" in cached) && cached.appleDone) return { key, appleUrl: cached.appleUrl, done: true };
  if (!(await itunesSlot())) return { key, done: false };
  const found = await itunesSearch(t.title, t.artist);
  if (found === "unavailable") return { key, done: false };
  const appleUrl = found ?? undefined;
  if (cached && !("missing" in cached)) await writeCache(key, { ...cached, appleUrl, appleDone: true });
  return { key, appleUrl, done: true };
}
