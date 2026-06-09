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
 * Validate an app's seo.json: the page/site metadata the oister
 * shell needs beyond branding + nav. description/url/image are
 * required (no sane default); the rest is filled by @cobdfamily/
 * oister's renderApp from brand-derived or COBD defaults.
 */
export function validateSeo(seo, appName) {
  const where = `apps/${appName ?? "?"}/seo.json`;
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
  fontScalePaintJs: ["clfCommon", "theming/font-scale-paint.js"],
  chromeCss:        ["clfFactoryChrome", "chrome.css"],
  printCss:         ["clfFactoryChrome", "print.css"],
  ionicCss:         ["ionic", "ionic.bundle.css"],
  ionicEsm:         ["ionic", "ionic.esm.js"],
  ioniconsEsm:      ["ionicons", "ionicons.esm.js"],
};

/**
 * Build the eight oister-shell asset URLs from a parsed clf CDN
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
    { id: "build-web", desc: `build base web: ${config.base?.buildCommand || "(no base configured — oister shell only)"}` },
    { id: "assemble-web", desc: `copy base dist + overlay assets (menu.json, brand.json) into webDir; render index.html from brand/menu/seo via @cobdfamily/oister` },
    { id: "scaffold", desc: `write package.json (Capacitor pinned ${ver}) + capacitor.config.ts (appId=${brand.appId}, appName=${brand.appName})` },
    { id: "install", desc: `npm install in the ephemeral project` },
    { id: "cap-add", desc: `npx cap add ${platforms}` },
    { id: "overlay-native", desc: `apply native permissions from extra.capabilities (iOS Info.plist + localized InfoPlist.strings, Android <uses-permission>)` },
    { id: "assets", desc: `npx capacitor-assets generate (from apps/${app}/icon.png)` },
    { id: "cap-sync", desc: `npx cap sync` },
    { id: "build-sign", desc: `build + sign (CI): gradle (Android) / fastlane match + xcodebuild (iOS)` },
  ];
}

/** Render the ephemeral project's capacitor.config.ts from a brand. */
export function renderCapacitorConfig(brand) {
  return `import type { CapacitorConfig } from "@capacitor/cli";

// GENERATED by @cobdfamily/cobd-app-generator — do not edit; edit the app's brand.json.
const config: CapacitorConfig = {
  appId: ${JSON.stringify(brand.appId)},
  appName: ${JSON.stringify(brand.appName)},
  webDir: "www",
};

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
    description: `Generated Capacitor app ${brand.appName} (${brand.appId}). Do not edit — regenerated by @cobdfamily/cobd-app-generator.`,
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
