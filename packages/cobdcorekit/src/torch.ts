import { CapacitorFlash } from "@capgo/capacitor-flash";
import { Haptics } from "@capacitor/haptics";

import type { TorchAPI, TorchBackend } from "./types.js";

/** Default backend: @capgo/capacitor-flash + @capacitor/haptics (both
 *  have web implementations, so this also runs in a plain browser). */
const defaultBackend: TorchBackend = {
    on: () => CapacitorFlash.switchOn({}),
    off: () => CapacitorFlash.switchOff(),
    buzz: (durationMs) => Haptics.vibrate({ duration: durationMs }),
};

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface TorchOptions {
    backend?: TorchBackend;
    /** Haptic pulse length on state change, ms (default 150). */
    hapticDuration?: number;
    /** How long `flash` holds the light on, ms (default 750). */
    flashOnMs?: number;
}

/**
 * `COBDCoreKit.torch` — `on`/`off`/`toggle` plus `flash` (one-shot
 * blink: light on + a haptic buzz, then off). Calls the flash + haptics
 * plugins directly; `isOn` is tracked locally.
 */
export function installTorch(opts: TorchOptions = {}): TorchAPI {
    const backend = opts.backend ?? defaultBackend;
    const hapticDuration = opts.hapticDuration ?? 150;
    const flashOnMs = opts.flashOnMs ?? 750;
    let isOn = false;

    async function set(next: boolean, buzz: boolean): Promise<boolean> {
        if (next !== isOn) {
            if (next) await backend.on();
            else await backend.off();
            isOn = next;
            if (buzz) await backend.buzz(hapticDuration);
        }
        return isOn;
    }

    return {
        on: () => set(true, true),
        off: () => set(false, true),
        toggle: () => set(!isOn, true),
        async flash(onMs?: number) {
            await set(true, true);
            await delay(onMs ?? flashOnMs);
            await set(false, false);
        },
        get isOn() {
            return isOn;
        },
    };
}
