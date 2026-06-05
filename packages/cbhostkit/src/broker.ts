import type {
  CallMessage,
  ErrorMessage,
  EventMessage,
  ResultMessage,
} from "@cobdfamily/cobdkit";
import type { CapabilityContext, CapabilityHandler, HostBrokerOptions } from "./types.js";

export interface HostBroker {
  /** Register (or replace) a capability handler. */
  register(capability: string, handler: CapabilityHandler): void;
  /** Detach the message listener. */
  stop(): void;
}

/**
 * The host side of the cobdkit bridge. Lives in the super-app shell, listens for
 * `__cobdkit` calls posted by mini-app iframes, dispatches them to capability
 * handlers, and posts the `result`/`error` back to the calling frame.
 *
 * This is the single place where origin policy is enforced and native plugins
 * are actually invoked.
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

  const listener = async (e: MessageEvent): Promise<void> => {
    const msg = e.data as CallMessage | undefined;
    if (!msg || msg.__cobdkit !== true || msg.kind !== "call") return;

    const source = e.source as Window | null;
    if (!source) return;

    const reply = (m: ResultMessage | ErrorMessage): void => {
      source.postMessage(m, e.origin);
    };

    if (!originAllowed(e.origin)) {
      reply({ __cobdkit: true, kind: "error", id: msg.id, error: { code: 1, message: "Origin not allowed" } });
      return;
    }

    const handler = handlers.get(msg.capability);
    if (!handler) {
      reply({ __cobdkit: true, kind: "error", id: msg.id, error: { message: `Unknown capability: ${msg.capability}` } });
      return;
    }

    const ctx: CapabilityContext = {
      origin: e.origin,
      emit(event, payload) {
        const ev: EventMessage = {
          __cobdkit: true,
          kind: "event",
          capability: msg.capability,
          event,
          payload,
        };
        source.postMessage(ev, e.origin);
      },
    };

    try {
      const value = await handler(msg.method, msg.options, ctx);
      reply({ __cobdkit: true, kind: "result", id: msg.id, value });
    } catch (err) {
      reply({
        __cobdkit: true,
        kind: "error",
        id: msg.id,
        error: { message: err instanceof Error ? err.message : String(err) },
      });
    }
  };

  window.addEventListener("message", listener);

  return {
    register(capability, handler) {
      handlers.set(capability, handler);
    },
    stop() {
      window.removeEventListener("message", listener);
    },
  };
}
