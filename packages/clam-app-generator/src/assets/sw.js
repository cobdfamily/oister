// COBD clam shell service worker — offline support.
//
// Precaches the same-origin app shell (the launcher page + its JSON)
// and runtime-caches everything else (the CLF CDN assets, visited
// pages) so the home screen and what you've opened work offline.
//
// Served from the app root, so its scope is "/". In a Capacitor
// WebView, service workers require app-bound domains (WKAppBoundDomains
// + limitsNavigationsToAppBoundDomains); on the open web it just works
// over HTTPS.

const VERSION = "v1";
const SHELL_CACHE = `cobd-shell-${VERSION}`;
const RUNTIME_CACHE = `cobd-runtime-${VERSION}`;

// Same-origin shell files the generator writes into the webDir.
const SHELL = [
    "./",
    "index.html",
    "offline.html",
    "menu.json",
    "apps.json",
    "brand.json",
];

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        // `reload` bypasses the HTTP cache so we precache fresh copies.
        await Promise.allSettled(
            SHELL.map((u) => cache.add(new Request(u, { cache: "reload" }))));
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keep = new Set([SHELL_CACHE, RUNTIME_CACHE]);
        for (const key of await caches.keys()) {
            if (!keep.has(key)) await caches.delete(key);
        }
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);

    // Navigations: network-first (so deploys land), falling back to the
    // cached page, then the shell, then the offline page.
    if (req.mode === "navigate") {
        event.respondWith((async () => {
            try {
                const res = await fetch(req);
                const cache = await caches.open(RUNTIME_CACHE);
                cache.put(req, res.clone());
                return res;
            } catch {
                return (await caches.match(req))
                    || (await caches.match("index.html"))
                    || (await caches.match("offline.html"))
                    || Response.error();
            }
        })());
        return;
    }

    // Same-origin assets: cache-first (the shell JSON, etc.).
    if (url.origin === self.location.origin) {
        event.respondWith((async () => {
            const cached = await caches.match(req);
            if (cached) return cached;
            try {
                const res = await fetch(req);
                if (res.ok) {
                    const cache = await caches.open(RUNTIME_CACHE);
                    cache.put(req, res.clone());
                }
                return res;
            } catch {
                return (await caches.match("offline.html")) || Response.error();
            }
        })());
        return;
    }

    // Cross-origin (the CLF CDN assets): stale-while-revalidate, so the
    // shell renders offline after the first online load.
    event.respondWith((async () => {
        const cached = await caches.match(req);
        const fetching = fetch(req).then((res) => {
            if (res && (res.ok || res.type === "opaque")) {
                caches.open(RUNTIME_CACHE).then((c) => c.put(req, res.clone()));
            }
            return res;
        }).catch(() => cached);
        return cached || fetching;
    })());
});
