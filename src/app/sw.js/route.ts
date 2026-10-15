// The offline helper (service worker), served at /sw.js.
// It keeps copies of the app shell so Home and Library open fast, even with no connection.
// A new deploy changes VERSION, which makes phones fetch fresh copies.

export const dynamic = "force-static";

const VERSION = process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`;

// Pages kept for offline use. They open instantly from the copy and refresh in the background.
const SHELL_PAGES = ["/home", "/library", "/"];
const SHELL_FILES = ["/manifest.webmanifest", "/icons/icon-180.png", "/icons/icon-192.png"];

// Minimal service-worker types (the full "webworker" types clash with the page's DOM types).
type ExtendableEvent = Event & { waitUntil(p: Promise<unknown>): void };
type FetchEvent = ExtendableEvent & { request: Request; respondWith(r: Promise<Response> | Response): void };
type WorkerScope = {
  addEventListener(type: "install" | "activate", fn: (e: ExtendableEvent) => void): void;
  addEventListener(type: "fetch", fn: (e: FetchEvent) => void): void;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  location: Location;
};

function worker(version: string, pages: string[], files: string[]) {
  const CACHE = `trailmix-${version}`;
  const sw = self as unknown as WorkerScope;

  async function precache() {
    const cache = await caches.open(CACHE);
    const assets = new Set<string>(files);
    for (const page of pages) {
      const res = await fetch(page, { cache: "reload" });
      if (!res.ok) continue;
      const html = await res.clone().text();
      // Also keep every script, style and font the page needs.
      for (const m of html.matchAll(/["'(](\/_next\/static\/[^"')\s]+)/g)) assets.add(m[1]);
      await cache.put(page, res);
    }
    await Promise.all([...assets].map((a) => cache.add(a).catch(() => undefined)));
  }

  sw.addEventListener("install", (event) => {
    event.waitUntil(precache().then(() => sw.skipWaiting()));
  });

  sw.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith("trailmix-") && k !== CACHE).map((k) => caches.delete(k))))
        .then(() => sw.clients.claim()),
    );
  });

  async function cacheFirst(request: Request) {
    const hit = await caches.match(request);
    if (hit) return hit;
    const res = await fetch(request);
    if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
    return res;
  }

  async function staleWhileRevalidate(event: FetchEvent, key: string) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(key);
    const update = fetch(event.request)
      .then((res) => {
        if (res.ok && !res.redirected) cache.put(key, res.clone());
        return res;
      })
      .catch(() => undefined);
    if (hit) {
      event.waitUntil(update);
      return hit;
    }
    return (await update) ?? offlinePage();
  }

  function offlinePage() {
    return new Response(
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
        '<title>Offline · Trailmix</title><body style="margin:0;min-height:100dvh;display:grid;place-items:center;' +
        'background:#16130F;color:#EADFC8;font:600 17px/1.4 system-ui;padding:24px;text-align:center">' +
        '<p>You’re offline. Home and Library still work: <a href="/home" style="color:#C8E03A">open Home</a>.</p>',
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  sw.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== sw.location.origin) return;

    if (url.pathname.startsWith("/_next/static/") || files.includes(url.pathname) || url.pathname.startsWith("/icons/")) {
      event.respondWith(cacheFirst(request));
      return;
    }

    if (request.mode === "navigate") {
      if (pages.includes(url.pathname)) {
        event.respondWith(staleWhileRevalidate(event, url.pathname));
      } else {
        event.respondWith(fetch(request).catch(async () => (await caches.match(request)) ?? offlinePage()));
      }
    }
  });
}

export function GET() {
  const body = `(${worker.toString()})(${JSON.stringify(VERSION)}, ${JSON.stringify(SHELL_PAGES)}, ${JSON.stringify(SHELL_FILES)});`;
  return new Response(body, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
