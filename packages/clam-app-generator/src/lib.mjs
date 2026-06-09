// Pure helpers for the generator — no side effects, so they're unit-testable
// without the native toolchain. The CLI (bin/gen.mjs) wires these to fs/exec.

import { readFileSync } from "node:fs";

import { CAPABILITY_PERMISSIONS } from "@cobdfamily/cobdcorekit/permissions";

const APP_ID_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Validate + normalize an app's brand.json.
 * Required: appId (reverse-DNS), appName. Returns a frozen normalized object.
 */
export function validateBrand(brand, appName) {
  const where = `apps/${appName ?? "?"}/brand.json`;
  if (!brand || typeof brand !== "object") throw new Error(`${where}: not an object`);
  if (typeof brand.appId !== "string" || !APP_ID_RE.test(brand.appId)) {
    throw new Error(`${where}: "appId" must be reverse-DNS (e.g. "ca.cobd.app.alpha"), got ${JSON.stringify(brand.appId)}`);
  }
  if (typeof brand.appName !== "string" || brand.appName.trim() === "") {
    throw new Error(`${where}: "appName" is required`);
  }
  return Object.freeze({
    appId: brand.appId,
    appName: brand.appName,
    // optional: theme color etc., passed through untouched
    extra: brand.extra ?? {},
  });
}

/** Validate a menu.json: an array of { label, target } items. */
export function validateMenu(menu, appName) {
  const where = `apps/${appName ?? "?"}/menu.json`;
  const items = Array.isArray(menu) ? menu : menu?.items;
  if (!Array.isArray(items)) throw new Error(`${where}: expected an array (or { items: [...] })`);
  items.forEach((it, i) => {
    if (typeof it?.label !== "string") throw new Error(`${where}[${i}]: "label" is required`);
    if (typeof it?.target !== "string") throw new Error(`${where}[${i}]: "target" is required`);
  });
  return items;
}

/**
 * Validate an app's apps.json: the launcher tiles for <cobd-apps-grid>
 * (distinct from menu.json's nav). An array or { apps: [...] }; each
 * tile needs a label + target (the launch URL). image_url is optional
 * (the tile image); beta_target is accepted but ignored (see
 * tilesForGrid) — it's the beta-channel URL, not wired up yet.
 */
export function validateApps(apps, appName) {
  const where = `apps/${appName ?? "?"}/apps.json`;
  const items = Array.isArray(apps) ? apps : apps?.apps;
  if (!Array.isArray(items)) throw new Error(`${where}: expected an array (or { apps: [...] })`);
  items.forEach((it, i) => {
    if (typeof it?.label !== "string" || it.label.trim() === "") {
      throw new Error(`${where}[${i}]: "label" is required`);
    }
    if (typeof it?.target !== "string" || it.target.trim() === "") {
      throw new Error(`${where}[${i}]: "target" is required`);
    }
  });
  return items;
}

/**
 * Compile authoring tiles (label / target / image_url, + beta_target which
 * we ignore for now) into the runtime shape <cobd-apps-grid> consumes:
 * label / href (the launch URL) / iconUrl (the tile image). The beta_target
 * is intentionally dropped until a beta-channel toggle exists.
 */
export function tilesForGrid(items) {
  return items.map((it) => {
    const tile = { label: it.label, href: it.target };
    if (typeof it.image_url === "string" && it.image_url.trim() !== "") {
      tile.iconUrl = it.image_url;
    }
    return tile;
  });
}

/**
 * Validate an app's SEO metadata (the `seo` block of brand.json):
 * the page/site metadata the clam shell needs beyond branding +
 * nav. description/url/image are required (no sane default); the rest
 * is filled by the shell renderer (src/clam.mjs renderApp) from
 * brand-derived or COBD defaults.
 */
export function validateSeo(seo, appName) {
  const where = `apps/${appName ?? "?"}/brand.json (seo)`;
  if (!seo || typeof seo !== "object") throw new Error(`${where}: not an object`);
  for (const key of ["description", "url", "image"]) {
    if (typeof seo[key] !== "string" || seo[key].trim() === "") {
      throw new Error(`${where}: "${key}" is required`);
    }
  }
  return seo;
}

/** Validate the top-level generator config. */
export function validateConfig(config) {
  if (typeof config?.capacitorVersion !== "string") throw new Error("generator.config.json: capacitorVersion required");
  const platforms = config.platforms ?? ["android", "ios"];
  for (const p of platforms) {
    if (p !== "android" && p !== "ios") throw new Error(`generator.config.json: unknown platform "${p}"`);
  }
  return { ...config, platforms };
}

// Which CDN manifest component each shell asset lives in, and its
// filename under that component's versioned path. Mirrors how
// clf-factory lays out the bundle (clf-core/<ver>/, clf-assets/
// cf<ver>/, ionic/<ver>/, ionicons/<ver>/).
const CDN_ASSETS = {
  tokensCss:        ["clfCommon", "tokens.css"],
  componentsJs:     ["clfCommon", "components/index.js"],
  // The <cobd-apps-grid> launcher: a clf-core element shipped as a
  // standalone component (deliberately NOT in components/index.js),
  // so the shell loads it from its own URL. Lives in clf-core since 7.x.
  appsGridJs:       ["clfCommon", "components/cobd-apps-grid.js"],
  fontScalePaintJs: ["clfCommon", "theming/font-scale-paint.js"],
  chromeCss:        ["clfFactoryChrome", "chrome.css"],
  printCss:         ["clfFactoryChrome", "print.css"],
  ionicCss:         ["ionic", "ionic.bundle.css"],
  ionicEsm:         ["ionic", "ionic.esm.js"],
  ioniconsEsm:      ["ionicons", "ionicons.esm.js"],
};

/**
 * Build the eight clam-shell asset URLs from a parsed clf CDN
 * manifest.json (the one served at cdn.blindhub.ca/manifest.json).
 * Version paths come from the manifest, so a clf release just shifts
 * the resolved URLs -- nothing here is hardcoded per version.
 * Returns { <asset>: { url } }; sync-cdn adds the SRI after fetching.
 */
/**
 * Resolve an app's capability list (brand.json `extra.capabilities`,
 * e.g. ["camera","location","notifications"]) into the native
 * permissions to emit, using @cobdfamily/cobdcorekit's map:
 *
 *   {
 *     ios:     { "NSCameraUsageDescription": { stringKey, fallback }, ... },
 *     android: ["android.permission.CAMERA", ...]
 *   }
 *
 * The generator turns `ios` into Info.plist usage strings (+ localized
 * InfoPlist.strings) and `android` into <uses-permission> lines.
 * Unknown capabilities are skipped; capabilities with no iOS privacy
 * string (notifications, flashlight) contribute only Android entries.
 */
export function collectPermissions(capabilities) {
  const ios = {};
  const android = new Set();
  for (const cap of capabilities ?? []) {
    const p = CAPABILITY_PERMISSIONS[cap];
    if (!p) continue;
    for (const key of p.ios) ios[key] = { stringKey: p.stringKey, fallback: p.fallback };
    for (const perm of p.android) android.add(perm);
  }
  return { ios, android: [...android] };
}

/**
 * Add locales to an Xcode project's `knownRegions` list so iOS loads
 * the matching `<locale>.lproj/InfoPlist.strings` (it ignores .lproj
 * dirs for regions not registered here). Pure string transform on the
 * project.pbxproj contents; idempotent (won't duplicate existing
 * regions). Returns the text unchanged if no knownRegions block exists.
 */
export function addKnownRegions(pbxproj, locales) {
  return pbxproj.replace(/knownRegions = \(([\s\S]*?)\);/, (full, inner) => {
    const existing = inner
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
    const want = (locales ?? []).filter((l) => l && !existing.includes(l));
    if (want.length === 0) return full;
    const merged = [...existing, ...want];
    const indent = "\t\t\t\t";
    // Quote anything that isn't a bare alphanumeric region code (e.g. "en-GB").
    const body = merged
      .map((r) => indent + (/^[A-Za-z0-9]+$/.test(r) ? r : `"${r}"`))
      .join(",\n");
    return `knownRegions = (\n${body},\n\t\t\t);`;
  });
}

/**
 * static-web-server config (TOML) for a per-app clam shell image.
 * Serves the app's webDir at /public on :8080; the service worker
 * (sw.js) handles offline caching client-side. Mirrors the clf-cdn
 * image's [general] block (same joseluisq/static-web-server base).
 */
export function renderSwsConfig() {
  return [
    "# static-web-server config for a generated clam app shell.",
    "# GENERATED by @cobdfamily/clam-app-generator — do not edit.",
    "[general]",
    'host = "0.0.0.0"',
    "port = 8080",
    'root = "/public"',
    "directory-listing = false",
    "compression = true",
    'log-level = "warn"',
    "",
  ].join("\n");
}

/**
 * Dockerfile for a per-app sws runtime image (one image per app,
 * mirroring clf-factory's clf-cdn image). Build context is the app's
 * output dir (it holds www/ + this Dockerfile + sws.toml):
 *   docker build -t cobdfamily/clam-<appId-with-dashes> .
 */
export function renderSwsDockerfile(brand) {
  const repo = brand.appId.replace(/\./g, "-");
  return `# Per-app static-web-server image for ${brand.appName} (${brand.appId}).
# GENERATED by @cobdfamily/clam-app-generator — do not edit.
# Serves this app's clam shell (the webDir) for a remote / server.url
# deployment. Build from the app's output dir:
#   docker build -t cobdfamily/clam-${repo} .
FROM joseluisq/static-web-server:2-alpine
COPY www /public
COPY sws.toml /sws.toml
EXPOSE 8080
CMD ["--config-file", "/sws.toml"]
`;
}

export function cdnUrlsFromManifest(manifest, base) {
  const root = String(base ?? "").replace(/\/$/, "");
  if (!root) throw new Error("cdnUrlsFromManifest: base url required");
  const out = {};
  for (const [asset, [component, file]] of Object.entries(CDN_ASSETS)) {
    const path = manifest?.components?.[component]?.path;
    if (typeof path !== "string" || path === "") {
      throw new Error(`cdn manifest: missing component "${component}"`);
    }
    out[asset] = { url: `${root}/${path}${file}` };
  }
  return out;
}

/**
 * The ordered plan for regenerating one app. Returned as plain step descriptors
 * so the CLI can log them (and --dry-run can print them) before executing.
 * This is the canonical statement of approach D.
 */
export function planSteps({ config, app, brand }) {
  const ver = config.capacitorVersion;
  const platforms = config.platforms.join(", ");
  return [
    { id: "clean", desc: `wipe ${config.outDir}/${app} (native projects are disposable)` },
    { id: "build-web", desc: `build base web: ${config.base?.buildCommand || "(no base configured — clam shell only)"}` },
    { id: "assemble-web", desc: `copy base dist + overlay assets (menu.json, apps.json, brand.json) into webDir; render index.html + offline service worker (clam shell renderer)` },
    { id: "sws-image", desc: `emit a per-app static-web-server image context (Dockerfile + sws.toml) serving the webDir` },
    { id: "scaffold", desc: `write package.json (Capacitor pinned ${ver}) + capacitor.config.ts (appId=${brand.appId}, appName=${brand.appName})` },
    { id: "install", desc: `npm install in the ephemeral project` },
    { id: "cap-add", desc: `npx cap add ${platforms}` },
    { id: "overlay-native", desc: `apply native permissions from extra.capabilities (Info.plist + InfoPlist.strings + knownRegions, Android perms) + WKAppBoundDomains from extra.domains` },
    { id: "assets", desc: `npx capacitor-assets generate (from the springboard's icon.png)` },
    { id: "cap-sync", desc: `npx cap sync` },
    { id: "build-sign", desc: `build + sign (CI): gradle (Android) / fastlane match + xcodebuild (iOS)` },
  ];
}

/** Render the ephemeral project's capacitor.config.ts from a brand. */
/**
 * An app's allowed base domain(s) — the single source of truth set in
 * brand.json `extra.domains` (an array) or `extra.domain` (a string).
 * Everything the app reaches is a subdomain of these (e.g.
 * apps.<domain>, forum.<domain>). Lowercased, trimmed, deduped.
 */
export function appDomains(brand) {
  const e = brand?.extra ?? {};
  const raw = Array.isArray(e.domains) ? e.domains
    : (typeof e.domain === "string" ? [e.domain] : []);
  return [...new Set(raw.map((d) => String(d).trim().toLowerCase()).filter(Boolean))];
}

/**
 * Capacitor `server.allowNavigation` patterns for the base domains:
 * the apex plus a wildcard for its subdomains. In-domain URLs stay in
 * the WebView; everything else opens in the system browser.
 */
export function allowNavigation(domains) {
  return domains.flatMap((d) => [d, `*.${d}`]);
}

/**
 * The origin the app's shell is served from: `apps.<primary domain>`
 * (the first of brand.extra.domains). This is the Capacitor
 * `server.url` — the WebView loads the shell remotely from here (the
 * per-app sws image), and it's a subdomain of the allowed domain so
 * app-bound domains + allowNavigation cover it. Empty when no domains.
 */
export function appsOrigin(domains) {
  return domains.length ? `https://apps.${domains[0]}` : "";
}

/**
 * Make an asset reference absolute against an origin when it's a
 * relative path (e.g. "assets/logo.svg" -> "<origin>/assets/logo.svg").
 * Absolute URLs (http(s):// or //) and empty values pass through. Used
 * for og:image + the JSON-LD logo, which external crawlers can't
 * resolve relatively; in-app references (grid icons) stay relative.
 */
export function absolutizeAsset(value, origin) {
  if (!value || !origin) return value;
  if (/^https?:\/\//i.test(value) || value.startsWith("//")) return value;
  return `${origin.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
}

export function renderCapacitorConfig(brand) {
  const domains = appDomains(brand);
  const nav = allowNavigation(domains);
  const url = appsOrigin(domains);
  // Derived from the app's allowed domains: load the shell remotely
  // from apps.<domain>, route in-domain navigations inside the WebView
  // (off-domain → system browser), and limit the WebView to app-bound
  // domains (which also enables service workers).
  const serverLines = [];
  if (url) serverLines.push(`    url: ${JSON.stringify(url)},`);
  if (nav.length) serverLines.push(`    allowNavigation: ${JSON.stringify(nav)},`);
  const serverBlock = serverLines.length
    ? `  server: {\n${serverLines.join("\n")}\n  },\n`
    : "";
  const iosBlock = domains.length
    ? `  ios: {\n    limitsNavigationsToAppBoundDomains: true,\n  },\n`
    : "";
  return `import type { CapacitorConfig } from "@capacitor/cli";

// GENERATED by @cobdfamily/clam-app-generator — do not edit; edit the app's brand.json.
const config: CapacitorConfig = {
  appId: ${JSON.stringify(brand.appId)},
  appName: ${JSON.stringify(brand.appName)},
  webDir: "www",
${serverBlock}${iosBlock}};

export default config;
`;
}

/** Render the ephemeral project's package.json with Capacitor pinned. */
export function renderProjectPackageJson(brand, config) {
  const v = `^${config.capacitorVersion}`;
  const pkg = {
    name: brand.appId.replace(/\./g, "-"),
    version: "0.0.0",
    private: true,
    description: `Generated Capacitor app ${brand.appName} (${brand.appId}). Do not edit — regenerated by @cobdfamily/clam-app-generator.`,
    dependencies: {
      "@capacitor/android": v,
      "@capacitor/core": v,
      "@capacitor/ios": v,
    },
    devDependencies: {
      "@capacitor/assets": "latest",
      "@capacitor/cli": v,
    },
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}
