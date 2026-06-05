# @cobdfamily/cobdhostkit

The **native broker** of the COBDCoreKit bridge — the only package that actually
touches Capacitor plugins, and one you **never call directly** (callers always
go through [`@cobdfamily/cobdcorekit`](../cobdcorekit)). It runs in the
**super-app shell** (e.g. `bowencommunity-core`), listens for the `__COBDCoreKit`
calls that `cobdcorekit` posts, enforces origin policy, and answers them with
native plugins.

```
cobdcorekit caller                    shell (this package)
  COBDCoreKit.torch.on() ── postMessage ──▶ createHostBroker()
                                          └─ torch capability
                                               ├─ @capgo/capacitor-flash
                                               └─ @capacitor/haptics
```

## Usage

```ts
import { createHostBroker, createTorchCapability } from "@cobdfamily/cobdhostkit";

const broker = createHostBroker({
  allowedOrigins: ["https://ferry.bowencommunity.ca"], // omit for dev (allow all)
  capabilities: {
    torch: createTorchCapability({ haptics: true }),
  },
});

// add more capabilities later:
// broker.register("geo", createGeoCapability());
```

A capability is just `(method, options, ctx) => result | Promise<result>`. The
return value becomes the `result` reply; a throw becomes the `error` reply;
`ctx.emit(event, payload)` pushes unsolicited events (watch ticks, torch-state
changes) back to the calling mini-app.

## License

AGPL-3.0
