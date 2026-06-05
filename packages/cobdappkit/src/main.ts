import { Capacitor } from "@capacitor/core";

/** A booted COBDAppKit shell handle. */
export interface COBDAppKit {
  /** Capacitor platform: "web" | "ios" | "android". */
  readonly platform: string;
  /** True when running inside a native Capacitor container. */
  readonly native: boolean;
  /** The element the shell mounted into (where mini-apps will be hosted). */
  readonly root: HTMLElement;
}

/**
 * Boot the empty COBDAppKit shell. For now it only reports the Capacitor
 * environment and claims a host root element — the mini-app iframe host and the
 * cobdhostkit broker get wired in here later. This is the empty starting point.
 */
export function createCOBDAppKit(root: HTMLElement = document.body): COBDAppKit {
  const COBDAppKit: COBDAppKit = {
    platform: Capacitor.getPlatform(),
    native: Capacitor.isNativePlatform(),
    root,
  };

  // Marker so it's obvious in the DOM that the shell booted, and on what.
  root.dataset.cobdappkit = COBDAppKit.platform;

  return COBDAppKit;
}

createCOBDAppKit(document.querySelector<HTMLElement>("#app") ?? document.body);
