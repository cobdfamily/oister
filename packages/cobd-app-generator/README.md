# @cobdfamily/cobd-app-generator

Generates the family of near-identical Capacitor apps from **one shared web
base** plus a tiny **per-app overlay**. The apps differ only by **identifier**,
**icon**, and **`menu.json`** — everything else is the base.

> The shared web base is **not configured yet** — set `base` in
> `generator.config.json` (the former `cobdappkit` package was removed). Until
> then, `--list`/`--dry-run` and the tests work, but a real generation run will
> stop with a clear error.

This is **approach D**: native `android/`/`ios/` projects are *disposable*. They
aren't committed; they're regenerated from scratch at a **pinned** Capacitor
version on every build. So the apps are identical *by construction*, and
upgrading Capacitor is a one-line bump in `generator.config.json` — there are no
checked-in native projects to migrate.

## Layout

```
generator.config.json     pinned Capacitor version, platforms, base ref   ← bump to upgrade ALL apps
shared/overlay.json       native config shared by every app (iOS Info.plist keys, Android perms)
shared/cdn.json           CDN/SRI manifest the oister shell loads (URLs + integrity)
apps/<id>/
  brand.json              { appId, appName, extra }     ← the identifier + theme colour
  icon.png                ≥1024px source                ← the icon (you add this)
  menu.json               nav items                     ← the menu asset
  seo.json                page/site metadata            ← title/description/url/image/og
bin/gen.mjs               the generator CLI
src/lib.mjs               pure, tested core logic
templates/                signing + CI (match, exportOptions, gradle, workflow)
.generated/               disposable output (gitignored)
```

## Use

```sh
node bin/gen.mjs --list                 # alpha, bravo, charlie
node bin/gen.mjs alpha --dry-run         # print the plan, touch nothing
node bin/gen.mjs alpha                    # regenerate one app (needs the native toolchain)
node bin/gen.mjs --all                    # regenerate every app
```

Each run: build base web → assemble webDir (base dist + this app's `menu.json` +
`brand.json`, and render `index.html` from `brand.json` + `menu.json` + `seo.json`
+ `shared/cdn.json` via [`@cobdfamily/oister`](../oister)) → scaffold an ephemeral
project at the pinned version → `npm install` → `cap add` → apply the shared
native overlay → `@capacitor/assets` (icon/splash from `icon.png`) → `cap sync`.
The result in `.generated/<app>/` is ready to build + sign.

> The generated `index.html` is the oister umbrella shell: the app's `menu.json`
> becomes the side-menu nav, `brand.json` the title + theme colour, and `seo.json`
> the page metadata. It overwrites any `index.html` the base dist ships — the
> shell is the entry point.

> The `cap add` / asset / sync steps need the native toolchains (Android SDK,
> Xcode, CocoaPods). `--dry-run` and the `npm test` logic run anywhere.

## Adding / changing an app

- New app → add `apps/<id>/` with `brand.json`, `menu.json`, `seo.json`, `icon.png`.
- Different menu → edit that app's `menu.json`.
- Different icon → replace that app's `icon.png`.
- Shared change → edit the shared web base or `shared/overlay.json`; every app
  inherits it on next regen. Nothing to sync by hand.

## Signing (survives regeneration)

Signing material lives **outside** the disposable projects and is injected at
build time, so regeneration never loses it:

- **Android** — keystore via Gradle injected properties. See
  [`templates/android-signing.md`](templates/android-signing.md).
- **iOS** — `fastlane match` installs certs/profiles into the runner keychain;
  signing is applied via [`templates/exportOptions.plist`](templates/exportOptions.plist)
  (manual signing). See [`templates/fastlane/`](templates/fastlane).

## CI

[`templates/ci/build-apps.yml`](templates/ci/build-apps.yml) is a matrix workflow
(Android on Linux, iOS on the self-hosted M1 runner). It's a template so it
doesn't fire before signing secrets exist — copy it into `.github/workflows/`
when ready.

## License

AGPL-3.0
