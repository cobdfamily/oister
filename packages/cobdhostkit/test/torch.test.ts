import test from "node:test";
import assert from "node:assert/strict";

import { createTorchCapability, type TorchBackend } from "../src/capabilities/torch.ts";
import type { CapabilityContext } from "../src/types.ts";

// A fake native backend + a ctx that records emitted events, so the blink
// sequence is verifiable under plain node (no @capgo/capacitor-flash needed).
function harness() {
  const calls: string[] = [];
  const events: Array<[string, unknown]> = [];
  const backend: TorchBackend = {
    on: async () => { calls.push("on"); },
    off: async () => { calls.push("off"); },
    buzz: async (ms) => { calls.push(`buzz:${ms}`); },
  };
  const ctx: CapabilityContext = { origin: "test", emit: (e, p) => events.push([e, p]) };
  return { calls, events, backend, ctx };
}

test("flash blinks: on + buzz, hold, off — emitting flashing + state", async () => {
  const { calls, events, backend, ctx } = harness();
  const torch = createTorchCapability({ backend, flashOnMs: 1 });

  const result = await torch("flash", {}, ctx);

  assert.equal(result, false);
  assert.deepEqual(calls, ["on", "buzz:150", "off"]);
  assert.deepEqual(events, [
    ["flashing", true],
    ["state", { isOn: true }],
    ["state", { isOn: false }],
    ["flashing", false],
  ]);
});

test("flash respects a custom onMs and the haptics:false option", async () => {
  const { calls, backend, ctx } = harness();
  const torch = createTorchCapability({ backend, haptics: false });
  await torch("flash", { onMs: 1 }, ctx);
  assert.deepEqual(calls, ["on", "off"]); // no buzz when haptics disabled
});

test("on/off/toggle drive the backend and emit state", async () => {
  const { calls, events, backend, ctx } = harness();
  const torch = createTorchCapability({ backend });

  assert.equal(await torch("on", {}, ctx), true);
  assert.equal(await torch("toggle", {}, ctx), false);
  assert.equal(await torch("state", {}, ctx), false);

  assert.deepEqual(calls, ["on", "buzz:150", "off", "buzz:150"]);
  assert.deepEqual(events, [["state", { isOn: true }], ["state", { isOn: false }]]);
});
