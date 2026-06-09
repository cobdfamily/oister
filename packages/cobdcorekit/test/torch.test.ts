// torch: on/off/toggle/flash + isOn, with an injected backend (no hardware).

import test from "node:test";
import assert from "node:assert/strict";

import { installTorch } from "../src/torch.js";
import type { TorchBackend } from "../src/types.js";

function fakeBackend() {
    const calls: string[] = [];
    const backend: TorchBackend = {
        on: async () => { calls.push("on"); },
        off: async () => { calls.push("off"); },
        buzz: async () => { calls.push("buzz"); },
    };
    return { backend, calls };
}

test("on/off/toggle track isOn and drive the backend", async () => {
    const { backend, calls } = fakeBackend();
    const torch = installTorch({ backend });

    assert.equal(torch.isOn, false);
    assert.equal(await torch.on(), true);
    assert.equal(torch.isOn, true);
    assert.equal(await torch.toggle(), false);
    assert.equal(await torch.toggle(), true);
    assert.equal(await torch.off(), false);

    assert.deepEqual(calls, ["on", "buzz", "off", "buzz", "on", "buzz", "off", "buzz"]);
});

test("on() is idempotent (no backend call when already on)", async () => {
    const { backend, calls } = fakeBackend();
    const torch = installTorch({ backend });
    await torch.on();
    await torch.on();
    assert.deepEqual(calls, ["on", "buzz"]);
});

test("flash turns on (with buzz) then off (no second buzz)", async () => {
    const { backend, calls } = fakeBackend();
    const torch = installTorch({ backend, flashOnMs: 1 });
    await torch.flash();
    assert.deepEqual(calls, ["on", "buzz", "off"]);
    assert.equal(torch.isOn, false);
});
