# Springboard

> **ARCHIVED.** This is a frozen snapshot of the former
> `cobdfamily/bowencommunity-springboard` repository (its tracked source at
> the time it was retired), kept here for reference. It is intentionally
> **excluded from the oister npm workspace** (`!packages/springboard` in the
> root `package.json`) so it does not pull the Angular toolchain into oister's
> install — run `npm install` inside this directory if you need to build it.
> The shell's menu now loads the built springboard from
> `packages/www/public/components/springboard/`.

Ionic + Angular launcher for the Bowen Community app suite. Themed
by `@cobdfamily/clf-core`.

## Develop

```
npm install
npm start         # ng serve
npm run build     # production build -> www/
npm test          # Karma/Jasmine
npm run lint      # ESLint
```

## License

AGPL-3.0 — see `LICENSE`.
