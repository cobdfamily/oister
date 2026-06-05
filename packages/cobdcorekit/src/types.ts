/** Shared protocol + public types for the COBDCoreKit mini-app runtime. */

/**
 * The in-process broker interface that cobdcorekit talks to when it runs in the
 * shell itself (no iframe). `@cobdfamily/cobdhostkit`'s broker satisfies this;
 * cobdcorekit depends only on the shape, never on the host package.
 */
export interface LocalBroker {
  /**
   * Invoke a capability method in-process. `emit` lets the handler push events
   * (watch ticks, torch-state changes, ...) back to this caller for the same
   * capability. Resolves with the result, rejects with the error.
   */
  invoke(
    capability: string,
    method: string,
    options: unknown,
    emit: (event: string, payload: unknown) => void,
  ): Promise<unknown>;
}

export interface TransportOptions {
  /**
   * Origin of the host shell. Inbound messages from any other origin are
   * ignored, and outbound messages are targeted at this origin. Defaults to
   * `"*"` (no origin check) — set it in production. (iframe transport only)
   */
  hostOrigin?: string;
  /** Window to post to. Defaults to `window.parent`. (iframe transport only) */
  target?: Window;
  /**
   * When provided, cobdcorekit talks to this in-process broker directly instead
   * of postMessaging a parent shell. Use this when the *shell's own* code calls
   * the cobdcorekit API — same API, no iframe round-trip.
   */
  broker?: LocalBroker;
}

export interface Transport {
  /** Send a request to the host and resolve with its result (or reject with its error). */
  call(capability: string, method: string, options?: unknown): Promise<unknown>;
  /** Subscribe to a host-pushed event for a capability. Returns an unsubscribe fn. */
  onEvent(capability: string, event: string, handler: (payload: unknown) => void): () => void;
  /** Fire-and-forget a raw message to the host. */
  post(message: object): void;
}

/** child -> host */
export interface CallMessage {
  __COBDCoreKit: true;
  kind: "call";
  id: number;
  capability: string;
  method: string;
  options?: unknown;
}

/** host -> child: successful reply to a `call` */
export interface ResultMessage {
  __COBDCoreKit: true;
  kind: "result";
  id: number;
  value: unknown;
}

/** host -> child: failed reply to a `call` */
export interface ErrorMessage {
  __COBDCoreKit: true;
  kind: "error";
  id: number;
  error: { code?: number; message: string };
}

/** host -> child: unsolicited push (watch ticks, torch state changes, ...) */
export interface EventMessage {
  __COBDCoreKit: true;
  kind: "event";
  capability: string;
  event: string;
  payload: unknown;
}

export type InboundMessage = ResultMessage | ErrorMessage | EventMessage;

export interface TorchAPI {
  on(): Promise<boolean>;
  off(): Promise<boolean>;
  toggle(): Promise<boolean>;
  /** Locally-cached mirror of host truth — eventually consistent, fine for UI. */
  readonly isOn: boolean;
}

export interface COBDCoreKit {
  readonly version: string;
  readonly torch: TorchAPI;
}

declare global {
  interface Window {
    COBDCoreKit: COBDCoreKit;
  }
  // eslint-disable-next-line no-var
  var COBDCoreKit: COBDCoreKit;
}
