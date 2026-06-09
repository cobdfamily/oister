// Pure URL helpers for the per-app "resume where you left off"
// feature. No DOM/storage globals here (only the standard URL API,
// which exists in browsers and Node) so this logic is unit-testable
// without a DOM. The element (cobd-apps-grid.ts) wires these to
// localStorage + location.
//
// Storage scheme: localStorage key "app:<hostname>", value the rest
// of that app's URL (pathname + search + hash).

export const KEY_PREFIX = "app:";

/** The localStorage key for an app, derived from its URL's hostname. */
export function appKey(href: string, base?: string): string | null {
    try {
        return KEY_PREFIX + new URL(href, base).hostname;
    } catch {
        return null;
    }
}

/** The "rest" of a URL to store: pathname + search + hash. */
export function restOfUrl(url: string): string | null {
    try {
        const u = new URL(url);
        return u.pathname + u.search + u.hash;
    } catch {
        return null;
    }
}

/**
 * Reconstruct an app's resume URL from a stored "rest", resolved
 * against the app's own href so the origin/scheme come from the app
 * (never assumed).
 */
export function resumeUrl(href: string, rest: string): string | null {
    try {
        return new URL(rest, href).href;
    } catch {
        return null;
    }
}
