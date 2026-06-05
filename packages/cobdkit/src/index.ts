import { createTransport } from "./transport.js";
import { installGeolocationShim } from "./geolocation.js";
import { installTorch } from "./torch.js";
import type { Cobdkit, TransportOptions } from "./types.js";

export const VERSION = "0.0.0";

/**
 * Install both surfaces into the current iframe:
 *   - overrides `navigator.geolocation` (the mini-app sees a standard API)
 *   - exposes the `cobdkit` global (currently `cobdkit.torch`)
 *
 * Call this as the very first script in the mini-app, before any app code runs.
 */
export function installCobdkit(opts: TransportOptions = {}): Cobdkit {
  const transport = createTransport(opts);

  installGeolocationShim(transport);
  const torch = installTorch(transport);

  const cobdkit: Cobdkit = {
    get version() {
      return VERSION;
    },
    torch,
  };

  (globalThis as { cobdkit?: Cobdkit }).cobdkit = cobdkit;
  return cobdkit;
}

// Auto-install when the host injects this with a config marker on the window.
if (typeof window !== "undefined" && (window as { __COBDKIT_AUTOINSTALL__?: unknown }).__COBDKIT_AUTOINSTALL__) {
  installCobdkit((window as { __COBDKIT_CONFIG__?: TransportOptions }).__COBDKIT_CONFIG__ ?? {});
}

export { createTransport } from "./transport.js";
export { installGeolocationShim } from "./geolocation.js";
export { installTorch } from "./torch.js";
export type {
  Cobdkit,
  TorchAPI,
  Transport,
  TransportOptions,
  CallMessage,
  ResultMessage,
  ErrorMessage,
  EventMessage,
  InboundMessage,
} from "./types.js";
