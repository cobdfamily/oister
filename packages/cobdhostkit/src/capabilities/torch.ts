import { CapacitorFlash } from "@capgo/capacitor-flash";
import { Haptics } from "@capacitor/haptics";

import type { CapabilityContext, CapabilityHandler } from "../types.js";

/** The native operations the torch capability needs. Injectable for testing. */
export interface TorchBackend {
  on(): Promise<void>;
  off(): Promise<void>;
  buzz(durationMs: number): Promise<void>;
}

const defaultBackend: TorchBackend = {
  on: () => CapacitorFlash.switchOn({}),
  off: () => CapacitorFlash.switchOff(),
  buzz: (durationMs) => Haptics.vibrate({ duration: durationMs }),
};

export interface TorchOptions {
  /** Buzz on state change / flash (mirrors bowencommunity-core's flash UX). Default true. */
  haptics?: boolean;
  /** Haptic pulse length in ms. Default 150 (the value core used). */
  hapticDuration?: number;
  /** How long `flash` holds the light on before switching off, in ms. Default 750 (core's value). */
  flashOnMs?: number;
  /** Native backend. Defaults to @capgo/capacitor-flash + @capacitor/haptics. */
  backend?: TorchBackend;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * `torch` capability — stateful `on` / `off` / `toggle` plus `flash`, the
 * one-shot blink ported from bowencommunity-core (light on + haptic buzz, then
 * off after `flashOnMs`). Built on `@capgo/capacitor-flash` + `@capacitor/haptics`.
 *
 * Emits `state` ({ isOn }) on every change so `COBDCoreKit.torch.isOn` stays in
 * sync, and `flashing` (true/false) around a flash so callers can react.
 * Methods return the resulting boolean state (`flash` resolves false when done).
 */
export function createTorchCapability(opts: TorchOptions = {}): CapabilityHandler {
  const useHaptics = opts.haptics ?? true;
  const hapticDuration = opts.hapticDuration ?? 150;
  const flashOnMs = opts.flashOnMs ?? 750;
  const backend = opts.backend ?? defaultBackend;
  let isOn = false;

  async function set(next: boolean, ctx: CapabilityContext, buzz: boolean): Promise<boolean> {
    if (next !== isOn) {
      if (next) await backend.on();
      else await backend.off();
      isOn = next;
      if (buzz && useHaptics) await backend.buzz(hapticDuration);
      ctx.emit("state", { isOn });
    }
    return isOn;
  }

  return async (method, options, ctx) => {
    switch (method) {
      case "on":
        return set(true, ctx, useHaptics);
      case "off":
        return set(false, ctx, useHaptics);
      case "toggle":
        return set(!isOn, ctx, useHaptics);
      case "state":
        return isOn;
      case "flash": {
        const onMs = typeof (options as { onMs?: unknown })?.onMs === "number"
          ? (options as { onMs: number }).onMs
          : flashOnMs;
        ctx.emit("flashing", true);
        await set(true, ctx, useHaptics); // light on + single buzz, like core
        await delay(onMs);
        await set(false, ctx, false); // off, no second buzz
        ctx.emit("flashing", false);
        return false;
      }
      default:
        throw new Error(`torch: unknown method "${method}"`);
    }
  };
}
