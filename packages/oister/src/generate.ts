// Rendering the oister umbrella shell.
//
//   renderApp({ brand, menu, seo, cdn })  -- the high-level entry:
//      maps the per-app source files cobd-app-generator already has
//      onto an OisterConfig and renders. This is what the generator
//      calls; the returned string drops straight into the app's
//      webDir/index.html.
//
//   renderOisterShell(config)             -- the low-level core:
//      compiles the bundled Handlebars template and renders a
//      fully-resolved OisterConfig.
//
// The template (src/assets/index.html, copied to dist/assets/ at
// build time) is Handlebars; this module registers the one helper
// it needs (`json`, for the JSON-LD block) and renders.

import Handlebars from "handlebars";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
    AppInput, Brand, Menu, MenuItem, OisterConfig,
} from "./types.js";

// COBD defaults for fields a per-app seo.json may omit.
const DEFAULT_LANG = "en";
const DEFAULT_OG_TYPE = "website";
const DEFAULT_THEME_COLOR = "#31d53d";
const DEFAULT_THEME_COLOR_DARK = "#1f2933";
const DEFAULT_SKIP_TO_MAIN = "Skip to main content";
const DEFAULT_SKIP_TO_SEARCH = "Skip to search";

const REQUIRED_CDN_ASSETS = [
    "tokensCss", "printCss", "chromeCss", "ionicCss",
    "ionicEsm", "ioniconsEsm", "fontScalePaintJs", "componentsJs",
] as const;

/**
 * Throw a descriptive error if `config` is missing a field the
 * template depends on. Fails loud at the boundary rather than
 * rendering a page with empty holes -- the same posture as
 * cobd-app-generator's validateBrand/validateMenu.
 */
export function validateOisterConfig(config: OisterConfig): void {
    const need = (cond: unknown, msg: string): void => {
        if (!cond) throw new Error(`oister config: ${msg}`);
    };
    need(config?.site?.title, "site.title is required");
    need(config?.site?.lang, "site.lang is required");
    need(config?.page?.titleHead, "page.titleHead is required");
    need(Array.isArray(config?.nav?.items), "nav.items must be an array");
    for (const key of REQUIRED_CDN_ASSETS) {
        need(config?.cdn?.[key]?.url, `cdn.${key}.url is required`);
    }
}

/** Validate a brand.json the way cobd-app-generator does. */
function validateBrand(brand: Brand): void {
    if (!brand?.appName || typeof brand.appName !== "string") {
        throw new Error("brand.json: appName is required");
    }
}

/** Accept either the bare array or `{ items: [...] }`; validate items. */
function normalizeMenu(menu: Menu): MenuItem[] {
    const items = Array.isArray(menu) ? menu : menu?.items;
    if (!Array.isArray(items)) {
        throw new Error("menu.json: expected an array or { items: [...] }");
    }
    for (const item of items) {
        if (!item?.label || !item?.target) {
            throw new Error(
                "menu.json: every item needs a label and a target");
        }
    }
    return items;
}

/**
 * Map the per-app source files (brand.json + menu.json + seo.json +
 * the CDN manifest) onto a fully-resolved OisterConfig, applying
 * COBD defaults for anything seo.json leaves out.
 */
export function appToConfig(input: AppInput): OisterConfig {
    const { brand, menu, seo, cdn } = input;
    validateBrand(brand);
    const items = normalizeMenu(menu);

    return {
        site: {
            lang: seo?.lang ?? DEFAULT_LANG,
            title: brand.appName,
            author: seo?.author ?? brand.appName,
            themeColor: brand.extra?.themeColor ?? DEFAULT_THEME_COLOR,
            themeColorDark: seo?.themeColorDark
                ?? brand.extra?.themeColorDark
                ?? DEFAULT_THEME_COLOR_DARK,
        },
        page: {
            titleHead: seo?.title ?? brand.appName,
            url: seo.url,
            description: seo.description,
            ogType: seo?.ogType ?? DEFAULT_OG_TYPE,
            image: seo.image,
        },
        social: { twitterHandle: seo?.social?.twitterHandle ?? "" },
        org: {
            url: seo?.org?.url ?? seo.url,
            logoUrl: seo?.org?.logoUrl ?? seo.image,
        },
        i18n: {
            skipToMain: seo?.i18n?.skipToMain ?? DEFAULT_SKIP_TO_MAIN,
            skipToSearch: seo?.i18n?.skipToSearch ?? DEFAULT_SKIP_TO_SEARCH,
        },
        nav: {
            items: items.map((i) => ({ label: i.label, href: i.target })),
        },
        app: { url: brand.extra?.appUrl ?? "" },
        cdn,
    };
}

/**
 * A private Handlebars environment with the shell's helpers
 * registered. Created per render so concurrent callers can't see
 * each other's helper state.
 */
function createHandlebars(): typeof Handlebars {
    const hb = Handlebars.create();
    // {{json x}} -> JSON-encoded value (a SafeString, so it is not
    // HTML-escaped). Used inside the JSON-LD <script>, where HTML
    // escaping would corrupt the JSON; JSON.stringify keeps quotes
    // and special characters valid.
    hb.registerHelper("json", (value: unknown) =>
        new hb.SafeString(JSON.stringify(value ?? null)));
    return hb;
}

let cachedTemplate: string | null = null;

/**
 * The bundled Handlebars template source. Resolved relative to this
 * module so it works from both `src/` (tests via tsx) and `dist/`
 * (the published package, where build/copy-assets.mjs places it).
 */
export function loadBundledTemplate(): string {
    if (cachedTemplate === null) {
        const path = fileURLToPath(
            new URL("./assets/index.html", import.meta.url));
        cachedTemplate = readFileSync(path, "utf8");
    }
    return cachedTemplate;
}

/**
 * Render the oister umbrella-shell index.html from a fully-resolved
 * OisterConfig. Returns the finished HTML page as a string.
 *
 * Pass `templateSrc` to render an alternate template (used by tests);
 * it defaults to the bundled one.
 */
export function renderOisterShell(
    config: OisterConfig,
    templateSrc: string = loadBundledTemplate(),
): string {
    validateOisterConfig(config);
    const hb = createHandlebars();
    const template = hb.compile(templateSrc);
    return template(config);
}

/**
 * Render the shell straight from the per-app source files
 * (brand.json + menu.json + seo.json + the CDN manifest). Returns
 * the finished page as a string -- drop it into the generated app's
 * webDir (e.g. `.generated/<app>/www/index.html`).
 */
export function renderApp(
    input: AppInput,
    templateSrc: string = loadBundledTemplate(),
): string {
    return renderOisterShell(appToConfig(input), templateSrc);
}
