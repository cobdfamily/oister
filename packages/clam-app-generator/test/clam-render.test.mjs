// Tests for the clam shell renderer (src/clam.mjs). Ported from the former
// @cobdfamily/clam package when it was folded into the generator. The bundled
// template resolves to src/assets/index.html; fixtures live in test/fixtures/.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  renderApp,
  renderClamShell,
  appToConfig,
  validateClamConfig,
  loadAsset,
  STATIC_ASSETS,
} from "../src/clam.mjs";

function loadJson(name) {
  const path = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8"));
}

const exampleConfig = () => loadJson("clam.example.json");
const exampleSeo = () => loadJson("seo.example.json");

const BRAND = {
  appId: "ca.cobd.apps.core",
  appName: "COBD",
  extra: { themeColor: "#31d53d" },
};
const MENU = {
  items: [
    { label: "Home", target: "/welcome" },
    { label: "Map", target: "/map" },
  ],
};

function exampleAppInput(overrides = {}) {
  return {
    brand: BRAND,
    menu: MENU,
    seo: exampleSeo(),
    cdn: exampleConfig().cdn,
    ...overrides,
  };
}

// ---- renderClamShell (the resolved-config core) ------------

test("renders the example config into a complete page", () => {
  const html = renderClamShell(exampleConfig());
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /content="COBD"/);           // og:site_name
  assert.match(html, /<title>COBD<\/title>/);
  assert.match(html,
    /src="https:\/\/cdn\.blindhub\.ca\/clf-core\/components\/index\.js"/);
});

test("nav items render as a local <ul slot=\"menu\"> + the noscript list", () => {
  const html = renderClamShell(exampleConfig());
  assert.match(html, /<ul slot="menu">/);
  assert.match(html, /<a href="\/welcome">Home<\/a>/);
  assert.match(html, /<a href="\/about">About<\/a>/);
  // No leftover slug-driven attributes.
  assert.doesNotMatch(html, /nav-path=/);
  assert.doesNotMatch(html, /more-path=/);
});

test("leaves no unsubstituted handlebars tokens", () => {
  const html = renderClamShell(exampleConfig());
  assert.doesNotMatch(html, /\{\{/, "found an unrendered {{ token");
});

test("registers the service worker via an external (CSP-safe) script", () => {
  const html = renderClamShell(exampleConfig());
  assert.match(html, /<script src="sw-register\.js"><\/script>/);
  assert.doesNotMatch(html, /navigator\.serviceWorker/); // not inline
});

test("static offline assets are bundled and loadable", () => {
  assert.deepEqual(STATIC_ASSETS, ["sw.js", "sw-register.js", "offline.html"]);
  assert.match(loadAsset("sw.js"), /serviceWorker|caches|fetch/);
  assert.match(loadAsset("sw-register.js"), /serviceWorker\.register\("sw\.js"\)/);
  assert.match(loadAsset("offline.html"), /You're offline/);
});

test("the launcher grid gets its path; its <script> is gated on cdn.appsGridJs", () => {
  const html = renderClamShell(exampleConfig());
  assert.match(html, /<cobd-apps-grid path="apps\.json" remember><\/cobd-apps-grid>/);
  // appsGridJs is present in the example -> the grid script loads.
  assert.match(html, /src="https:\/\/cdn\.blindhub\.ca\/cobd-apps-grid\/index\.js"/);
  // No iframe in the launcher model.
  assert.doesNotMatch(html, /<iframe/);

  // Without appsGridJs, the grid <script> is omitted.
  const config = exampleConfig();
  delete config.cdn.appsGridJs;
  assert.doesNotMatch(renderClamShell(config), /cobd-apps-grid\/index\.js/);
});

test("integrity attributes are emitted raw, not HTML-escaped", () => {
  const html = renderClamShell(exampleConfig());
  assert.match(html, /integrity="sha384-EXAMPLE" crossorigin="anonymous"/);
  assert.doesNotMatch(html, /&quot;/);
});

test("JSON-LD stays valid even when a value contains quotes", () => {
  const config = exampleConfig();
  config.site.author = 'A&B "Quoted" Co.';
  const html = renderClamShell(config);
  const block = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(block, "JSON-LD block present");
  const parsed = JSON.parse(block[1]);
  assert.equal(parsed.name, 'A&B "Quoted" Co.');
  assert.equal(parsed["@type"], "Organization");
});

test("validateClamConfig throws on a missing required field", () => {
  const config = exampleConfig();
  delete config.site.title;
  assert.throws(() => validateClamConfig(config),
    /site\.title is required/);
});

test("validateClamConfig throws on a missing CDN url", () => {
  const config = exampleConfig();
  config.cdn.componentsJs = {};
  assert.throws(() => renderClamShell(config),
    /cdn\.componentsJs\.url is required/);
});

// ---- renderApp / appToConfig (brand + menu + seo + cdn) ------

test("renderApp maps brand + menu + seo into a finished page", () => {
  const html = renderApp(exampleAppInput());
  assert.match(html, /<title>COBD<\/title>/);            // brand.appName
  assert.match(html,
    /content="#31d53d"\s+media="\(prefers-color-scheme: light\)"/);
  assert.match(html, /<a href="\/welcome">Home<\/a>/);   // menu.target -> href
  assert.match(html, /<a href="\/map">Map<\/a>/);
  assert.doesNotMatch(html, /\{\{/);
});

test("appToConfig maps menu targets to hrefs and uses appName as title", () => {
  const config = appToConfig(exampleAppInput());
  assert.equal(config.site.title, "COBD");
  assert.equal(config.page.titleHead, "COBD");
  assert.deepEqual(config.nav.items, [
    { label: "Home", href: "/welcome" },
    { label: "Map", href: "/map" },
  ]);
});

test("appToConfig applies COBD defaults when seo omits fields", () => {
  const seo = {
    description: "d",
    url: "https://x/",
    image: "https://x/og.png",
  };
  const config = appToConfig(exampleAppInput({ seo }));
  assert.equal(config.site.lang, "en");
  assert.equal(config.page.ogType, "website");
  assert.equal(config.site.author, "COBD");          // -> brand.appName
  assert.equal(config.i18n.skipToMain, "Skip to main content");
  assert.equal(config.org.url, "https://x/");        // -> seo.url
  assert.equal(config.org.logoUrl, "https://x/og.png"); // -> seo.image
  assert.equal(config.site.themeColor, "#31d53d");   // -> brand.extra
});

test("appToConfig sets apps.path (default 'apps.json', overridable)", () => {
  assert.equal(appToConfig(exampleAppInput()).apps.path, "apps.json");
  assert.equal(
    appToConfig(exampleAppInput({ appsPath: "/cdn/apps.json" })).apps.path,
    "/cdn/apps.json");
});

test("appToConfig accepts a bare-array menu", () => {
  const config = appToConfig(exampleAppInput({
    menu: [{ label: "Only", target: "/only" }],
  }));
  assert.deepEqual(config.nav.items, [{ label: "Only", href: "/only" }]);
});

test("renderApp throws on a brand without appName", () => {
  const brand = { appId: "ca.cobd.x" };
  assert.throws(() => renderApp(exampleAppInput({ brand })),
    /brand\.json: appName is required/);
});

test("renderApp throws on a menu item missing a target", () => {
  const menu = { items: [{ label: "Broken" }] };
  assert.throws(() => renderApp(exampleAppInput({ menu })),
    /menu\.json: every item needs a label and a target/);
});
