// Public types for COBDCoreKit.
//
// COBDCoreKit runs IN the page (the top-level Capacitor WebView -- no
// iframe, no bridge) and calls the Capacitor plugins directly. Each
// plugin has a web implementation, so the same code works in a plain
// browser too; we don't branch on platform.

/** Native ops torch needs; injectable so tests don't touch hardware. */
export interface TorchBackend {
    on(): Promise<void>;
    off(): Promise<void>;
    buzz(durationMs: number): Promise<void>;
}

export interface TorchAPI {
    on(): Promise<boolean>;
    off(): Promise<boolean>;
    toggle(): Promise<boolean>;
    /** One-shot blink: light on + a haptic buzz, then off after `onMs` (default 750). */
    flash(onMs?: number): Promise<void>;
    /** Locally-tracked mirror of the LED state. */
    readonly isOn: boolean;
}

/** Flat position the geolocation shim hands to W3C callbacks. */
export interface FlatPosition {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
    timestamp: number;
}

/** Native geolocation ops; injectable for testing. */
export interface GeoBackend {
    getCurrentPosition(options?: unknown): Promise<FlatPosition>;
    watchPosition(
        options: unknown,
        cb: (pos: FlatPosition | null, err?: unknown) => void,
    ): Promise<string>;
    clearWatch(id: string): Promise<void>;
}

export interface NavAPI {
    /** Navigate the WebView to a URL (top-level; no iframe). */
    go(url: string): Promise<void>;
}

export interface BrowserAPI {
    /** Open a URL in the in-app browser (@capacitor/browser). */
    open(url: string): Promise<void>;
}

/** The native PDF op. No PDF plugin is bundled; the app supplies one. */
export interface PdfBackend {
    open(params: { url: string; title?: string; top?: number }): Promise<void>;
}

export interface PdfAPI {
    /** Open a PDF (URL or path) in a native viewer. Requires a configured backend. */
    open(file: string): Promise<void>;
}

/** One permission/entitlement entry, resolved for display. */
export interface EntitlementEntry {
    /** Capability name (e.g. "camera"). */
    capability: string;
    /** iOS Info.plist usage-description keys this capability needs. */
    iosKeys: string[];
    /** Android `<uses-permission>` names this capability needs. */
    androidPermissions: string[];
    /** Localized usage description shown in the prompt. */
    description: string;
}

export interface COBDCoreKit {
    readonly version: string;
    readonly torch: TorchAPI;
    readonly nav: NavAPI;
    readonly browser: BrowserAPI;
    readonly pdf: PdfAPI;
    /**
     * The permission/entitlement entries for a set of capabilities, with
     * each description resolved (via the optional `resolve` lookup, else
     * the capability's built-in English fallback). Handy for an in-app
     * pre-prompt before triggering the OS permission dialog.
     */
    getEntitlements(
        capabilities: string[],
        resolve?: (stringKey: string) => string | undefined,
    ): EntitlementEntry[];
}

/** Options for installCOBDCoreKit (backends are injectable for tests). */
export interface InstallOptions {
    torchBackend?: TorchBackend;
    geoBackend?: GeoBackend;
    pdfBackend?: PdfBackend;
    /** Override how nav.go navigates (default: window.location.assign). */
    navigate?: (url: string) => void;
    /** Override the in-app browser open (default: @capacitor/browser). */
    browserOpen?: (url: string) => Promise<void>;
    /** Skip overriding navigator.geolocation (default false). */
    skipGeolocationShim?: boolean;
}

declare global {
    interface Window {
        COBDCoreKit: COBDCoreKit;
    }
    // eslint-disable-next-line no-var
    var COBDCoreKit: COBDCoreKit;
}
