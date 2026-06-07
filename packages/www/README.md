# @cobdfamily/www (temporary)

The **bowencommunity-core umbrella shell**, vendored into oister with all of
its assets in one self-contained tree. This is a staging package: the goal is
to evolve the iframe shell onto oister's bridge (`cobdcorekit` / `cobdhostkit`,
e.g. `COBDCoreKit.nav`) with everything in one place, instead of the old setup
where the shell source, the (broken) Vite root, the built output, and the
springboard child app were scattered across `bowencommunity-core` and the
`../../Springboard` sibling repo.

## Layout

```
index.html              the shell: two iframes (#menu + #mainview) + toolbar
src/main.ts             postMessage bridge + window.sendEvent into #mainview
src/navigation.ts       CBNavigation — toolbar, goToURL, showMenu, mobile toggle
src/shell.css           shell layout (was base64-inlined in the old build)
public/manifest.json    web app manifest
public/favicon.ico      shell favicon
public/components/springboard/   the springboard child app, vendored wholesale
                                 (the iframe target; uses <base href="./">)
```

CLF design tokens come straight from `@cobdfamily/clf-core/tokens.css`,
imported in `main.ts` — no sync-tokens script.

## Run

```sh
npm install      # from the oister repo root (workspaces)
npm run dev -w @cobdfamily/www
```

## License

AGPL-3.0
