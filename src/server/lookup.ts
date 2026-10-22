// Track lookup. Before a mix is shown: cache → Deezer (is it real? how long?). Fast, no key, and it
// allows 50 searches every 5 seconds, so a whole mix is checked at once.
// Afterwards, in the background: iTunes for each track's exact Apple Music link, paced to iTunes's
// limit of about 20 searches a minute. Spotify and YouTube Music links are searches for the song
// (built on the phone, see data/apps.ts). Results are cached in Upstash for everyone.

import { trackKey } from "@/lib/mixTypes";
import { config } from "./config";
import { fakeItunes, fakeSearch } from "./fakes";
import type { GenreInfo } from "./genres";
import { getKV } from "./kv";

export type TrackInfo = {
  title: string;
  artist: string;
  durationMs: number;
  /** The exact Apple Music song, once iTunes has been asked. */
  appleUrl?: string;
  /** iTunes has been asked (whether or not it found the song). */
  appleDone?: boolean;
  /** Deezer's id for the track, for its tempo. */
  deezerId?: number;
  /** Tempo in beats a minute; 0 when Deezer hasn't measured it; undefined when not asked yet. */
  bpm?: number;
} & GenreInfo;

type Cached = TrackInfo | { missing: true; reason?: Rejection };

const CACHE_DAYS = 30;
/**
 * Raise this whenever the matching or the checks change, so answers saved by an older version (a
 * "not found" it would now accept, or a match it would now reject) are never reused; they expire
 * on their own (a day for "not found", 30 days otherwise).
 * 2: the genre check (Milestone 4). 3: Part A matching (apostrophes, DJ/MC, years, exact titles).
 */
export const MATCHING_VERSION = 3;
const cacheKey = (key: string) => `track${MATCHING_VERSION}:${key}`;

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
    .replace(/[\u0300-\u036f]/g, "")
    // one bracketed note at a time: "(feat. X)", "[2019 Remaster]", "(Radio Edit)"…
    .replace(/\s*[([][^)\]]*\b(feat|ft|with|remaster(ed)?|version|edit|mix|live|radio)\b[^)\]]*[)\]]/g, "")
    .replace(/\s+(feat\.?|ft\.?|featuring)\s.*$/, "")
    .replace(/^the\s+/, "")
    .replace(/\b2pac\b/, "tupac") // Deezer's name for him
    .replace(/(\w)\.(?=\w)/g, "$1") // "Still D.R.E." is "Still DRE"
    .replace(/['’`]/g, "") // "Man's Not Hot" is "Mans Not Hot"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Q2: the song itself, whatever the version. "Pow", "Pow! (Forward)", "Pow (Radio Edit)",
 * "Pow - Extended Mix" and "Pow 2011" are all one song.
 */
export function songKey(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*[([][^)\]]*[)\]]/g, " ") // every bracketed part
    .replace(/\s+-\s+.*$/, "") // "Song - Radio Edit"
    .replace(/\s+(feat\.?|ft\.?|featuring)\s.*$/, "")
    .replace(/(\w)\.(?=\w)/g, "$1")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(remix(ed)?|edit|version|radio|extended|original|mix|remaster(ed)?|vip|clean|explicit)\b/g, " ")
    .replace(/\s(19|20)\d\d\s*$/, "") // "Pow 2011" is "Pow"
    .replace(/^the\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Different names for the same artist (after tidying). */
const ALIASES: Record<string, string> = {
  "2pac": "tupac",
  "tupac shakur": "tupac",
  "wiz kid": "wizkid",
  "starboy wizkid": "wizkid",
  "puff daddy": "diddy",
  "sean combs": "diddy",
  "p diddy": "diddy",
  "snoop doggy dogg": "snoop dogg",
  "mos def": "yasiin bey",
  "kanye west": "ye",
  "maphorisa": "dj maphorisa",
};

/** One artist name, tidied: case, accents, dots, apostrophes, "$" (A$AP), a leading "The", "DJ" or "MC", then the alias list. */
export function artistName(s: string) {
  const n = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\$/g, "s")
    .replace(/[.'’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|dj|mc)\s+/, ""); // "DJ Zinc" is "Zinc", "MC Big Shaq" is "Big Shaq"
  return ALIASES[n] ?? n;
}

/** Every artist in a credit: "Chase & Status", "Sub Focus x Dimension", "Ghetts feat. Jaykae" → their names. */
export function artistNames(credit: string): string[] {
  const whole = artistName(credit.replace(/\s+(feat\.?|ft\.?|featuring)\s.*$/i, ""));
  const parts = credit
    .split(/\s*(?:,|&|\+|\/|\band\b|\bx\b|\bvs\.?|\bwith\b|\bfeat\.?|\bft\.?|\bfeaturing\b)\s*/i)
    .map(artistName)
    .filter(Boolean);
  return [...new Set([whole, ...parts])];
}

/**
 * Q1: the same artist. Whole credits match after tidying ("The Prodigy" / "Prodigy", "Bob Marley" /
 * "Bob Marley & The Wailers"), or one named artist is in both. A name inside another name isn't
 * enough ("Sting" isn't "Stingray", "Dave" isn't "Dave Matthews Band").
 */
export function sameArtist(claude: string, found: string) {
  const ours = artistNames(claude);
  const theirs = new Set(artistNames(found));
  return ours.some((n) => theirs.has(n));
}

/** Longest a track may be (Q4): longer versions would swallow a workout. */
export const MAX_TRACK_MS = 7 * 60_000;
/** Shorter than this is an intro, edit or snippet (a 54-second "Bitches Brew"), not the song. */
export const MIN_TRACK_MS = 90_000;

export type Candidate = { title: string; artist: string; durationMs: number; url?: string; fullTitle?: string };

/**
 * The same title, apart from brackets, " - Version" endings, feat. and version words. A longer title
 * that only starts the same way is a different track ("Kano" isn't "Kano Freestyle").
 */
const titleMatches = (found: string, wanted: string) => {
  if (simplify(found) === simplify(wanted)) return true;
  const k = songKey(wanted);
  return k.length > 0 && songKey(found) === k;
};
/** Remixes, live takes and the like, when the original is there too. */
const isVersion = (c: Candidate) => /\b(remix|live|version|vip|acoustic|instrumental|sped up|slowed|extended)\b/i.test(c.fullTitle ?? c.title);
const isEdit = (c: Candidate) => /\b(radio|single)\s+edit\b|\bedit\)/i.test(c.fullTitle ?? c.title);
/** Over this, a radio edit of the same recording is used instead, so the mix fits enough tracks (drum & bass originals often run 5–7 minutes). */
const EDIT_OVER_MS = 5 * 60_000;

/** Why a suggestion failed the catalogue check. */
export type Rejection = "notFound" | "wrongArtist" | "length";

/**
 * The same song by the same artist (not a cover or karaoke), 1½ to 7 minutes, preferring the original
 * recording over remixes. Otherwise why not: the title exists only by someone else (wrongArtist),
 * only in versions that are too short or too long (length), or not at all (notFound).
 */
export function matchResult<C extends Candidate>(results: C[], title: string, artist: string): C | Rejection {
  const sameSong = results.filter((c) => titleMatches(c.title, title));
  const byArtist = sameSong.filter((c) => c.artist.length > 0 && sameArtist(artist, c.artist));
  const timed = byArtist.filter((c) => c.durationMs >= MIN_TRACK_MS && c.durationMs <= MAX_TRACK_MS);
  if (timed.length) {
    const original = timed.find((c) => !isVersion(c) && !isEdit(c)) ?? timed.find((c) => !isVersion(c)) ?? timed[0];
    const edit = timed.find((c) => isEdit(c) && !isVersion(c) && c.durationMs <= EDIT_OVER_MS);
    return original.durationMs > EDIT_OVER_MS && edit ? edit : original;
  }
  if (byArtist.length) return "length";
  return sameSong.length ? "wrongArtist" : "notFound";
}

/** The matching result, or undefined (used for Apple Music links, where the reason doesn't matter). */
export function bestMatch<C extends Candidate>(results: C[], title: string, artist: string): C | undefined {
  const m = matchResult(results, title, artist);
  return typeof m === "string" ? undefined : m;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Deezer: does it exist, how long is it, which genre, how fast ----------

/** One Deezer request, retried when Deezer is busy. "unavailable": no proper answer in time. */
async function deezerGet<T>(path: string, deadline: number): Promise<T | "unavailable"> {
  for (const wait of [0, 1000, 2500]) {
    // Never run past the request's time limit: a busy answer is better than no answer.
    const left = deadline - Date.now() - wait;
    if (left < 800) break;
    if (wait) await pause(wait);
    try {
      const res = await fetch(`https://api.deezer.com/${path}`, { signal: AbortSignal.timeout(Math.min(5000, left)), cache: "no-store" });
      if (!res.ok) continue;
      // Deezer reports being busy inside a normal answer: { error: { code: 4, ... } }
      const data = (await res.json()) as T & { error?: unknown };
      if (data.error) continue;
      return data;
    } catch {
      // timed out or unreadable: try again
    }
  }
  return "unavailable";
}

type DeezerResult = {
  id?: number;
  title?: string;
  title_short?: string;
  duration?: number;
  readable?: boolean;
  artist?: { id?: number; name?: string };
  album?: { id?: number };
};

export type DeezerTrack = { id: number; title: string; artist: string; durationMs: number; artistId?: number; albumId?: number };

/** Deezer's search results for a suggestion, ready for matching. */
async function deezerSearch(title: string, artist: string, deadline: number): Promise<(Candidate & DeezerTrack)[] | "unavailable"> {
  const data = await deezerGet<{ data?: DeezerResult[] }>(`search?${new URLSearchParams({ q: `${artist} ${title}`, limit: "25" })}`, deadline);
  if (data === "unavailable" || !Array.isArray(data.data)) return "unavailable";
  return data.data
    .filter((r) => r.readable !== false && r.id)
    .map((r) => ({
      id: r.id!,
      title: r.title_short ?? r.title ?? "",
      fullTitle: r.title,
      artist: r.artist?.name ?? "",
      durationMs: (r.duration ?? 0) * 1000,
      artistId: r.artist?.id,
      albumId: r.album?.id,
    }));
}

/** An artist's catalogue on Deezer: how many albums in each genre, and each album's genre. Cached. */
type ArtistGenres = { counts: Record<string, number>; albums: Record<string, number> };

async function artistGenres(artistId: number, deadline: number): Promise<ArtistGenres | null> {
  const key = `dzartist:${artistId}`;
  const cached = await getKV().get<ArtistGenres>(key).catch(() => null);
  if (cached) return cached;
  const data = await deezerGet<{ data?: { id?: number; genre_id?: number }[] }>(`artist/${artistId}/albums?limit=100`, deadline);
  if (data === "unavailable") return null;
  const out: ArtistGenres = { counts: {}, albums: {} };
  for (const al of data.data ?? []) {
    if (!al.id || !al.genre_id || al.genre_id <= 0) continue;
    out.albums[al.id] = al.genre_id;
    out.counts[al.genre_id] = (out.counts[al.genre_id] ?? 0) + 1;
  }
  await getKV().set(key, out, CACHE_DAYS * 86400).catch(() => {});
  return out;
}

/** The track's tempo, 0 when Deezer hasn't measured it. */
async function deezerBpm(trackId: number, deadline: number): Promise<number | undefined> {
  const data = await deezerGet<{ bpm?: number }>(`track/${trackId}`, deadline);
  return data === "unavailable" ? undefined : (data.bpm ?? 0);
}

/** Test switches "mostfail" and "short": two in three tracks "aren't in the catalogue" (the same ones every time). */
export const failsOnPurpose = (key: string) => [...key].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7) % 3 !== 0;

export type Checked = TrackInfo | { rejected: Rejection } | "unavailable";

/**
 * Before showing a mix: cache, then Deezer (Q1, Q4). The track keeps Claude's title and takes
 * Deezer's artist credit, and carries what the genre and tempo checks need (Q3, Q5).
 * `tempo`: also find the tempo (for Driven and Feral).
 */
export async function confirmTrack(title: string, artist: string, forced?: string | null, deadline = Infinity, tempo = false): Promise<Checked> {
  const key = trackKey(title, artist);
  if (forced === "mostfail" && failsOnPurpose(key)) return { rejected: "notFound" };
  if (forced === "e2") return "unavailable"; // test switch: the catalogue is down
  let info = await readCache(key);
  if (info && "missing" in info) return { rejected: info.reason ?? "notFound" };
  if (!info) {
    const fake = config.fakeServices();
    const results: (Candidate & DeezerTrack & { albumGenre?: number; bpm?: number })[] | "unavailable" = fake
      ? fakeSearch(title)
      : await deezerSearch(title, artist, deadline);
    if (results === "unavailable") return results;
    const m = matchResult(results, title, artist);
    if (typeof m === "string") {
      await writeCache(key, { missing: true, reason: m });
      return { rejected: m };
    }
    if (fake) {
      info = { title, artist: m.artist, durationMs: m.durationMs, deezerId: m.id, albumGenre: m.albumGenre, bpm: m.bpm };
    } else {
      const genres = m.artistId ? await artistGenres(m.artistId, deadline) : null;
      info = {
        title,
        artist: m.artist,
        durationMs: m.durationMs,
        deezerId: m.id,
        albumGenre: m.albumId ? genres?.albums[m.albumId] : undefined,
        artistGenres: genres?.counts,
      };
    }
    // Without the artist's genres (Deezer busy), look again next time rather than caching a gap.
    if (fake || !m.artistId || info.artistGenres) await writeCache(key, info);
  }
  if (tempo && info.bpm === undefined && !config.fakeServices() && info.deezerId) {
    const bpm = await deezerBpm(info.deezerId, deadline);
    if (bpm !== undefined) {
      info = { ...info, bpm };
      await writeCache(key, info);
    }
  }
  // Apple links are looked up under the name shown in the mix (Deezer's artist credit).
  const shownKey = trackKey(info.title, info.artist);
  if (shownKey !== key && !(await readCache(shownKey))) await writeCache(shownKey, info);
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
