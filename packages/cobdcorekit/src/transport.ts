import type { InboundMessage, LocalBroker, Transport, TransportOptions } from "./types.js";

/** A capability:event -> handlers registry, shared by both transports. */
function createEventRegistry() {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();

  function dispatch(capability: string, event: string, payload: unknown): void {
    handlers.get(`${capability}:${event}`)?.forEach((h) => h(payload));
  }

  function onEvent(
    capability: string,
    event: string,
    handler: (payload: unknown) => void,
  ): () => void {
    const key = `${capability}:${event}`;
    let set = handlers.get(key);
    if (!set) {
      set = new Set();
      handlers.set(key, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
    };
  }

  return { dispatch, onEvent };
}

/**
 * Transport for code running **inside a mini-app iframe**: requests are
 * postMessaged to the parent shell (where cobdhostkit listens) and replies come
 * back as `message` events.
 */
export function createIframeTransport(opts: { hostOrigin?: string; target?: Window } = {}): Transport {
  const hostOrigin = opts.hostOrigin ?? "*";
  const target: Window = opts.target ?? window.parent;
  const { dispatch, onEvent } = createEventRegistry();

  let seq = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

  window.addEventListener("message", (e: MessageEvent) => {
    if (hostOrigin !== "*" && e.origin !== hostOrigin) return;
    const msg = e.data as InboundMessage | undefined;
    if (!msg || (msg as { __COBDCoreKit?: unknown }).__COBDCoreKit !== true) return;

    if (msg.kind === "result") {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.resolve(msg.value);
      }
    } else if (msg.kind === "error") {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.reject(msg.error);
      }
    } else if (msg.kind === "event") {
      dispatch(msg.capability, msg.event, msg.payload);
    }
  });

  function post(message: object): void {
    target.postMessage({ __COBDCoreKit: true, ...message }, hostOrigin);
  }

  function call(capability: string, method: string, options?: unknown): Promise<unknown> {
    const id = ++seq;
    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      post({ kind: "call", id, capability, method, options });
    });
  }

  return { call, onEvent, post };
}

/**
 * Transport for code running **in the shell itself**: requests go straight to a
 * local cobdhostkit broker in-process — no iframe, no postMessage. Same API as
 * the iframe transport, so callers don't know or care which one they got.
 *
 * `call` is deferred a microtask so it stays asynchronous like the iframe path;
 * that also lets a caller register `onEvent` immediately after `call` and still
 * catch events the handler emits.
 */
export function createDirectTransport(broker: LocalBroker): Transport {
  const { dispatch, onEvent } = createEventRegistry();

  function call(capability: string, method: string, options?: unknown): Promise<unknown> {
    const emit = (event: string, payload: unknown): void => dispatch(capability, event, payload);
    return Promise.resolve().then(() => broker.invoke(capability, method, options, emit));
  }

  // No wire to post to in-process; kept for interface parity.
  function post(): void {}

  return { call, onEvent, post };
}

/**
 * Pick the right transport for the current context: a `broker` means we're in
 * the shell (direct, in-process); otherwise we're in an iframe (postMessage).
 */
export function createTransport(opts: TransportOptions = {}): Transport {
  if (opts.broker) return createDirectTransport(opts.broker);
  return createIframeTransport(opts);
}
