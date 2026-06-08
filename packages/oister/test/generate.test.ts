// Tests for the oister generator. Run via tsx (see package.json),
// which executes the TypeScript src directly -- the bundled
// template resolves to src/assets/index.html.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
    renderApp,
    renderOisterShell,
    appToConfig,
    validateOisterConfig,
} from "../src/index.js";
import type {
    AppInput, Brand, Menu, OisterConfig, Seo,
} from "../src/index.js";

function loadJson<T>(name: string): T {
    const path = fileURLToPath(new URL(`../${name}`, import.meta.url));
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

const exampleConfig = (): OisterConfig =>
    loadJson<OisterConfig>("oister.example.json");
const exampleSeo = (): Seo => loadJson<Seo>("seo.example.json");

const BRAND: Brand = {
    appId: "ca.cobd.apps.core",
    appName: "COBD",
    extra: { themeColor: "#31d53d" },
};
const MENU: Menu = {
    items: [
        { label: "Home", target: "/welcome" },
        { label: "Map", target: "/map" },
    ],
};

function exampleAppInput(overrides: Partial<AppInput> = {}): AppInput {
    return {
        brand: BRAND,
        menu: MENU,
        seo: exampleSeo(),
        cdn: exampleConfig().cdn,
        ...overrides,
    };
}

// ---- renderOisterShell (the resolved-config core) ------------

test("renders the example config into a complete page", () => {
    const html = renderOisterShell(exampleConfig());
    assert.match(html, /^<!DOCTYPE html>/);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /content="COBD"/);           // og:site_name
    assert.match(html, /<title>COBD<\/title>/);
    assert.match(html,
        /src="https:\/\/cdn\.blindhub\.ca\/clf-core\/components\/index\.js"/);
});

test("nav items render as a local <ul slot=\"menu\"> + the noscript list", () => {
    const html = renderOisterShell(exampleConfig());
    assert.match(html, /<ul slot="menu">/);
    assert.match(html, /<a href="\/welcome">Home<\/a>/);
    assert.match(html, /<a href="\/about">About<\/a>/);
    // No leftover slug-driven attributes.
    assert.doesNotMatch(html, /nav-path=/);
    assert.doesNotMatch(html, /more-path=/);
});

test("leaves no unsubstituted handlebars tokens", () => {
    const html = renderOisterShell(exampleConfig());
    assert.doesNotMatch(html, /\{\{/, "found an unrendered {{ token");
});

test("the iframe gets a src from app.url, and none when unset", () => {
    const withUrl = renderOisterShell(exampleConfig());
    assert.match(withUrl, /<iframe name="app" src="https:\/\/cobd\.ca\/">/);
    const config = exampleConfig();
    config.app = { url: "" };
    const noUrl = renderOisterShell(config);
    assert.match(noUrl, /<iframe name="app"><\/iframe>/);
});

test("integrity attributes are emitted raw, not HTML-escaped", () => {
    const html = renderOisterShell(exampleConfig());
    assert.match(html,
        /integrity="sha384-EXAMPLE" crossorigin="anonymous"/);
    assert.doesNotMatch(html, /&quot;/);
});

test("JSON-LD stays valid even when a value contains quotes", () => {
    const config = exampleConfig();
    config.site.author = 'A&B "Quoted" Co.';
    const html = renderOisterShell(config);
    const block = html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(block, "JSON-LD block present");
    const parsed = JSON.parse(block![1]);
    assert.equal(parsed.name, 'A&B "Quoted" Co.');
    assert.equal(parsed["@type"], "Organization");
});

test("validateOisterConfig throws on a missing required field", () => {
    const config = exampleConfig();
    // @ts-expect-error -- deliberately violating the type.
    delete config.site.title;
    assert.throws(() => validateOisterConfig(config),
        /site\.title is required/);
});

test("validateOisterConfig throws on a missing CDN url", () => {
    const config = exampleConfig();
    // @ts-expect-error -- deliberately blanking a required asset.
    config.cdn.componentsJs = {};
    assert.throws(() => renderOisterShell(config),
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
    const seo: Seo = {
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

test("appToConfig reads the iframe app url from brand.extra.appUrl", () => {
    const brand: Brand = {
        appId: "ca.cobd.x",
        appName: "X",
        extra: { appUrl: "https://app.example/" },
    };
    const config = appToConfig(exampleAppInput({ brand }));
    assert.equal(config.app.url, "https://app.example/");
    // absent -> empty string (iframe renders with no src)
    const bare = appToConfig(exampleAppInput({
        brand: { appId: "ca.cobd.y", appName: "Y" },
    }));
    assert.equal(bare.app.url, "");
});

test("appToConfig accepts a bare-array menu", () => {
    const config = appToConfig(exampleAppInput({
        menu: [{ label: "Only", target: "/only" }],
    }));
    assert.deepEqual(config.nav.items, [{ label: "Only", href: "/only" }]);
});

test("renderApp throws on a brand without appName", () => {
    // @ts-expect-error -- deliberately omitting appName.
    const brand: Brand = { appId: "ca.cobd.x" };
    assert.throws(() => renderApp(exampleAppInput({ brand })),
        /brand\.json: appName is required/);
});

test("renderApp throws on a menu item missing a target", () => {
    const menu = { items: [{ label: "Broken" }] } as unknown as Menu;
    assert.throws(() => renderApp(exampleAppInput({ menu })),
        /menu\.json: every item needs a label and a target/);
});
