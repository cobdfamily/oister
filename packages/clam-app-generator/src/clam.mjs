// Rendering the clam umbrella shell.
//
// Folded in from the former @cobdfamily/clam package (it had a single
// consumer — this generator — and wasn't published, so it lived here as a
// build-time renderer behind a dist/ import). Ported to plain .mjs to keep the
// generator build-free.
//
//   renderApp({ brand, menu, seo, cdn })  -- the high-level entry: maps the
//      per-app source files (brand.json + menu.json + seo + the CDN manifest)
//      onto an ClamConfig and renders. The returned string drops straight
//      into the app's webDir/index.html.
//
//   renderClamShell(config)             -- the low-level core: compiles the
//      bundled Handlebars template (./assets/index.html) and renders a
//      fully-resolved ClamConfig.

import Handlebars from "handlebars";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// COBD defaults for fields a per-app seo block may omit.
const DEFAULT_LANG = "en";
const DEFAULT_OG_TYPE = "website";
const DEFAULT_THEME_COLOR = "#31d53d";
const DEFAULT_THEME_COLOR_DARK = "#1f2933";
const DEFAULT_SKIP_TO_MAIN = "Skip to main content";
const DEFAULT_SKIP_TO_SEARCH = "Skip to search";

const REQUIRED_CDN_ASSETS = [
    "tokensCss", "printCss", "chromeCss", "ionicCss",
    "ionicEsm", "ioniconsEsm", "fontScalePaintJs", "componentsJs",
];

/**
 * Throw a descriptive error if `config` is missing a field the template
 * depends on. Fails loud at the boundary rather than rendering a page with
 * empty holes — the same posture as the generator's validateBrand/validateMenu.
 */
export function validateClamConfig(config) {
    const need = (cond, msg) => {
        if (!cond) throw new Error(`clam config: ${msg}`);
    };
    need(config?.site?.title, "site.title is required");
    need(config?.site?.lang, "site.lang is required");
    need(config?.page?.titleHead, "page.titleHead is required");
    need(Array.isArray(config?.nav?.items), "nav.items must be an array");
    for (const key of REQUIRED_CDN_ASSETS) {
        need(config?.cdn?.[key]?.url, `cdn.${key}.url is required`);
    }
}

/** Validate a brand.json the way the generator does. */
function validateBrand(brand) {
    if (!brand?.appName || typeof brand.appName !== "string") {
        throw new Error("brand.json: appName is required");
    }
}

/** Accept either the bare array or `{ items: [...] }`; validate items. */
function normalizeMenu(menu) {
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
 * Map the per-app source files (brand.json + menu.json + seo + the CDN
 * manifest) onto a fully-resolved ClamConfig, applying COBD defaults for
 * anything the seo block leaves out.
 */
export function appToConfig(input) {
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
        apps: { path: input.appsPath ?? "apps.json" },
        cdn,
    };
}

/**
 * A private Handlebars environment with the shell's helpers registered.
 * Created per render so concurrent callers can't see each other's helper state.
 */
function createHandlebars() {
    const hb = Handlebars.create();
    // {{json x}} -> JSON-encoded value (a SafeString, so it is not
    // HTML-escaped). Used inside the JSON-LD <script>, where HTML escaping
    // would corrupt the JSON; JSON.stringify keeps quotes and special
    // characters valid.
    hb.registerHelper("json", (value) =>
        new hb.SafeString(JSON.stringify(value ?? null)));
    return hb;
}

/**
 * Static (non-templated) assets shipped with the shell that the generator must
 * copy into the app's webDir next to index.html: the offline service worker,
 * its registration script, and the offline fallback page.
 */
export const STATIC_ASSETS = ["sw.js", "sw-register.js", "offline.html"];

/** Read one bundled static asset (from ./assets/). */
export function loadAsset(name) {
    const path = fileURLToPath(new URL(`./assets/${name}`, import.meta.url));
    return readFileSync(path, "utf8");
}

let cachedTemplate = null;

/** The bundled Handlebars template source (./assets/index.html). */
export function loadBundledTemplate() {
    if (cachedTemplate === null) {
        const path = fileURLToPath(
            new URL("./assets/index.html", import.meta.url));
        cachedTemplate = readFileSync(path, "utf8");
    }
    return cachedTemplate;
}

/**
 * Render the clam umbrella-shell index.html from a fully-resolved
 * ClamConfig. Returns the finished HTML page as a string. Pass `templateSrc`
 * to render an alternate template (used by tests); defaults to the bundled one.
 */
export function renderClamShell(config, templateSrc = loadBundledTemplate()) {
    validateClamConfig(config);
    const hb = createHandlebars();
    const template = hb.compile(templateSrc);
    return template(config);
}

/**
 * Render the shell straight from the per-app source files (brand.json +
 * menu.json + seo + the CDN manifest). Returns the finished page as a string —
 * drop it into the generated app's webDir (e.g. `.generated/<app>/www/index.html`).
 */
export function renderApp(input, templateSrc = loadBundledTemplate()) {
    return renderClamShell(appToConfig(input), templateSrc);
}
