# @cobdfamily/cobd-apps-grid

The `<cobd-apps-grid>` custom element — an iOS/iPadOS
home-screen-inspired **app launcher grid**, the springboard surface
for the COBD app family. It's the JS behind the `/apps` page.

```html
<script type="module" src=".../cobd-apps-grid.js"></script>

<cobd-apps-grid
  path="https://cdn.blindhub.ca/apps/cobd.json"
  target="app"
  remember></cobd-apps-grid>
```

(`<cobd-apps-button>`, the launcher chip that *redirects to* the apps
page, lives in `@cobdfamily/clf-core` — it's general chrome. This
package is just the grid surface.)

## Behaviour

- **Tiles from JSON.** Fetches `path` (CDN URL or root-relative; a
  bare array or `{ apps: [...] }`). Each item: `label` (required),
  `href`, `icon` (inline SVG) or `iconUrl` (image), optional per-item
  `target`. Missing icon → the label's first letter. Loading skeleton
  while fetching.
- **Launch.** Clicking a tile fires a cancelable `cobd-app-launch`
  event (`detail` = the item), then navigates to `href` in `target`
  (`_self` default; `_blank`; or a named frame like `app` to load into
  the oister shell's `<iframe name="app">`).
- **Ionic-optional.** With `<ion-app>` on the page it lays out via
  `<ion-grid>`/`<ion-col>`; otherwise a CSS auto-fill grid. Light DOM
  so Ionic can style the `ion-*` layout.
- **Resume (`remember`).** On load it reads `?from=<url>` (param via
  `from-param`, default `from`) and stores that app's place in
  `localStorage["app:" + hostname] = pathname + search + hash`. A tile
  whose app has a saved place shows a badge and, when launched,
  resumes there instead of its home href. All storage/URL access is
  guarded (private mode / bad URLs degrade silently).

## Attributes

| Attribute     | Purpose                                                    |
|---------------|------------------------------------------------------------|
| `path`        | URL of the apps JSON (required to render tiles)            |
| `target`      | Where launches open: `_self` (default) / `_blank` / frame  |
| `remember`    | Enable per-app resume (record `?from`, resume on launch)   |
| `from-param`  | Query param carrying the origin URL (default `from`)       |

Styling rides the `--cobd-*` design tokens (with solid fallbacks);
the resume storage scheme is `app:<hostname>` → the rest of the URL.

## Build / test

```bash
npm run build   # tsc -> dist/ (the element + resume helpers)
npm test        # node --test via tsx -- the pure resume helpers
```

The element is DOM-bound (exercised in a browser); `npm test` covers
the pure URL/storage-key logic in `resume.ts`.
