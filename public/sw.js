/*
 * Blueprint service worker: makes the app open with no connection.
 * Training data never goes through here (it lives in IndexedDB); this only
 * caches the app itself.
 *
 * - Build assets (/_next/static) are immutable: cache first.
 * - Pages and RSC payloads: network first, falling back to the cache, so a
 *   lifter who loses signal mid-session can still reload gym mode.
 * - API routes (the AI features) always go to the network.
 */

const CACHE = "blueprint-v1";
const SHELL = ["/train", "/train/session", "/train/summary", "/plan", "/plan/import", "/review", "/review/ask", "/review/data", "/settings"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // One page failing to cache shouldn't stop the others.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
    return response;
  } catch (error) {
    const hit = (await caches.match(request)) ?? (fallbackUrl && (await caches.match(fallbackUrl)));
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    // Unknown pages offline fall back to gym mode, the one place that must always work.
    event.respondWith(networkFirst(request, "/train/session"));
  } else {
    event.respondWith(networkFirst(request));
  }
});
