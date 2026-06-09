import { Browser } from "@capacitor/browser";

import type { BrowserAPI } from "./types.js";

/**
 * `COBDCoreKit.browser` — opens a URL in the in-app browser via
 * @capacitor/browser (web impl falls back to window.open).
 */
export function installBrowser(
    open: (url: string) => Promise<void> = (url) => Browser.open({ url }),
): BrowserAPI {
    return {
        async open(url) {
            if (!url) throw new Error("browser.open: url required");
            await open(url);
        },
    };
}
