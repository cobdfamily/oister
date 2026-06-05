#!/usr/bin/env node
// cobd-app-generator — regenerate a disposable Capacitor project for one app
// from the shared web base + that app's overlay (brand.json / menu.json /
// icon.png), at the pinned Capacitor version. Approach D.
//
// The shared web base is configured in generator.config.json > base. It is
// currently unset (the cobdappkit package was removed); set it before a real run.
//
// Usage:
//   node bin/gen.mjs --list
//   node bin/gen.mjs <app> [--platforms android,ios] [--dry-run]
//   node bin/gen.mjs --all [--dry-run]

import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  planSteps, readJson, renderCapacitorConfig, renderProjectPackageJson,
  validateBrand, validateConfig, validateMenu,
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

function loadApp(config, app) {
  const dir = join(PKG_DIR, config.appsDir, app);
  if (!existsSync(dir)) throw new Error(`unknown app "${app}" — try --list`);
  const brand = validateBrand(readJson(join(dir, "brand.json")), app);
  validateMenu(readJson(join(dir, "menu.json")), app); // throws if bad
  if (!existsSync(join(dir, "icon.png"))) {
    log(`WARNING: apps/${app}/icon.png missing — @capacitor/assets will fail until you add a ≥1024px icon`);
  }
  return { dir, brand };
}

function generate(config, app, { platforms, dryRun }) {
  const { dir, brand } = loadApp(config, app);
  const plan = planSteps({ config, app, brand });

  log(`app "${app}"  →  ${brand.appName} (${brand.appId})  [${platforms.join(", ")}]`);
  plan.forEach((s, i) => log(`  ${i + 1}. ${s.desc}`));
  if (dryRun) { log("dry-run: nothing executed"); return; }

  if (!config.base?.buildCommand || !config.base?.distDir) {
    throw new Error(
      "no shared web base configured (cobdappkit was removed). Set generator.config.json > base.buildCommand and base.distDir to the web shell before a real run.",
    );
  }

  const out = join(PKG_DIR, config.outDir, app);
  const www = join(out, "www");

  // 1. clean  2. build base web  3. assemble webDir
  rmSync(out, { recursive: true, force: true });
  mkdirSync(www, { recursive: true });
  sh("npm", ["run", "build", "-w", config.base.package], resolve(PKG_DIR, "..", ".."));
  cpSync(resolve(PKG_DIR, config.base.distDir), www, { recursive: true });
  cpSync(join(dir, "menu.json"), join(www, "menu.json"));
  writeFileSync(join(www, "brand.json"), JSON.stringify(brand) + "\n");

  // 4. scaffold ephemeral project
  writeFileSync(join(out, "package.json"), renderProjectPackageJson(brand, config));
  writeFileSync(join(out, "capacitor.config.ts"), renderCapacitorConfig(brand));

  // 5. install  6. add platforms  7. native overlay  8. assets  9. sync
  sh("npm", ["install"], out);
  for (const p of platforms) sh("npx", ["cap", "add", p], out);
  applyNativeOverlay(config, out, platforms);
  sh("npx", ["capacitor-assets", "generate", "--assetPath", join(dir, "icon.png")], out);
  sh("npx", ["cap", "sync"], out);

  log(`done: ${out} is ready to build + sign (see templates/)`);
}

function applyNativeOverlay(config, out, platforms) {
  const overlay = readJson(join(PKG_DIR, config.sharedOverlay));
  if (platforms.includes("ios") && overlay.ios?.infoPlist) {
    const plist = join(out, "ios", "App", "App", "Info.plist");
    for (const [k, v] of Object.entries(overlay.ios.infoPlist)) {
      // PlistBuddy is macOS-only; -c add overwrites if present via Set fallback
      try { sh("/usr/libexec/PlistBuddy", ["-c", `Add :${k} string ${v}`, plist]); }
      catch { sh("/usr/libexec/PlistBuddy", ["-c", `Set :${k} ${v}`, plist]); }
    }
    log(`applied ${Object.keys(overlay.ios.infoPlist).length} iOS Info.plist key(s)`);
  }
  if (platforms.includes("android") && overlay.android?.permissions) {
    const manifest = join(out, "android", "app", "src", "main", "AndroidManifest.xml");
    injectAndroidPermissions(manifest, overlay.android.permissions);
    log(`applied ${overlay.android.permissions.length} Android permission(s)`);
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
    platforms: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    all: { type: "boolean", default: false },
    list: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  process.stdout.write(`cobd-app-generator
  --list                 list available apps
  <app> [--dry-run]      regenerate one app
  --all  [--dry-run]     regenerate every app
  --platforms a,b        override platforms (default from generator.config.json)
`);
  process.exit(0);
}

const config = loadConfig();
const platforms = values.platforms ? values.platforms.split(",").map((s) => s.trim()) : config.platforms;

if (values.list) {
  for (const a of listApps(config)) log(a);
  process.exit(0);
}

const apps = values.all ? listApps(config) : positionals;
if (apps.length === 0) {
  process.stderr.write("error: name an app, or use --all / --list\n");
  process.exit(1);
}
try {
  for (const app of apps) generate(config, app, { platforms, dryRun: values["dry-run"] });
} catch (err) {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
