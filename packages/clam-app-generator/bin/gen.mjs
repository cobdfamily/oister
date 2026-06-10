#!/usr/bin/env node
// clam-app-generator — regenerate a disposable Capacitor project for one app
// from the shared web base + that app's overlay (brand.json / menu.json /
// icon.png), at the pinned Capacitor version. Approach D.
//
// The shared web base is configured in generator.config.json > base. It is
// currently unset (the cobdappkit package was removed); set it before a real run.
//
// The apps no longer live in this package — each app's springboard (its
// brand.json / menu.json / apps.json / icon.png / assets) lives in that app's
// own repo (e.g. cobdfamily/ca.cobd.apps at packages/springboard). Point the
// generator at one with `--root`; the legacy in-package `apps/<app>` mode is
// kept for back-compat.
//
// Usage:
//   node bin/gen.mjs --root <springboard-dir> [--platforms android,ios] [--name <label>] [--out <dir>] [--dry-run]
//   node bin/gen.mjs --list                                  (legacy in-package apps/)
//   node bin/gen.mjs <app> [--platforms android,ios] [--dry-run]   (legacy)
//   node bin/gen.mjs --all [--dry-run]                       (legacy)

import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadAsset, renderApp, STATIC_ASSETS } from "../src/clam.mjs";

import {
  absolutizeAsset, addKnownRegions, appDomains, appsOrigin,
  collectPermissions, planSteps, readJson, renderCapacitorConfig,
  renderProjectPackageJson, renderSwsConfig, renderSwsDockerfile,
  tilesForGrid, validateApps, validateBrand, validateConfig, validateMenu, validateSeo,
} from "../src/lib.mjs";

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => process.stdout.write(`▸ ${m}\n`);
const sh = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit" });

function loadConfig() {
  return validateConfig(readJson(join(PKG_DIR, "generator.config.json")));
}

function listApps(config) {
  const dir = join(PKG_DIR, config.appsDir);
  return readdirSync(dir).filter((n) => {
    try { return statSync(join(dir, n)).isDirectory() && existsSync(join(dir, n, "brand.json")); }
    catch { return false; }
  });
}

// Read + validate one app's inputs from a springboard directory (the dir that
// holds brand.json / menu.json / apps.json / icon.png / assets). Used for both
// `--root <dir>` (the app's own repo) and the legacy in-package `apps/<app>`.
function loadAppDir(dir, label) {
  if (!existsSync(join(dir, "brand.json"))) {
    throw new Error(`no brand.json in ${dir} — point --root at an app springboard (e.g. packages/springboard)`);
  }
  const rawBrand = readJson(join(dir, "brand.json"));
  const brand = validateBrand(rawBrand, label);
  const menu = validateMenu(readJson(join(dir, "menu.json")), label); // throws if bad
  const seo = validateSeo(rawBrand.seo, label); // seo lives in brand.json now
  const apps = validateApps(readJson(join(dir, "apps.json")), label); // launcher tiles; throws if bad
  if (!existsSync(join(dir, "icon.png"))) {
    log(`WARNING: ${join(dir, "icon.png")} missing — @capacitor/assets will fail until you add a ≥1024px icon`);
  }
  return { brand, menu, seo, apps };
}

function generate(config, { app, dir, outBase, platforms, dryRun, webOnly }) {
  const { brand, menu, seo, apps } = loadAppDir(dir, app);
  const plan = planSteps({ config, app, brand });

  log(`app "${app}"  →  ${brand.appName} (${brand.appId})  [${webOnly ? "web-only" : platforms.join(", ")}]`);
  plan.forEach((s, i) => log(`  ${i + 1}. ${s.desc}`));
  if (dryRun) { log("dry-run: nothing executed"); return; }

  if (!config.cdnManifest) {
    throw new Error(
      "no cdnManifest configured. Set generator.config.json > cdnManifest to the clf CDN manifest (run `npm run sync-cdn` to generate shared/cdn.json).",
    );
  }
  // clf-core CDN manifest (sync-cdn output). It carries every shell
  // asset including <cobd-apps-grid> (appsGridJs) — a clf-core element
  // shipped as a standalone CDN component, loaded from its own URL
  // (it's deliberately not in the components/index.js bundle), SW-cached
  // for offline like the rest of the CDN runtime.
  const cdn = readJson(join(PKG_DIR, config.cdnManifest));

  // The shared web base is optional: the clam shell is now self-
  // contained (it loads the CLF runtime from the CDN; the launcher
  // grid is its home). When base IS configured, its dist is laid down
  // first and the generated index.html overwrites any the base shipped.
  const hasBase = Boolean(config.base?.buildCommand && config.base?.distDir);

  const out = join(outBase, config.outDir, app);
  const www = join(out, "www");

  // 1. clean  2. (optional) build base web  3. assemble webDir
  rmSync(out, { recursive: true, force: true });
  mkdirSync(www, { recursive: true });
  if (hasBase) {
    sh("npm", ["run", "build", "-w", config.base.package], resolve(PKG_DIR, "..", ".."));
    cpSync(resolve(PKG_DIR, config.base.distDir), www, { recursive: true });
  } else {
    log("no shared web base configured — emitting the clam shell only (index.html + brand/menu)");
  }
  cpSync(join(dir, "menu.json"), join(www, "menu.json"));
  // Compile the authoring tiles (label/target/icon_url, + beta_target which
  // we drop) into the runtime shape <cobd-apps-grid> fetches (label/href/iconUrl).
  writeFileSync(join(www, "apps.json"), JSON.stringify({ apps: tilesForGrid(apps) }, null, 2) + "\n");
  writeFileSync(join(www, "brand.json"), JSON.stringify(brand) + "\n");
  // Per-app static assets (icons, logo, og image) -> webDir/assets/,
  // so branding is self-hosted (served from apps.<domain>, SW-cached).
  const assetsDir = join(dir, "assets");
  if (existsSync(assetsDir)) cpSync(assetsDir, join(www, "assets"), { recursive: true });

  // og:image + the JSON-LD logo must be absolute for external crawlers,
  // so resolve relative asset paths against apps.<domain>; in-app refs
  // (grid icons) stay relative.
  const origin = appsOrigin(appDomains(brand));
  const seoForRender = {
    ...seo,
    image: absolutizeAsset(seo.image, origin),
    org: seo.org
      ? { ...seo.org, logoUrl: absolutizeAsset(seo.org.logoUrl, origin) }
      : seo.org,
  };
  // Render the clam umbrella-shell index.html from this app's brand +
  // menu + seo + the CDN manifest. The grid fetches its tiles from the
  // copied apps.json (renderApp's default apps.path). Overwrites any
  // index.html the base dist shipped: the shell is the entry point.
  writeFileSync(join(www, "index.html"), renderApp({ brand, menu, seo: seoForRender, cdn }));
  // Offline support: the service worker, its registration script, and
  // the offline fallback page, served from the webDir root.
  for (const name of STATIC_ASSETS) writeFileSync(join(www, name), loadAsset(name));

  // Per-app static-web-server image context (one image per app): the
  // Dockerfile + sws.toml sit beside www/ so the build context is `out`.
  //   docker build -t cobdfamily/clam-<appId-with-dashes> <out>
  writeFileSync(join(out, "Dockerfile"), renderSwsDockerfile(brand));
  writeFileSync(join(out, "sws.toml"), renderSwsConfig());
  log(`emitted per-app sws image context -> ${out} (docker build -t cobdfamily/clam-${brand.appId.replace(/\./g, "-")} ${out})`);

  // --web-only: the sws image needs only www/ + Dockerfile + sws.toml
  // (all emitted above). Stop before the native Capacitor scaffold so a
  // web/image build needs no npm install, platforms, or Android/iOS SDKs.
  if (webOnly) { log(`web-only: ${out} ready for docker build (skipped native scaffold)`); return; }

  // 4. scaffold ephemeral project
  writeFileSync(join(out, "package.json"), renderProjectPackageJson(brand, config));
  writeFileSync(join(out, "capacitor.config.ts"), renderCapacitorConfig(brand));

  // 5. install  6. add platforms  7. native overlay  8. assets  9. sync
  sh("npm", ["install"], out);
  for (const p of platforms) sh("npx", ["cap", "add", p], out);
  applyPermissions(brand, out, platforms);
  applyAppBoundDomains(brand, out, platforms);
  sh("npx", ["capacitor-assets", "generate", "--assetPath", join(dir, "icon.png")], out);
  sh("npx", ["cap", "sync"], out);

  log(`done: ${out} is ready to build + sign (see templates/)`);
}

// Write WKAppBoundDomains into the iOS Info.plist from the app's
// allowed base domains. App-bound domains (+ the capacitor.config
// limitsNavigationsToAppBoundDomains that renderCapacitorConfig sets)
// is what enables service workers in WKWebView and confines the
// WebView to these domains + their subdomains. Subresources from other
// origins (e.g. the clf CDN) still load — only navigations are gated.
function applyAppBoundDomains(brand, out, platforms) {
  const domains = appDomains(brand);
  if (!platforms.includes("ios") || domains.length === 0) return;
  const plist = join(out, "ios", "App", "App", "Info.plist");
  // Rebuild the array idempotently: drop any existing, recreate, fill.
  try { sh("/usr/libexec/PlistBuddy", ["-c", "Delete :WKAppBoundDomains", plist]); }
  catch { /* not present yet */ }
  sh("/usr/libexec/PlistBuddy", ["-c", "Add :WKAppBoundDomains array", plist]);
  domains.forEach((d, i) => {
    sh("/usr/libexec/PlistBuddy", ["-c", `Add :WKAppBoundDomains:${i} string ${d}`, plist]);
  });
  log(`set WKAppBoundDomains = [${domains.join(", ")}]`);
}

const PERM_LOCALES_FALLBACK = ["en"];

/**
 * clf-core's localized perm.* strings, IF @cobdfamily/clf-core is
 * installed (it's published, but not a hard dep here). Returns
 * { strings: { "perm.camera": { en, fr } }, locales } or null — in
 * which case the cobdcorekit English fallbacks are used.
 */
function loadPermStrings() {
  const candidates = [
    resolve(PKG_DIR, "..", "..", "node_modules", "@cobdfamily", "clf-core", "dist", "i18n", "chrome.json"),
    resolve(PKG_DIR, "node_modules", "@cobdfamily", "clf-core", "dist", "i18n", "chrome.json"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const chrome = JSON.parse(readFileSync(p, "utf8"));
      const locales = Array.isArray(chrome.locales) && chrome.locales.length
        ? chrome.locales : PERM_LOCALES_FALLBACK;
      const strings = {};
      for (const s of chrome.strings ?? []) {
        if (!String(s.id).startsWith("perm.")) continue;
        const byLocale = {};
        for (const loc of locales) if (typeof s[loc] === "string") byLocale[loc] = s[loc];
        strings[s.id] = byLocale;
      }
      return { strings, locales };
    } catch { /* unreadable -- fall through to fallbacks */ }
  }
  return null;
}

function describePerm(perm, strings, locale) {
  return strings?.[perm.stringKey]?.[locale]
    ?? strings?.[perm.stringKey]?.en
    ?? perm.fallback;
}

const escapeStringsValue = (s) =>
  String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/**
 * Emit native permissions for the app's declared capabilities
 * (brand.json `extra.capabilities`): iOS Info.plist usage strings +
 * localized <locale>.lproj/InfoPlist.strings, and Android
 * <uses-permission> lines. Sourced from @cobdfamily/cobdcorekit's
 * capability→key map and clf-core's localized strings (English
 * fallback when clf-core isn't installed). Replaces the old static
 * shared/overlay.json block.
 */
function applyPermissions(brand, out, platforms) {
  const capabilities = brand.extra?.capabilities ?? [];
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    log("no extra.capabilities declared — skipping native permissions");
    return;
  }
  const { ios, android } = collectPermissions(capabilities);
  const clf = loadPermStrings();
  const locales = clf?.locales ?? PERM_LOCALES_FALLBACK;
  const strings = clf?.strings;

  if (platforms.includes("ios") && Object.keys(ios).length) {
    const appDir = join(out, "ios", "App", "App");
    const plist = join(appDir, "Info.plist");
    // Default-locale usage strings into Info.plist (PlistBuddy is
    // macOS-only; Add, else Set if the key already exists).
    for (const [key, perm] of Object.entries(ios)) {
      const v = describePerm(perm, strings, locales[0]);
      try { sh("/usr/libexec/PlistBuddy", ["-c", `Add :${key} string ${v}`, plist]); }
      catch { sh("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${v}`, plist]); }
    }
    // Localized InfoPlist.strings per locale.
    for (const loc of locales) {
      const lines = Object.entries(ios).map(([key, perm]) =>
        `"${key}" = "${escapeStringsValue(describePerm(perm, strings, loc))}";`);
      const dir = join(appDir, `${loc}.lproj`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "InfoPlist.strings"), lines.join("\n") + "\n");
    }
    log(`applied ${Object.keys(ios).length} iOS usage string(s) across ${locales.length} locale(s)`);
    if (!clf) log("  (clf-core not installed — used English fallbacks; add @cobdfamily/clf-core for localized strings)");
    // Register the locales in the Xcode project so iOS actually loads
    // the .lproj/InfoPlist.strings we just wrote (ignored otherwise).
    const pbxproj = join(out, "ios", "App", "App.xcodeproj", "project.pbxproj");
    if (locales.length > 1 && existsSync(pbxproj)) {
      writeFileSync(pbxproj, addKnownRegions(readFileSync(pbxproj, "utf8"), locales));
      log(`registered ${locales.length} locale(s) in project.pbxproj knownRegions`);
    }
  }

  if (platforms.includes("android") && android.length) {
    const manifest = join(out, "android", "app", "src", "main", "AndroidManifest.xml");
    injectAndroidPermissions(manifest, android);
    log(`applied ${android.length} Android permission(s)`);
  }
}

function injectAndroidPermissions(manifestPath, permissions) {
  // Insert <uses-permission> lines after the opening <manifest ...> tag if absent.
  let xml = readFileSync(manifestPath, "utf8");
  const lines = permissions
    .filter((p) => !xml.includes(`android:name="${p}"`))
    .map((p) => `    <uses-permission android:name="${p}" />`);
  if (lines.length === 0) return;
  xml = xml.replace(/(<manifest\b[^>]*>)/, `$1\n${lines.join("\n")}`);
  writeFileSync(manifestPath, xml);
}

// ---- CLI ----
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: "string" },       // springboard dir (an app's own repo)
    out: { type: "string" },        // output base (default: the springboard dir, or PKG_DIR for legacy)
    name: { type: "string" },       // output-subdir label (default: brand.appId)
    platforms: { type: "string" },
    "web-only": { type: "boolean", default: false },  // emit sws image context only; skip native scaffold
    "dry-run": { type: "boolean", default: false },
    all: { type: "boolean", default: false },
    list: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  process.stdout.write(`clam-app-generator
  --root <dir>           generate from an app springboard (its brand/menu/apps/icon)
  --name <label>         output subdir under <out>/.generated (default: brand.appId)
  --out <dir>            output base (default: the --root dir)
  --platforms a,b        override platforms (default from generator.config.json)
  --web-only             emit only the static-web-server image context (www + Dockerfile + sws.toml); skip the native build
  --dry-run              plan only, run nothing
  legacy (in-package apps/): --list | <app> | --all
`);
  process.exit(0);
}

const config = loadConfig();
const platforms = values.platforms ? values.platforms.split(",").map((s) => s.trim()) : config.platforms;

// Springboard mode: one app, read from --root <dir> (the app's own repo).
if (values.root) {
  const dir = resolve(values.root);
  const label = values.name
    ?? (existsSync(join(dir, "brand.json")) ? readJson(join(dir, "brand.json")).appId : null)
    ?? basename(dir);
  const outBase = values.out ? resolve(values.out) : dir;
  try {
    generate(config, { app: label, dir, outBase, platforms, dryRun: values["dry-run"], webOnly: values["web-only"] });
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
  process.exit(0);
}

// Legacy in-package apps/<app> mode.
if (values.list) {
  for (const a of listApps(config)) log(a);
  process.exit(0);
}

const apps = values.all ? listApps(config) : positionals;
if (apps.length === 0) {
  process.stderr.write("error: use --root <springboard>, or name an app / --all / --list\n");
  process.exit(1);
}
try {
  for (const app of apps) {
    generate(config, {
      app, dir: join(PKG_DIR, config.appsDir, app), outBase: PKG_DIR,
      platforms, dryRun: values["dry-run"], webOnly: values["web-only"],
    });
  }
} catch (err) {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
