# @cobdfamily/cobdappkit

The **empty Capacitor shell** for the oister super-app — the native host app
(iOS / Android / web) that mini-apps load into. Built on the latest Capacitor
(8.x). Token: `COBDAppKit`.

Right now it boots an empty WebView and claims a host root element. The mini-app
iframe host and the `@cobdfamily/cobdhostkit` broker get wired in here later;
this is the empty starting point.

## Develop

```sh
npm install
npm run dev        # vite dev server (web)
npm run build      # vite build -> dist/ (capacitor webDir)
npm run typecheck  # tsc --noEmit
```

## Native platforms

Platform folders aren't checked in yet. Generate them when you need a device
build (requires Android SDK / Xcode):

```sh
npm run build
npm run add:android   # cap add android
npm run add:ios       # cap add ios
npm run sync          # cap sync after each web build
```

## License

AGPL-3.0
