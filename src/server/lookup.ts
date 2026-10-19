// Track lookup: cache → iTunes (is it real? how long?) → Odesli (links for every app) → YouTube
// search only as a capped fallback (E2). Results are cached in Upstash for everyone.

import { trackKey } from "@/lib/mixTypes";
import { config } from "./config";
import { fakeItunes, fakeOdesli, fakeYouTube } from "./fakes";
import { getKV } from "./kv";
import { youtubeSearchAllowed } from "./limits";

export type TrackInfo = {
  title: string;
  artist: string;
  appleUrl: string;
  durationMs: number;
  spotifyUrl?: string;
  youtubeMusicUrl?: string;
  youtubeUrl?: string;
  youtubeId?: string;
  /** Odesli (and the YouTube fallback, if needed) have been tried. */
  linksDone?: boolean;
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
    // Unknown tracks are remembered for a day only, in case iTunes adds them.
    await getKV().set(cacheKey(key), value, "missing" in value ? 86400 : CACHE_DAYS * 86400);
  } catch {
    // the cache is a speed-up, never required
  }
}

// ---------- iTunes ----------

/** Lower case, accents and punctuation gone, "feat." parts and bracketed versions dropped. */
export function simplify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    // one bracketed note at a time: "(feat. X)", "[2019 Remaster]", "(Radio Edit)"…
    .replace(/\s*[([][^)\]]*\b(feat|ft|with|remaster(ed)?|version|edit|mix|live|radio)\b[^)\]]*[)\]]/g, "")
    .replace(/\s+(feat\.?|ft\.?|featuring)\s.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type ItunesResult = { trackName?: string; artistName?: string; trackViewUrl?: string; trackTimeMillis?: number; kind?: string };

/** Album-length jams (15-minute "Chameleon") would swallow a workout; a shorter version usually exists. */
export const MAX_TRACK_MS = 9 * 60_000;

export function bestItunesMatch(results: ItunesResult[], title: string, artist: string): ItunesResult | undefined {
  const t = simplify(title);
  const a = simplify(artist);
  const ok = results.filter((r) => r.kind === "song" && r.trackViewUrl && r.trackTimeMillis && r.trackTimeMillis <= MAX_TRACK_MS);
  const titleOk = (r: ItunesResult) => {
    const rt = simplify(r.trackName ?? "");
    return rt === t || rt.startsWith(`${t} `) || t.startsWith(`${rt} `);
  };
  const artistOk = (r: ItunesResult) => {
    const ra = simplify(r.artistName ?? "");
    return ra.includes(a) || a.includes(ra);
  };
  return ok.find((r) => titleOk(r) && artistOk(r));
}

/** iTunes links are album pages; the `i` part says which song to play. Everything else is tracking. */
export function appleSongUrl(trackViewUrl: string): string {
  const u = new URL(trackViewUrl);
  const song = u.searchParams.get("i");
  return `${u.origin}${u.pathname}${song ? `?i=${encodeURIComponent(song)}` : ""}`;
}

/** "unavailable" means iTunes didn't answer properly (busy or down), which is not the same as "doesn't exist". */
async function itunesSearch(title: string, artist: string): Promise<{ appleUrl: string; durationMs: number } | null | "unavailable"> {
  if (config.fakeServices()) return fakeItunes(title, artist);
  // 25 results cost the same one request as 10, and more often include the original recording.
  const url = `https://itunes.apple.com/search?${new URLSearchParams({ term: `${artist} ${title}`, entity: "song", limit: "25", country: "GB" })}`;
  // iTunes allows about 20 searches a minute and answers 403 when it's had enough: wait and try again.
  for (const wait of [0, 1500, 3500]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
      if (res.status === 403 || res.status === 429 || res.status >= 500) continue;
      const data = (await res.json()) as { results?: ItunesResult[] };
      const m = bestItunesMatch(data.results ?? [], title, artist);
      return m ? { appleUrl: appleSongUrl(m.trackViewUrl!), durationMs: m.trackTimeMillis! } : null;
    } catch {
      // timed out or unreadable: try again
    }
  }
  return "unavailable";
}

/** Step 1–2: cache, then iTunes. Returns null when the track doesn't seem to exist (E1). */
export async function confirmTrack(title: string, artist: string): Promise<TrackInfo | null | "unavailable"> {
  const key = trackKey(title, artist);
  const cached = await readCache(key);
  if (cached) return "missing" in cached ? null : cached;
  const found = await itunesSearch(title, artist);
  if (found === "unavailable") return found;
  if (!found) {
    await writeCache(key, { missing: true });
    return null;
  }
  const info: TrackInfo = { title, artist, ...found };
  await writeCache(key, info);
  return info;
}

/** Runs lookups a few at a time, so iTunes isn't flooded. */
export async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

// ---------- Odesli and the YouTube fallback ----------

/** Odesli's free tier allows about 10 requests a minute, shared by everyone using Trailmix. */
const odesliPerMinute = () => (config.fakeServices() ? 1000 : config.odesliKey() ? 50 : 9);

async function odesliSlot(): Promise<boolean> {
  return (await getKV().incr(`odesli:${Math.floor(Date.now() / 60000)}`, 120)) <= odesliPerMinute();
}

type Links = Pick<TrackInfo, "spotifyUrl" | "youtubeMusicUrl" | "youtubeUrl" | "youtubeId">;

async function odesli(appleUrl: string): Promise<Links | null> {
  if (config.fakeServices()) return fakeOdesli(appleUrl);
  const params = new URLSearchParams({ url: appleUrl, userCountry: "GB" });
  const key = config.odesliKey();
  if (key) params.set("key", key);
  try {
    const res = await fetch(`https://api.song.link/v1-alpha.1/links?${params}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      linksByPlatform?: Record<string, { url?: string; entityUniqueId?: string }>;
    };
    const p = data.linksByPlatform ?? {};
    const yt = p.youtube ?? p.youtubeMusic;
    const youtubeId = yt?.entityUniqueId?.startsWith("YOUTUBE_VIDEO::") ? yt.entityUniqueId.split("::")[1] : undefined;
    return { spotifyUrl: p.spotify?.url, youtubeMusicUrl: p.youtubeMusic?.url, youtubeUrl: p.youtube?.url, youtubeId };
  } catch {
    return null;
  }
}

/** E2: one YouTube search (100 of the 10,000 daily units), Music category first. Capped per mix and per day. */
async function youtubeSearch(title: string, artist: string, mixId: string): Promise<string | null> {
  if (!(await youtubeSearchAllowed(mixId))) return null;
  if (config.fakeServices()) return fakeYouTube(title, artist);
  const key = config.youtubeKey();
  if (!key) return null;
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoCategoryId: "10",
    maxResults: "5",
    q: `${artist} ${title}`,
    key,
  });
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: { id?: { videoId?: string }; snippet?: { channelTitle?: string; title?: string } }[] };
    const items = data.items ?? [];
    const score = (i: (typeof items)[number]) =>
      (i.snippet?.channelTitle?.toLowerCase().endsWith(" - topic") ? 3 : 0) +
      (/official audio/i.test(i.snippet?.title ?? "") ? 2 : 0) +
      (/\blive\b/i.test(i.snippet?.title ?? "") ? -2 : 0);
    const best = [...items].sort((a, b) => score(b) - score(a))[0];
    return best?.id?.videoId ?? null;
  } catch {
    return null;
  }
}

export type LinkResult = { key: string; links: Links; done: boolean };

/**
 * Step 3–5 for one track: Odesli (paced to its free limit), then the YouTube fallback if Odesli has
 * no YouTube match or is down. `done: false` means "no Odesli slot yet, ask again shortly".
 */
export async function findLinks(t: { title: string; artist: string; appleUrl: string }, mixId: string): Promise<LinkResult> {
  const key = trackKey(t.title, t.artist);
  const cached = await readCache(key);
  if (cached && !("missing" in cached) && cached.linksDone) {
    const { spotifyUrl, youtubeMusicUrl, youtubeUrl, youtubeId } = cached;
    return { key, links: { spotifyUrl, youtubeMusicUrl, youtubeUrl, youtubeId }, done: true };
  }
  if (!(await odesliSlot())) return { key, links: {}, done: false };
  const links: Links = (await odesli(t.appleUrl)) ?? {};
  if (!links.youtubeId) {
    const id = await youtubeSearch(t.title, t.artist, mixId);
    if (id) {
      links.youtubeId = id;
      links.youtubeUrl = `https://www.youtube.com/watch?v=${id}`;
      links.youtubeMusicUrl = `https://music.youtube.com/watch?v=${id}`;
    }
  }
  if (cached && !("missing" in cached)) await writeCache(key, { ...cached, ...links, linksDone: true });
  return { key, links, done: true };
}
