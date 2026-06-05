import { CapacitorFlash } from "@capgo/capacitor-flash";
import { Haptics } from "@capacitor/haptics";

import type { CapabilityHandler } from "../types.js";

export interface TorchOptions {
  /** Buzz on every state change (mirrors bowencommunity-core's flash UX). Default true. */
  haptics?: boolean;
  /** Haptic pulse length in ms. Default 150 (the value core used). */
  hapticDuration?: number;
}

/**
 * `torch` capability — implements cobdkit's stateful `on` / `off` / `toggle` API
 * on top of `@capgo/capacitor-flash`, with an optional `@capacitor/haptics`
 * buzz on each change (the two plugins bowencommunity-core already depends on).
 *
 * Methods return the resulting boolean state, which is what `cobdkit.torch`
 * caches into its `isOn` mirror.
 */
export function createTorchCapability(opts: TorchOptions = {}): CapabilityHandler {
  const useHaptics = opts.haptics ?? true;
  const hapticDuration = opts.hapticDuration ?? 150;
  let isOn = false;

  async function set(next: boolean): Promise<boolean> {
    if (next !== isOn) {
      if (next) await CapacitorFlash.switchOn({});
      else await CapacitorFlash.switchOff();
      isOn = next;
      if (useHaptics) await Haptics.vibrate({ duration: hapticDuration });
    }
    return isOn;
  }

  return async (method) => {
    switch (method) {
      case "on":
        return set(true);
      case "off":
        return set(false);
      case "toggle":
        return set(!isOn);
      case "state":
        return isOn;
      default:
        throw new Error(`torch: unknown method "${method}"`);
    }
  };
}
