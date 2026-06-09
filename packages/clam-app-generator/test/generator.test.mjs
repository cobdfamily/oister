import test from "node:test";
import assert from "node:assert/strict";

import { renderApp } from "../src/clam.mjs";

import {
  absolutizeAsset, addKnownRegions, allowNavigation, appDomains, appsOrigin,
  cdnUrlsFromManifest, collectPermissions, planSteps,
  renderCapacitorConfig, renderProjectPackageJson, renderSwsConfig,
  renderSwsDockerfile, tilesForGrid, validateApps, validateBrand, validateConfig,
  validateMenu, validateSeo,
} from "../src/lib.mjs";

test("validateBrand accepts a reverse-DNS appId and requires appName", () => {
  const b = validateBrand({ appId: "ca.cobd.app.alpha", appName: "Alpha" }, "alpha");
  assert.equal(b.appId, "ca.cobd.app.alpha");
  assert.equal(b.appName, "Alpha");
  assert.throws(() => validateBrand({ appId: "nope", appName: "X" }, "x"), /reverse-DNS/);
  assert.throws(() => validateBrand({ appId: "ca.cobd.x" }, "x"), /appName/);
});

test("validateMenu accepts array or { items } and requires label+target", () => {
  assert.equal(validateMenu([{ label: "Home", target: "/" }]).length, 1);
  assert.equal(validateMenu({ items: [{ label: "A", target: "/a" }] }).length, 1);
  assert.throws(() => validateMenu([{ label: "no target" }]), /target/);
  assert.throws(() => validateMenu("nope"), /expected an array/);
});

test("validateSeo requires description, url and image", () => {
  const seo = { description: "d", url: "https://x/", image: "https://x/og.png" };
  assert.equal(validateSeo(seo, "x"), seo);
  assert.throws(() => validateSeo({ url: "https://x/", image: "i" }, "x"), /"description" is required/);
  assert.throws(() => validateSeo({ description: "d", image: "i" }, "x"), /"url" is required/);
  assert.throws(() => validateSeo("nope", "x"), /not an object/);
});

test("renderApp turns brand + menu + seo + cdn into the shell index.html", () => {
  // The assemble-web wiring: the exact data path bin/gen.mjs feeds
  // into @cobdfamily/clam to produce www/index.html.
  const brand = validateBrand({ appId: "ca.cobd.app.alpha", appName: "Alpha", extra: { themeColor: "#abcdef" } }, "alpha");
  const menu = validateMenu({ items: [{ label: "Home", target: "/welcome" }] }, "alpha");
  const seo = validateSeo({ description: "d", url: "https://x/", image: "https://x/og.png" }, "alpha");
  const cdn = {
    tokensCss: { url: "https://cdn.blindhub.ca/clf-assets/tokens.css" },
    printCss: { url: "https://cdn.blindhub.ca/clf-assets/print.css" },
    chromeCss: { url: "https://cdn.blindhub.ca/clf-assets/chrome.css" },
    ionicCss: { url: "https://cdn.blindhub.ca/ionic/8/ionic.bundle.css" },
    ionicEsm: { url: "https://cdn.blindhub.ca/ionic/8/ionic.esm.js" },
    ioniconsEsm: { url: "https://cdn.blindhub.ca/ionicons/8/ionicons.esm.js" },
    fontScalePaintJs: { url: "https://cdn.blindhub.ca/clf-assets/font-scale-paint.js" },
    componentsJs: { url: "https://cdn.blindhub.ca/clf-core/components/index.js" },
  };
  const html = renderApp({ brand, menu, seo, cdn });
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<title>Alpha<\/title>/);            // brand.appName
  assert.match(html, /content="#abcdef"/);                // brand.extra.themeColor
  assert.match(html, /<a href="\/welcome">Home<\/a>/);    // menu.target -> href
  assert.doesNotMatch(html, /\{\{/);
});

test("cdnUrlsFromManifest builds asset URLs from the manifest version paths", () => {
  const manifest = {
    components: {
      clfCommon: { path: "clf-core/7.1.0/" },
      clfFactoryChrome: { path: "clf-assets/cf0.1.39/" },
      ionic: { path: "ionic/8.8.8/" },
      ionicons: { path: "ionicons/8.0.13/" },
    },
  };
  const urls = cdnUrlsFromManifest(manifest, "https://cdn.blindhub.ca/");
  assert.equal(urls.tokensCss.url, "https://cdn.blindhub.ca/clf-core/7.1.0/tokens.css");
  assert.equal(urls.componentsJs.url, "https://cdn.blindhub.ca/clf-core/7.1.0/components/index.js");
  assert.equal(urls.fontScalePaintJs.url, "https://cdn.blindhub.ca/clf-core/7.1.0/theming/font-scale-paint.js");
  assert.equal(urls.chromeCss.url, "https://cdn.blindhub.ca/clf-assets/cf0.1.39/chrome.css");
  assert.equal(urls.ioniconsEsm.url, "https://cdn.blindhub.ca/ionicons/8.0.13/ionicons.esm.js");
  assert.throws(() => cdnUrlsFromManifest({ components: {} }, "https://x"), /missing component "clfCommon"/);
  assert.throws(() => cdnUrlsFromManifest(manifest, ""), /base url required/);
});

test("collectPermissions maps capabilities to iOS keys + Android perms", () => {
  const { ios, android } = collectPermissions(["camera", "location", "notifications", "bogus"]);
  // iOS usage keys (notifications has none).
  assert.deepEqual(Object.keys(ios).sort(), [
    "NSCameraUsageDescription",
    "NSLocationWhenInUseUsageDescription",
  ]);
  assert.equal(ios.NSCameraUsageDescription.stringKey, "perm.camera");
  assert.ok(ios.NSCameraUsageDescription.fallback.length > 0);
  // Android perms (deduped union; notifications contributes POST_NOTIFICATIONS).
  assert.ok(android.includes("android.permission.CAMERA"));
  assert.ok(android.includes("android.permission.ACCESS_FINE_LOCATION"));
  assert.ok(android.includes("android.permission.POST_NOTIFICATIONS"));
  // Unknown capability is skipped.
  assert.ok(!android.includes(undefined));
});

test("collectPermissions on an empty/absent list yields nothing", () => {
  assert.deepEqual(collectPermissions([]), { ios: {}, android: [] });
  assert.deepEqual(collectPermissions(undefined), { ios: {}, android: [] });
});

test("addKnownRegions adds missing locales, dedupes, and is idempotent", () => {
  const pbx = "\t\t\tknownRegions = (\n\t\t\t\ten,\n\t\t\t\tBase,\n\t\t\t);\n";
  const once = addKnownRegions(pbx, ["en", "fr"]);
  assert.match(once, /knownRegions = \(/);
  assert.match(once, /\bfr,/);          // fr added
  assert.equal((once.match(/\ben\b/g) || []).length, 1); // en not duplicated
  assert.match(once, /\bBase,/);        // existing preserved
  // Idempotent: applying the same locales again changes nothing.
  assert.equal(addKnownRegions(once, ["en", "fr"]), once);
});

test("addKnownRegions quotes non-bare region codes and no-ops without a block", () => {
  const pbx = "knownRegions = (\n\t\t\t\ten,\n\t\t\t);";
  assert.match(addKnownRegions(pbx, ["en-GB"]), /"en-GB"/);
  assert.equal(addKnownRegions("no regions here", ["fr"]), "no regions here");
});

test("validateApps accepts array or { apps } and requires label + target", () => {
  assert.equal(validateApps([{ label: "Ferry", target: "https://ferry/" }]).length, 1);
  assert.equal(validateApps({ apps: [{ label: "A", target: "/a" }] }).length, 1);
  assert.throws(() => validateApps([{ label: "no target" }]), /target/);
  assert.throws(() => validateApps([{ target: "/x" }]), /label/);
  assert.throws(() => validateApps("nope"), /expected an array/);
});

test("tilesForGrid maps target->href + image_url->iconUrl, drops beta_target", () => {
  assert.deepEqual(
    tilesForGrid([
      { label: "Ferry", target: "https://ferry/", beta_target: "https://beta/", image_url: "https://ferry/i.png" },
      { label: "Bare", target: "/x" },
    ]),
    [
      { label: "Ferry", href: "https://ferry/", iconUrl: "https://ferry/i.png" },
      { label: "Bare", href: "/x" },
    ]);
});

test("appDomains + allowNavigation read brand.extra and build nav patterns", () => {
  assert.deepEqual(
    appDomains({ extra: { domains: ["BowenCommunity.ca ", "bowencommunity.ca"] } }),
    ["bowencommunity.ca"]); // lowercased, trimmed, deduped
  assert.deepEqual(appDomains({ extra: { domain: "cobd.ca" } }), ["cobd.ca"]);
  assert.deepEqual(appDomains({}), []);
  assert.deepEqual(allowNavigation(["bowencommunity.ca"]),
    ["bowencommunity.ca", "*.bowencommunity.ca"]);
});

test("absolutizeAsset resolves relative paths, passes absolute/empty through", () => {
  const o = "https://apps.bowencommunity.ca";
  assert.equal(absolutizeAsset("assets/logo.svg", o), "https://apps.bowencommunity.ca/assets/logo.svg");
  assert.equal(absolutizeAsset("/assets/og.png", o), "https://apps.bowencommunity.ca/assets/og.png");
  assert.equal(absolutizeAsset("https://cdn.x/og.png", o), "https://cdn.x/og.png"); // absolute untouched
  assert.equal(absolutizeAsset("assets/logo.svg", ""), "assets/logo.svg"); // no origin -> unchanged
  assert.equal(absolutizeAsset("", o), "");
});

test("appsOrigin is apps.<primary domain>", () => {
  assert.equal(appsOrigin(["bowencommunity.ca"]), "https://apps.bowencommunity.ca");
  assert.equal(appsOrigin(["cobd.ca", "blindhub.ca"]), "https://apps.cobd.ca"); // first wins
  assert.equal(appsOrigin([]), "");
});

test("renderCapacitorConfig derives server.url + allowNavigation + app-bound from extra.domains", () => {
  const brand = validateBrand(
    { appId: "ca.cobd.app.alpha", appName: "Alpha", extra: { domains: ["bowencommunity.ca"] } },
    "alpha");
  const cfg = renderCapacitorConfig(brand);
  assert.match(cfg, /url: "https:\/\/apps\.bowencommunity\.ca"/);
  assert.match(cfg, /allowNavigation: \["bowencommunity\.ca","\*\.bowencommunity\.ca"\]/);
  assert.match(cfg, /limitsNavigationsToAppBoundDomains: true/);
  // No domains -> no server/ios blocks (minimal config).
  const bare = renderCapacitorConfig(validateBrand({ appId: "ca.cobd.x", appName: "X" }, "x"));
  assert.doesNotMatch(bare, /server:/);
  assert.doesNotMatch(bare, /limitsNavigationsToAppBoundDomains/);
});

test("renderSwsConfig + renderSwsDockerfile produce a per-app sws image context", () => {
  const cfg = renderSwsConfig();
  assert.match(cfg, /\[general\]/);
  assert.match(cfg, /root = "\/public"/);
  assert.match(cfg, /port = 8080/);

  const brand = validateBrand({ appId: "ca.cobd.app.alpha", appName: "Alpha" }, "alpha");
  const dockerfile = renderSwsDockerfile(brand);
  assert.match(dockerfile, /FROM joseluisq\/static-web-server:2-alpine/);
  assert.match(dockerfile, /COPY www \/public/);
  assert.match(dockerfile, /cobdfamily\/clam-ca-cobd-app-alpha/); // appId dots -> dashes
});

test("validateConfig defaults platforms and rejects unknown ones", () => {
  assert.deepEqual(validateConfig({ capacitorVersion: "8.4.0" }).platforms, ["android", "ios"]);
  assert.throws(() => validateConfig({ capacitorVersion: "8", platforms: ["web"] }), /unknown platform/);
});

test("planSteps states approach D in order and pins the version", () => {
  const config = validateConfig({ capacitorVersion: "8.4.0", outDir: ".generated", base: { buildCommand: "npm run build -w x" } });
  const brand = validateBrand({ appId: "ca.cobd.app.alpha", appName: "Alpha" }, "alpha");
  const steps = planSteps({ config, app: "alpha", brand });
  const ids = steps.map((s) => s.id);
  assert.deepEqual(ids, [
    "clean", "build-web", "assemble-web", "sws-image", "scaffold", "install",
    "cap-add", "overlay-native", "assets", "cap-sync", "build-sign",
  ]);
  assert.match(steps.find((s) => s.id === "scaffold").desc, /pinned 8\.4\.0/);
  assert.match(steps.find((s) => s.id === "scaffold").desc, /ca\.cobd\.app\.alpha/);
});

test("rendered capacitor.config.ts + package.json carry the brand and pin", () => {
  const config = validateConfig({ capacitorVersion: "8.4.0" });
  const brand = validateBrand({ appId: "ca.cobd.app.alpha", appName: "Alpha" }, "alpha");
  const cfg = renderCapacitorConfig(brand);
  assert.match(cfg, /appId: "ca\.cobd\.app\.alpha"/);
  assert.match(cfg, /appName: "Alpha"/);
  const pkg = JSON.parse(renderProjectPackageJson(brand, config));
  assert.equal(pkg.name, "ca-cobd-app-alpha");
  assert.equal(pkg.dependencies["@capacitor/core"], "^8.4.0");
});
