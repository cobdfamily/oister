// Tests for the pure resume helpers (no DOM needed). The element
// itself is DOM-bound and exercised in a browser; the URL/storage-key
// logic that's worth asserting lives in resume.ts.

import test from "node:test";
import assert from "node:assert/strict";

import { appKey, restOfUrl, resumeUrl, KEY_PREFIX } from "../src/resume.js";

test("appKey derives app:<hostname> from an absolute URL", () => {
    assert.equal(
        appKey("https://ferry.cobd.ca/schedule?d=1#x"),
        "app:ferry.cobd.ca");
    assert.equal(KEY_PREFIX, "app:");
});

test("appKey resolves a relative href against a base", () => {
    assert.equal(
        appKey("/welcome", "https://ferry.cobd.ca/"),
        "app:ferry.cobd.ca");
    // No base + relative href is unresolvable -> null.
    assert.equal(appKey("/welcome"), null);
});

test("restOfUrl keeps path + query + hash, drops the origin", () => {
    assert.equal(
        restOfUrl("https://ferry.cobd.ca/schedule?day=2#top"),
        "/schedule?day=2#top");
    assert.equal(restOfUrl("https://ferry.cobd.ca"), "/");
    assert.equal(restOfUrl("not a url"), null);
});

test("resumeUrl rebuilds the full URL from the app href + stored rest", () => {
    assert.equal(
        resumeUrl("https://ferry.cobd.ca/", "/schedule?day=2#top"),
        "https://ferry.cobd.ca/schedule?day=2#top");
    // Origin/scheme come from the app's href, not the stored rest.
    assert.equal(
        resumeUrl("https://ferry.cobd.ca/home", "/deep/link"),
        "https://ferry.cobd.ca/deep/link");
});

test("round-trip: record then resume lands on the original URL", () => {
    const from = "https://lift.cobd.ca/trip/42?seat=4#map";
    const key = appKey(from);
    const rest = restOfUrl(from);
    assert.equal(key, "app:lift.cobd.ca");
    // The app's home href shares the host; resume reconstructs `from`.
    assert.equal(resumeUrl("https://lift.cobd.ca/", rest as string), from);
});
