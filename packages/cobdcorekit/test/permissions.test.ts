// permissions: the capability -> native key map + getEntitlements.
// Pure module (no Capacitor/DOM), the same data the generator reads.

import test from "node:test";
import assert from "node:assert/strict";

import {
    CAPABILITY_PERMISSIONS,
    capabilityPermission,
    getEntitlements,
} from "../src/permissions.js";

test("the map carries iOS keys, Android perms, a string key and a fallback", () => {
    const cam = CAPABILITY_PERMISSIONS.camera;
    assert.deepEqual(cam.ios, ["NSCameraUsageDescription"]);
    assert.deepEqual(cam.android, ["android.permission.CAMERA"]);
    assert.equal(cam.stringKey, "perm.camera");
    assert.ok(cam.fallback.length > 0);
    assert.equal(capabilityPermission("nope"), undefined);
});

test("notifications/flashlight have no iOS usage string", () => {
    assert.deepEqual(CAPABILITY_PERMISSIONS.notifications.ios, []);
    assert.deepEqual(CAPABILITY_PERMISSIONS.flashlight.ios, []);
});

test("getEntitlements resolves descriptions, skips unknown capabilities", () => {
    const entries = getEntitlements(["camera", "location", "bogus"]);
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map((e) => e.capability), ["camera", "location"]);
    // Falls back to English when no resolver is given.
    assert.equal(entries[0].description, CAPABILITY_PERMISSIONS.camera.fallback);
    assert.deepEqual(entries[0].iosKeys, ["NSCameraUsageDescription"]);
});

test("getEntitlements uses the resolver (e.g. clf-core i18n) when it returns a string", () => {
    const resolve = (key: string) =>
        key === "perm.camera" ? "Pour scanner des codes." : undefined;
    const [cam, loc] = getEntitlements(["camera", "location"], resolve);
    assert.equal(cam.description, "Pour scanner des codes.");        // resolved
    assert.equal(loc.description, CAPABILITY_PERMISSIONS.location.fallback); // fallback
});
