import type {
  CallMessage,
  ErrorMessage,
  EventMessage,
  LocalBroker,
  ResultMessage,
} from "@cobdfamily/cobdcorekit";
import type { CapabilityContext, CapabilityHandler, HostBrokerOptions } from "./types.js";

export interface HostBroker {
  /** Register (or replace) a capability handler. */
  register(capability: string, handler: CapabilityHandler): void;
  /** Detach the window message listener (the iframe-facing side). */
  stop(): void;
  /**
   * In-process entry point for a shell-side `cobdcorekit` — pass this as the
   * `broker` option to `installCOBDCoreKit`/`createTransport`. The shell's own code
   * then uses the same cobdcorekit API as a mini-app, with no iframe hop.
   */
  readonly local: LocalBroker;
}

/**
 * The host side of the COBDCoreKit bridge. Lives in the super-app shell and is the
 * single place where origin policy is enforced and native plugins are invoked.
 * It serves two callers off one set of capability handlers:
 *   - mini-app iframes, via a `window` `message` listener (postMessage)
 *   - the shell's own code, via `.local` (in-process)
 */
export function createHostBroker(opts: HostBrokerOptions = {}): HostBroker {
  const allowed = opts.allowedOrigins;
  const handlers = new Map<string, CapabilityHandler>();
  for (const [cap, handler] of Object.entries(opts.capabilities ?? {})) {
    handlers.set(cap, handler);
  }

  function originAllowed(origin: string): boolean {
    if (!allowed || allowed.includes("*")) return true;
    return allowed.includes(origin);
  }

  /** Run a capability handler. Throws on unknown capability. Transport-agnostic. */
  function run(
    capability: string,
    method: string,
    options: unknown,
    ctx: CapabilityContext,
  ): Promise<unknown> | unknown {
    const handler = handlers.get(capability);
    if (!handler) throw new Error(`Unknown capability: ${capability}`);
    return handler(method, options, ctx);
  }

  // --- iframe-facing transport: window message listener ---
  const listener = async (e: MessageEvent): Promise<void> => {
    const msg = e.data as CallMessage | undefined;
    if (!msg || msg.__COBDCoreKit !== true || msg.kind !== "call") return;

    const source = e.source as Window | null;
    if (!source) return;

    const reply = (m: ResultMessage | ErrorMessage): void => {
      source.postMessage(m, e.origin);
    };

    if (!originAllowed(e.origin)) {
      reply({ __COBDCoreKit: true, kind: "error", id: msg.id, error: { code: 1, message: "Origin not allowed" } });
      return;
    }

    const ctx: CapabilityContext = {
      origin: e.origin,
      emit(event, payload) {
        const ev: EventMessage = {
          __COBDCoreKit: true,
          kind: "event",
          capability: msg.capability,
          event,
          payload,
        };
        source.postMessage(ev, e.origin);
      },
    };

    try {
      const value = await run(msg.capability, msg.method, msg.options, ctx);
      reply({ __COBDCoreKit: true, kind: "result", id: msg.id, value });
    } catch (err) {
      reply({
        __COBDCoreKit: true,
        kind: "error",
        id: msg.id,
        error: { message: err instanceof Error ? err.message : String(err) },
      });
    }
  };

  const hasWindow = typeof window !== "undefined";
  if (hasWindow) window.addEventListener("message", listener);

  // --- shell-facing transport: in-process ---
  const local: LocalBroker = {
    async invoke(capability, method, options, emit) {
      const ctx: CapabilityContext = { origin: "local", emit };
      return run(capability, method, options, ctx);
    },
  };

  return {
    register(capability, handler) {
      handlers.set(capability, handler);
    },
    stop() {
      if (hasWindow) window.removeEventListener("message", listener);
    },
    local,
  };
}
