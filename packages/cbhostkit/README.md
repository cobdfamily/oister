# @cobdfamily/cbhostkit

The **host side** of the cobdkit mini-app bridge. Where
[`@cobdfamily/cobdkit`](../cobdkit) is injected into each mini-app iframe,
`cbhostkit` runs in the **super-app shell** (e.g. `bowencommunity-core`). It
listens for the `__cobdkit` calls the mini-apps post, enforces origin policy,
and answers them with native Capacitor plugins.

```
mini-app iframe                       shell (this package)
  cobdkit.torch.on() ── postMessage ──▶ createHostBroker()
                                          └─ torch capability
                                               ├─ @capgo/capacitor-flash
                                               └─ @capacitor/haptics
```

## Usage

```ts
import { createHostBroker, createTorchCapability } from "@cobdfamily/cbhostkit";

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
