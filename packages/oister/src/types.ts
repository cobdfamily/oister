// Data contracts for the oister umbrella-shell generator.
//
// Two layers:
//   - OisterConfig: the canonical, fully-resolved shape the
//     template consumes (renderOisterShell).
//   - AppInput (brand + menu + seo + cdn): the per-app source
//     files cobd-app-generator already has; renderApp maps these
//     down to an OisterConfig.

/**
 * One CDN-hosted asset referenced by the shell: its URL plus the
 * raw integrity/crossorigin attribute string to drop beside it.
 */
export interface CdnAsset {
    /** Absolute URL, e.g. `https://cdn.blindhub.ca/ionic/8/ionic.esm.js`. */
    url: string;
    /**
     * Raw HTML attribute(s) emitted verbatim next to the tag, e.g.
     * `integrity="sha384-…" crossorigin="anonymous"`. Rendered
     * unescaped (`{{{ }}}`); omit or pass `""` for no integrity.
     */
    integrityAttr?: string;
}

/** The eight CDN assets the shell loads (the clf-core CDN bundle). */
export interface CdnManifest {
    tokensCss: CdnAsset;
    printCss: CdnAsset;
    chromeCss: CdnAsset;
    ionicCss: CdnAsset;
    ionicEsm: CdnAsset;
    ioniconsEsm: CdnAsset;
    fontScalePaintJs: CdnAsset;
    componentsJs: CdnAsset;
}

/** A single resolved nav link (label + destination href). */
export interface NavLink {
    label: string;
    href: string;
}

/** The canonical, fully-resolved payload `renderOisterShell` expects. */
export interface OisterConfig {
    site: {
        /** BCP-47 language tag for `<html lang>` + `og:locale`. */
        lang: string;
        /** Site name (`og:site_name` + the primary-nav accordion label). */
        title: string;
        /** Organisation name for the JSON-LD `Organization.name`. */
        author: string;
        /** `theme-color` for light mode. */
        themeColor: string;
        /** `theme-color` for dark mode. */
        themeColorDark: string;
    };
    page: {
        /** `<title>` + `og:title` + `twitter:title`. */
        titleHead: string;
        /** Canonical/OG URL for this page. */
        url: string;
        /** Meta + OG + Twitter description. */
        description: string;
        /** `og:type`, e.g. `website`. */
        ogType: string;
        /** Absolute URL of the social-share image. */
        image: string;
    };
    social: {
        /** `twitter:site` handle, including the leading `@`. */
        twitterHandle: string;
    };
    org: {
        /** JSON-LD `Organization.url`. */
        url: string;
        /** JSON-LD `Organization.logo` URL. */
        logoUrl: string;
    };
    i18n: {
        /** Skip-link label targeting `#main`. */
        skipToMain: string;
        /** Skip-link label targeting the page search. */
        skipToSearch: string;
    };
    nav: {
        /**
         * The single menu, as resolved links. Rendered both as the
         * live local nav (a `<ul slot="menu">` consumed by
         * `<cobd-app-shell>` in cobd-nav local mode) and as the
         * no-JS `<noscript>` fallback list.
         */
        items: NavLink[];
    };
    app: {
        /**
         * URL the shell's `<iframe name="app">` loads -- the web UI
         * this native shell wraps. Empty string renders the iframe
         * with no src (blank app pane).
         */
        url: string;
    };
    cdn: CdnManifest;
}

// ---- Per-app source files (the AppInput layer) ---------------

/** A `brand.json` (as used by cobd-app-generator). */
export interface Brand {
    /** Reverse-DNS app id, e.g. `ca.cobd.apps.core`. */
    appId: string;
    /** Display name -> the shell's site title. */
    appName: string;
    /** Pass-through extras; `themeColor` / `themeColorDark` / `appUrl` are read. */
    extra?: {
        themeColor?: string;
        themeColorDark?: string;
        /** URL the shell's iframe loads -> OisterConfig.app.url. */
        appUrl?: string;
        [key: string]: unknown;
    };
}

/** One `menu.json` entry. */
export interface MenuItem {
    label: string;
    /** Destination (becomes the link's `href`). */
    target: string;
}

/** A `menu.json` -- either the bare array or `{ items: [...] }`. */
export type Menu = MenuItem[] | { items: MenuItem[] };

/**
 * A `seo.json`: the page/site metadata the shell needs that isn't
 * branding or navigation. Most fields are optional and fall back to
 * brand-derived or COBD defaults; `description`, `url`, and `image`
 * are required because there's no sane default for them.
 */
export interface Seo {
    /** `<html lang>`; default `"en"`. */
    lang?: string;
    /** `<title>` / og:title; default `brand.appName`. */
    title?: string;
    /** Meta + OG + Twitter description. Required. */
    description: string;
    /** Canonical / OG url. Required. */
    url: string;
    /** Social-share image url. Required. */
    image: string;
    /** `og:type`; default `"website"`. */
    ogType?: string;
    /** JSON-LD org name; default `brand.appName`. */
    author?: string;
    /** Dark-mode `theme-color`; falls back to `brand.extra.themeColorDark`. */
    themeColorDark?: string;
    org?: {
        /** JSON-LD `Organization.url`; default `seo.url`. */
        url?: string;
        /** JSON-LD `Organization.logo`; default `seo.image`. */
        logoUrl?: string;
    };
    social?: {
        /** `twitter:site`; default `""`. */
        twitterHandle?: string;
    };
    i18n?: {
        skipToMain?: string;
        skipToSearch?: string;
    };
}

/** The four per-app inputs `renderApp` maps to an OisterConfig. */
export interface AppInput {
    brand: Brand;
    menu: Menu;
    seo: Seo;
    /** The clf-core CDN/SRI manifest (URLs + integrity per release). */
    cdn: CdnManifest;
}
