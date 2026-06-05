import test from "node:test";
import assert from "node:assert/strict";

import { createTransport } from "../src/transport.ts";
import { installTorch } from "../src/torch.ts";

/** Mimic Window.postMessage: calling w.postMessage(data) fires "message" on w itself. */
function attachPostMessage(w: EventTarget, origin: string) {
  (w as unknown as { postMessage: (d: unknown) => void }).postMessage = (data) => {
    const ev = new Event("message") as Event & { data: unknown; origin: string };
    ev.data = data;
    ev.origin = origin;
    w.dispatchEvent(ev);
  };
}

test("torch round-trips through the postMessage transport", async () => {
  const ORIGIN = "https://host.cobd.ca";
  const child = new EventTarget();
  const host = new EventTarget();

  attachPostMessage(child, ORIGIN);
  attachPostMessage(host, ORIGIN);
  (child as unknown as { parent: EventTarget }).parent = host;
  (globalThis as unknown as { window: EventTarget }).window = child;

  // minimal host broker
  let torchState = false;
  host.addEventListener("message", (e) => {
    const m = (e as MessageEvent).data as {
      __COBDCoreKit?: boolean;
      kind?: string;
      capability?: string;
      method?: string;
      id?: number;
    };
    if (!m?.__COBDCoreKit || m.kind !== "call" || m.capability !== "torch") return;
    if (m.method === "on") torchState = true;
    else if (m.method === "off") torchState = false;
    else if (m.method === "toggle") torchState = !torchState;
    // reply to the child (real brokers use e.source.postMessage)
    (child as unknown as { postMessage: (d: unknown) => void }).postMessage({
      __COBDCoreKit: true,
      kind: "result",
      id: m.id,
      value: torchState,
    });
  });

  const transport = createTransport({ hostOrigin: ORIGIN, target: host as unknown as Window });
  const torch = installTorch(transport);

  assert.equal(torch.isOn, false);
  assert.equal(await torch.on(), true);
  assert.equal(torch.isOn, true);
  assert.equal(await torch.toggle(), false);
  assert.equal(await torch.toggle(), true);
  assert.equal(await torch.off(), false);
  assert.equal(torch.isOn, false);
});
