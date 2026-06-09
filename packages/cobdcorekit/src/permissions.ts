// Capability -> native permission mapping. Pure data + helpers, no
// Capacitor or DOM imports, so this module is safe to import in Node
// at build time (the generator reads it to emit Info.plist /
// AndroidManifest entries).
//
// The localized usage strings live in @cobdfamily/clf-core's i18n
// (keyed by `stringKey`, e.g. "perm.camera"); `fallback` is the
// English default used when no localized string is available, so this
// works before clf-core ships translations.

import type { EntitlementEntry } from "./types.js";

export interface CapabilityPermission {
    /** iOS Info.plist usage-description keys (empty = no privacy string). */
    ios: string[];
    /** Android <uses-permission> names. */
    android: string[];
    /** clf-core i18n key for the localized usage description. */
    stringKey: string;
    /** English default when no localized string is available. */
    fallback: string;
}

export const CAPABILITY_PERMISSIONS: Record<string, CapabilityPermission> = {
    camera: {
        ios: ["NSCameraUsageDescription"],
        android: ["android.permission.CAMERA"],
        stringKey: "perm.camera",
        fallback: "Used to scan codes and capture photos inside the app.",
    },
    location: {
        ios: ["NSLocationWhenInUseUsageDescription"],
        android: [
            "android.permission.ACCESS_FINE_LOCATION",
            "android.permission.ACCESS_COARSE_LOCATION",
        ],
        stringKey: "perm.location",
        fallback: "Shows nearby information and your position on the map.",
    },
    photos: {
        ios: ["NSPhotoLibraryAddUsageDescription"],
        android: [],
        stringKey: "perm.photos",
        fallback: "Lets you save images to your photo library.",
    },
    microphone: {
        ios: ["NSMicrophoneUsageDescription"],
        android: ["android.permission.RECORD_AUDIO"],
        stringKey: "perm.microphone",
        fallback: "Used to record audio for posts and calls.",
    },
    flashlight: {
        // The torch needs no iOS privacy string; just the Android perm.
        ios: [],
        android: ["android.permission.FLASHLIGHT"],
        stringKey: "perm.flashlight",
        fallback: "Controls the device flashlight.",
    },
    notifications: {
        // Push is an entitlement (aps-environment), not an Info.plist
        // usage string; Android 13+ needs the runtime permission.
        ios: [],
        android: ["android.permission.POST_NOTIFICATIONS"],
        stringKey: "perm.notifications",
        fallback: "Lets us notify you about replies and updates.",
    },
};

export function capabilityPermission(
    capability: string,
): CapabilityPermission | undefined {
    return CAPABILITY_PERMISSIONS[capability];
}

/**
 * Resolve a set of capabilities into permission entries. `resolve`
 * looks up a localized description by its clf-core string key; when it
 * returns undefined (or isn't supplied), the capability's English
 * fallback is used. Unknown capabilities are skipped.
 */
export function getEntitlements(
    capabilities: string[],
    resolve?: (stringKey: string) => string | undefined,
): EntitlementEntry[] {
    const out: EntitlementEntry[] = [];
    for (const capability of capabilities) {
        const p = CAPABILITY_PERMISSIONS[capability];
        if (!p) continue;
        out.push({
            capability,
            iosKeys: p.ios,
            androidPermissions: p.android,
            description: resolve?.(p.stringKey) ?? p.fallback,
        });
    }
    return out;
}
