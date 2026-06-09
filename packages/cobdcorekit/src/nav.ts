import type { NavAPI } from "./types.js";

/**
 * `COBDCoreKit.nav` — `go(url)` navigates the WebView itself (top-level;
 * there's no iframe in this model). Off-domain URLs are routed to the
 * system browser by Capacitor's `server.allowNavigation`.
 */
export function installNav(
    navigate: (url: string) => void = (url) => {
        if (typeof window !== "undefined") window.location.assign(url);
    },
): NavAPI {
    return {
        async go(url) {
            if (!url) throw new Error("nav.go: url required");
            navigate(url);
        },
    };
}
