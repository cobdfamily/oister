import type { TorchAPI, Transport } from "./types.js";

/**
 * `COBDCoreKit.torch` — a new API (the web has no torch standard to shim).
 *
 * Each method round-trips to the host, which owns the one physical LED and
 * returns the authoritative resulting state. `isOn` is a locally-cached mirror
 * kept fresh both by those replies and by host-pushed `state` events (e.g. the
 * torch being killed when the mini-app is backgrounded).
 */
export function installTorch(transport: Transport): TorchAPI {
  let isOn = false;

  transport.onEvent("torch", "state", (payload) => {
    isOn = !!(payload as { isOn?: unknown })?.isOn;
  });

  return {
    async on() {
      isOn = !!(await transport.call("torch", "on"));
      return isOn;
    },
    async off() {
      isOn = !!(await transport.call("torch", "off"));
      return isOn;
    },
    async toggle() {
      // Resolve the flip on the host, not from the (possibly stale) mirror.
      isOn = !!(await transport.call("torch", "toggle"));
      return isOn;
    },
    get isOn() {
      return isOn;
    },
  };
}
