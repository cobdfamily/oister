// Registers the clam shell service worker (sw.js). External (not
// inline) so it works under a strict Content-Security-Policy with no
// 'unsafe-inline'. Registration is best-effort: a failure (e.g. SW
// unsupported, or app-bound domains not configured in a WebView)
// leaves the page working online, just without offline caching.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => { /* online-only */ });
    });
}
