import { Geolocation } from "@capacitor/geolocation";

import type { FlatPosition, GeoBackend } from "./types.js";

interface NativeCoords {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
}
interface NativePosition {
    coords: NativeCoords;
    timestamp: number;
}

function flatten(p: NativePosition): FlatPosition {
    const c = p.coords;
    return {
        latitude: c.latitude,
        longitude: c.longitude,
        accuracy: c.accuracy,
        altitude: c.altitude ?? null,
        altitudeAccuracy: c.altitudeAccuracy ?? null,
        heading: c.heading ?? null,
        speed: c.speed ?? null,
        timestamp: p.timestamp,
    };
}

/** Default backend: @capacitor/geolocation (web impl uses navigator.geolocation). */
const defaultBackend: GeoBackend = {
    getCurrentPosition: async (options) =>
        flatten(await Geolocation.getCurrentPosition(options as never) as NativePosition),
    watchPosition: (options, cb) =>
        Geolocation.watchPosition(options as never, (pos, err) =>
            cb(pos ? flatten(pos as NativePosition) : null, err)),
    clearWatch: (id) => Geolocation.clearWatch({ id }),
};

/** GeolocationPosition isn't constructible — fabricate the shape. */
function toPosition(p: FlatPosition): GeolocationPosition {
    return {
        coords: {
            latitude: p.latitude,
            longitude: p.longitude,
            accuracy: p.accuracy,
            altitude: p.altitude,
            altitudeAccuracy: p.altitudeAccuracy,
            heading: p.heading,
            speed: p.speed,
            toJSON() { return this; },
        },
        timestamp: p.timestamp,
        toJSON() { return this; },
    } as GeolocationPosition;
}

function toError(e: unknown): GeolocationPositionError {
    const message = e instanceof Error ? e.message
        : String((e as { message?: unknown })?.message ?? e ?? "geolocation error");
    return {
        code: 2,
        message,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
    } as GeolocationPositionError;
}

/**
 * Override `navigator.geolocation` so ordinary W3C calls run through
 * @capacitor/geolocation (which gives the native GPS + OS prompt in the
 * app, and the browser's own geolocation on the web). The page can't
 * tell the difference.
 */
export function installGeolocationShim(backend: GeoBackend = defaultBackend): void {
    let watchSeq = 0;
    const native = new Map<number, string>();

    const geolocation: Geolocation = {
        getCurrentPosition(success, error, options) {
            backend.getCurrentPosition(options)
                .then((p) => success(toPosition(p)))
                .catch((e) => error?.(toError(e)));
        },
        watchPosition(success, error, options) {
            const watchId = ++watchSeq;
            backend.watchPosition(options, (pos, err) => {
                if (err || !pos) error?.(toError(err));
                else success(toPosition(pos));
            })
                .then((id) => native.set(watchId, id))
                .catch((e) => error?.(toError(e)));
            return watchId;
        },
        clearWatch(watchId) {
            const id = native.get(watchId);
            if (id !== undefined) backend.clearWatch(id);
            native.delete(watchId);
        },
    };

    Object.defineProperty(navigator, "geolocation", {
        value: geolocation,
        configurable: true,
        writable: false,
    });
}
