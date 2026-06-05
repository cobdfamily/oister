# oister

The native-bridge toolkit for the cobdfamily super-app shell. A super-app loads
its child apps into sandboxed iframes; `oister` is how any of that code — inside
an iframe or in the shell itself — reaches native device functionality.

## The two packages

| Package | Role |
| --- | --- |
| [`@cobdfamily/cobdcorekit`](packages/cobdcorekit) | The **client API**. The *only* thing you ever call. Used the same way whether your code runs **inside** a mini-app iframe or **outside** it in the shell. Exposes the surfaces apps use — a shimmed `navigator.geolocation`, the `COBDCoreKit.torch` API, etc. |
| [`@cobdfamily/cobdhostkit`](packages/cobdhostkit) | The **native broker**. The *only* thing that actually touches Capacitor plugins (`@capgo/capacitor-flash`, `@capacitor/haptics`, …). Runs in the shell, enforces origin policy, answers requests. **Never called directly.** |

The rule: **always go through `cobdcorekit`; never call `cobdhostkit` directly** —
regardless of where your code runs. `cobdhostkit` is an implementation detail
that `cobdcorekit` talks to on your behalf.

```
   your code (in iframe OR in shell)
              │
              ▼
      @cobdfamily/cobdcorekit          ← the only API you call
              │
        (transport)
              │
              ▼
      @cobdfamily/cobdhostkit          ← the only thing that calls native
              │
              ▼
   @capgo/capacitor-flash, @capacitor/haptics, …
```

### Surfaces cobdcorekit exposes

| Surface | Kind | Caller sees |
| --- | --- | --- |
| `navigator.geolocation` | **shim** of the W3C API | a standard browser API — unmodified apps just work |
| `COBDCoreKit.torch` | **new** API (no web standard) | `on()` / `off()` / `toggle()` / `flash()` / `isOn` |

## Two contexts, one API

`cobdcorekit` picks its transport from the options you give it, so the same API
works either side of the iframe boundary:

```ts
// in a mini-app iframe — postMessage to the parent shell
import { installCOBDCoreKit } from "@cobdfamily/cobdcorekit";
installCOBDCoreKit({ hostOrigin: "https://shell.bowencommunity.ca" });
```

```ts
// in the shell itself — talk to the local broker in-process, no iframe hop
import { createHostBroker, createTorchCapability } from "@cobdfamily/cobdhostkit";
import { installCOBDCoreKit } from "@cobdfamily/cobdcorekit";

const broker = createHostBroker({
  capabilities: { torch: createTorchCapability() },
}); // also serves mini-app iframes via its window listener

installCOBDCoreKit({ broker: broker.local }); // shell code now uses COBDCoreKit.torch too
```

Either way the caller writes `COBDCoreKit.torch.on()` / `navigator.geolocation.*`
and never touches `cobdhostkit`.

## Develop

```sh
npm install
npm run build      # builds cobdcorekit, then cobdhostkit (shares its types)
npm test
```
