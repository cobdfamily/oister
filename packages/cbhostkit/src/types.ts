/** Host-side types for the cobdkit broker. The wire protocol itself is shared
 *  from `@cobdfamily/cobdkit`. */

/** Handed to every capability handler so it can push unsolicited events back to
 *  the mini-app that made the call (watch ticks, torch-state changes, ...). */
export interface CapabilityContext {
  /** Origin of the calling mini-app. */
  readonly origin: string;
  /** Push an `event` for this capability to the calling mini-app. */
  emit(event: string, payload: unknown): void;
}

/** A capability handler resolves a single `call`. Return value becomes the
 *  `result`; a thrown error becomes the `error` reply. */
export type CapabilityHandler = (
  method: string,
  options: unknown,
  ctx: CapabilityContext,
) => unknown | Promise<unknown>;

export interface HostBrokerOptions {
  /**
   * Origins permitted to call the broker. Calls from any other origin are
   * rejected. Omit or include `"*"` to allow all — DEV ONLY; a super-app
   * loading untrusted mini-apps must set a real allowlist.
   */
  allowedOrigins?: string[];
  /** Capabilities to register up front; more can be added via `register`. */
  capabilities?: Record<string, CapabilityHandler>;
}
