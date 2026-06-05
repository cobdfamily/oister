import test from "node:test";
import assert from "node:assert/strict";

import { createDirectTransport } from "../src/transport.ts";
import { installTorch } from "../src/torch.ts";
import type { LocalBroker } from "../src/types.ts";

test("torch round-trips through a direct (in-process) transport", async () => {
  let torchState = false;
  const broker: LocalBroker = {
    async invoke(capability, method) {
      assert.equal(capability, "torch");
      if (method === "on") torchState = true;
      else if (method === "off") torchState = false;
      else if (method === "toggle") torchState = !torchState;
      return torchState;
    },
  };

  const torch = installTorch(createDirectTransport(broker));

  assert.equal(torch.isOn, false);
  assert.equal(await torch.on(), true);
  assert.equal(torch.isOn, true);
  assert.equal(await torch.toggle(), false);
  assert.equal(await torch.off(), false);
});

test("torch.flash() calls the host and the isOn mirror tracks the host's state events", async () => {
  const seen: string[] = [];
  const broker: LocalBroker = {
    async invoke(_capability, method, _options, emit) {
      seen.push(method);
      if (method === "flash") {
        emit("state", { isOn: true });
        emit("state", { isOn: false });
        return false;
      }
      return null;
    },
  };

  const torch = installTorch(createDirectTransport(broker));
  await torch.flash();

  assert.ok(seen.includes("flash"));
  assert.equal(torch.isOn, false); // ended off, per the host's final state event
});

test("direct transport routes emitted events to onEvent subscribers", async () => {
  const broker: LocalBroker = {
    async invoke(_capability, method, _options, emit) {
      if (method === "watch") {
        emit("tick", { n: 1 });
        emit("tick", { n: 2 });
      }
      return "ok";
    },
  };

  const transport = createDirectTransport(broker);
  const got: unknown[] = [];
  transport.onEvent("geo", "tick", (p) => got.push(p));

  const result = await transport.call("geo", "watch", {});
  assert.equal(result, "ok");
  assert.deepEqual(got, [{ n: 1 }, { n: 2 }]);
});

test("direct transport rejects when the broker throws", async () => {
  const broker: LocalBroker = {
    async invoke() {
      throw new Error("boom");
    },
  };
  await assert.rejects(() => createDirectTransport(broker).call("x", "y"), /boom/);
});
