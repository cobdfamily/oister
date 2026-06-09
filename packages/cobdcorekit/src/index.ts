// COBDCoreKit — the single client API that runs IN the page (the
// top-level Capacitor WebView) and calls the Capacitor plugins
// directly. No iframe, no bridge, no host broker: with no iframe to
// span, the page is already in the Capacitor context, and each plugin
// has a web implementation so the same code also works in a plain
// browser. (Replaces the former cobdcorekit + cobdhostkit split.)

import { installGeolocationShim } from "./geolocation.js";
import { installTorch } from "./torch.js";
import { installNav } from "./nav.js";
import { installBrowser } from "./browser.js";
import { installPdf } from "./pdf.js";
import { getEntitlements } from "./permissions.js";
import type { COBDCoreKit, InstallOptions } from "./types.js";

export const VERSION = "0.0.0";

/**
 * Install the COBDCoreKit surfaces:
 *   - overrides `navigator.geolocation` (routed through @capacitor/geolocation)
 *   - exposes the `COBDCoreKit` global (`torch`, `nav`, `browser`, `pdf`,
 *     `getEntitlements`)
 *
 * Backends are injectable via `opts` for testing; in production the
 * defaults call the Capacitor plugins.
 */
export function installCOBDCoreKit(opts: InstallOptions = {}): COBDCoreKit {
    if (!opts.skipGeolocationShim && typeof navigator !== "undefined") {
        installGeolocationShim(opts.geoBackend);
    }

    const kit: COBDCoreKit = {
        get version() {
            return VERSION;
        },
        torch: installTorch({ backend: opts.torchBackend }),
        nav: installNav(opts.navigate),
        browser: installBrowser(opts.browserOpen),
        pdf: installPdf(opts.pdfBackend),
        getEntitlements,
    };

    (globalThis as { COBDCoreKit?: COBDCoreKit }).COBDCoreKit = kit;
    return kit;
}

// Auto-install when the host injects this with a config marker.
if (typeof window !== "undefined"
    && (window as { __COBDCoreKit_AUTOINSTALL__?: unknown }).__COBDCoreKit_AUTOINSTALL__) {
    installCOBDCoreKit(
        (window as { __COBDCoreKit_CONFIG__?: InstallOptions }).__COBDCoreKit_CONFIG__ ?? {});
}

export { installGeolocationShim } from "./geolocation.js";
export { installTorch } from "./torch.js";
export { installNav } from "./nav.js";
export { installBrowser } from "./browser.js";
export { installPdf } from "./pdf.js";
export {
    CAPABILITY_PERMISSIONS,
    capabilityPermission,
    getEntitlements,
} from "./permissions.js";
export type { CapabilityPermission } from "./permissions.js";
export type {
    COBDCoreKit,
    TorchAPI,
    TorchBackend,
    NavAPI,
    BrowserAPI,
    PdfAPI,
    PdfBackend,
    GeoBackend,
    FlatPosition,
    EntitlementEntry,
    InstallOptions,
} from "./types.js";
