// browser + nav surfaces, with injected functions (no Capacitor, no DOM).

import test from "node:test";
import assert from "node:assert/strict";

import { installBrowser } from "../src/browser.js";
import { installNav } from "../src/nav.js";

test("browser.open forwards the url and rejects an empty one", async () => {
    const opened: string[] = [];
    const browser = installBrowser(async (url) => { opened.push(url); });
    await browser.open("https://cobd.ca/");
    assert.deepEqual(opened, ["https://cobd.ca/"]);
    await assert.rejects(() => browser.open(""), /url required/);
});

test("nav.go navigates via the injected navigator and rejects an empty url", async () => {
    const went: string[] = [];
    const nav = installNav((url) => went.push(url));
    await nav.go("https://forum.blindhub.ca/t/42");
    assert.deepEqual(went, ["https://forum.blindhub.ca/t/42"]);
    await assert.rejects(() => nav.go(""), /url required/);
});
