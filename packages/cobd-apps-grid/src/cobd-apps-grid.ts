// <cobd-apps-grid path="..." [target="_self|_blank|<frame-name>"]
//                 [remember] [from-param="from"]>
//
// An iOS/iPadOS home-screen-inspired launcher grid -- the springboard
// surface for the COBD app family. Each app is a <button> tile: a
// rounded-square icon (an inline SVG or an image) with the app label
// beneath.
//
// Ionic-optional (auto-detected): when <ion-app> is on the page it
// lays the tiles out with <ion-grid>/<ion-row>/<ion-col size="auto">;
// otherwise it falls back to a CSS auto-fill grid. Light DOM (no
// shadow root) so Ionic can upgrade + style the ion-* layout -- the
// grid is meant to live on its own apps page, where there's no foreign
// host CSS to fight.
//
// Data: fetched as JSON from `path` (a CDN URL or a root-relative
// path). The payload is either a bare array or { apps: [...] }, each:
//
//   {
//     "label":  "Ferry",                 // required
//     "href":   "https://...",           // optional launch target
//     "icon":   "<svg ...>...</svg>",     // optional inline SVG
//     "iconUrl":"https://.../ferry.png",  // optional image (if no icon)
//     "target": "_blank"                  // optional, per-item override
//   }
//
// Launch: clicking a tile fires a cancelable `cobd-app-launch`
// CustomEvent (bubbles + composed, detail = the item) and then, unless
// a listener calls preventDefault(), navigates to `href` in `target`
// (grid-level `target` attribute, default "_self"; per-item `target`
// wins). target="app" loads the app into a named iframe (e.g. the
// clam shell's <iframe name="app">); "_blank" opens a new tab.
//
// Resume (opt-in via `remember`): on load the grid reads ?from=<url>
// (param name from `from-param`, default "from") and stores that app's
// place under localStorage "app:<hostname>". A tile whose app has a
// saved place gets a badge and, when launched, resumes there instead
// of its home href.

import { appKey, restOfUrl, resumeUrl } from "./resume.js";

interface AppItem {
    label: string;
    href?: string;
    icon?: string;
    iconUrl?: string;
    target?: string;
}

function ionicPresent(): boolean {
    return typeof document !== "undefined"
        && document.querySelector("ion-app") !== null;
}

// Light-DOM tile + CSS-grid-fallback styles. Injected once per page.
// The icon radius (~22.37% of the tile) approximates the iOS squircle.
// Tile styles apply in both modes; the .cobd-apps-grid layout rule is
// only used in the non-Ionic fallback (Ionic mode uses <ion-grid>).
const BASE_STYLE_ID = "cobd-apps-grid-base-style";
const BASE_STYLE = `
cobd-apps-grid { display: block; }
.cobd-apps-grid {
    display: grid;
    grid-template-columns:
        repeat(auto-fill, minmax(var(--cobd-apps-tile, 5.5rem), 1fr));
    gap: var(--cobd-spacing-lg, 24px) var(--cobd-spacing-md, 16px);
    padding: var(--cobd-spacing-lg, 24px);
    justify-items: center;
    max-width: 60rem;
    margin: 0 auto;
}
.cobd-apps-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--cobd-spacing-xs, 6px);
    width: 4.75rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.cobd-apps-tile-icon {
    position: relative;
    width: 3.75rem;
    height: 3.75rem;
    border-radius: 22.37%;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: var(--cobd-color-surface, #fff);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.12s ease;
}
.cobd-apps-tile-icon > svg,
.cobd-apps-tile-icon > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.cobd-apps-tile-fallback {
    font-size: 1.75rem;
    font-weight: var(--cobd-typography-weight-medium, 600);
    color: var(--cobd-color-primary-contrast, #000);
    background: var(--cobd-color-primary, #72cadb);
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
}
.cobd-apps-tile-resume {
    position: absolute;
    top: 6%;
    inset-inline-end: 6%;
    width: 22%;
    height: 22%;
    border-radius: 50%;
    background: var(--cobd-color-primary, #72cadb);
    box-shadow: 0 0 0 2px var(--cobd-color-surface, #fff);
}
.cobd-apps-tile:hover .cobd-apps-tile-icon { transform: scale(1.04); }
.cobd-apps-tile:active .cobd-apps-tile-icon { transform: scale(0.96); }
.cobd-apps-tile:focus-visible { outline: none; }
.cobd-apps-tile:focus-visible .cobd-apps-tile-icon {
    outline: 3px solid var(--cobd-color-primary, #72cadb);
    outline-offset: 3px;
}
.cobd-apps-tile-label {
    font-family: var(--cobd-typography-family-sans, system-ui, sans-serif);
    font-size: var(--cobd-typography-size-sm, 0.8125rem);
    line-height: 1.2;
    text-align: center;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.cobd-apps-grid-skeleton .cobd-apps-tile-icon {
    background: var(--cobd-color-medium, #92949c);
    opacity: 0.25;
    box-shadow: none;
    animation: cobd-apps-pulse 1.2s ease-in-out infinite;
}
@keyframes cobd-apps-pulse {
    50% { opacity: 0.12; }
}
@media (prefers-reduced-motion: reduce) {
    .cobd-apps-tile-icon { transition: none; }
    .cobd-apps-grid-skeleton .cobd-apps-tile-icon { animation: none; }
}
`;

function ensureBaseStyle() {
    if (typeof document === "undefined") return;
    if (document.getElementById(BASE_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = BASE_STYLE_ID;
    style.textContent = BASE_STYLE;
    document.head.appendChild(style);
}

export class CobdAppsGrid extends HTMLElement {
    static get observedAttributes() {
        return ["path", "target", "remember", "from-param"];
    }

    private rendered = false;

    connectedCallback() {
        ensureBaseStyle();
        if (!this.rendered) this.render();
    }

    attributeChangedCallback() {
        if (this.isConnected && this.rendered) this.render();
    }

    private remembers(): boolean {
        return this.hasAttribute("remember");
    }

    // Record the launcher's `from` URL (when `remember` is set) so a
    // later visit can resume the app where it left off.
    private captureFrom() {
        if (!this.remembers()) return;
        const param = this.getAttribute("from-param") || "from";
        let from: string | null = null;
        try {
            from = new URL(location.href).searchParams.get(param);
        } catch {
            return;
        }
        if (!from) return;
        const key = appKey(from);
        const rest = restOfUrl(from);
        if (key && rest != null) {
            try {
                localStorage.setItem(key, rest);
            } catch {
                /* storage unavailable -- skip silently */
            }
        }
    }

    // The resume URL for an app (last place recorded), or null.
    private storedResume(href: string): string | null {
        if (!this.remembers()) return null;
        const key = appKey(href, location.href);
        if (!key) return null;
        try {
            const rest = localStorage.getItem(key);
            return rest ? resumeUrl(href, rest) : null;
        } catch {
            return null;
        }
    }

    private launch(item: AppItem) {
        const ev = new CustomEvent("cobd-app-launch", {
            detail: item,
            bubbles: true,
            composed: true,
            cancelable: true,
        });
        if (!this.dispatchEvent(ev)) return;
        // Prefer the resumed location over the home href when one was
        // recorded.
        const href = (item.href && this.storedResume(item.href))
            || item.href;
        if (!href) return;
        const target = item.target
            || this.getAttribute("target") || "_self";
        if (target === "_self") {
            window.location.assign(href);
        } else {
            window.open(href, target);
        }
    }

    private tile(item: AppItem, skeleton: boolean): HTMLElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cobd-apps-tile";

        const canResume = !skeleton && !!item.href
            && !!this.storedResume(item.href);

        const icon = document.createElement("span");
        icon.className = "cobd-apps-tile-icon";
        icon.setAttribute("aria-hidden", "true");
        if (!skeleton) {
            if (item.icon) {
                // Trusted, CDN-authored SVG markup.
                icon.innerHTML = item.icon;
            } else if (item.iconUrl) {
                const img = document.createElement("img");
                img.src = item.iconUrl;
                img.alt = "";
                icon.appendChild(img);
            } else {
                const fb = document.createElement("span");
                fb.className = "cobd-apps-tile-fallback";
                fb.textContent = (item.label || "?")
                    .trim().charAt(0).toUpperCase();
                icon.appendChild(fb);
            }
        }
        if (canResume) {
            // A badge marking apps with a saved place to resume. Added
            // after the icon content so item.icon's innerHTML can't
            // wipe it.
            const dot = document.createElement("span");
            dot.className = "cobd-apps-tile-resume";
            icon.appendChild(dot);
        }
        button.appendChild(icon);

        const label = document.createElement("span");
        label.className = "cobd-apps-tile-label";
        label.textContent = skeleton ? "" : item.label;
        button.appendChild(label);

        if (skeleton) {
            button.disabled = true;
            button.setAttribute("aria-hidden", "true");
        } else {
            button.setAttribute("aria-label", canResume
                ? `${item.label} (resume where you left off)`
                : item.label);
            button.addEventListener("click", () => this.launch(item));
        }
        return button;
    }

    // Ionic layout: <ion-grid><ion-row><ion-col size="auto"> per tile.
    private buildIonic(items: AppItem[], skeleton: boolean): HTMLElement {
        const grid = document.createElement("ion-grid");
        grid.classList.add("cobd-apps-grid-ionic");
        if (skeleton) grid.classList.add("cobd-apps-grid-skeleton");
        const row = document.createElement("ion-row");
        row.classList.add("ion-justify-content-center");
        if (skeleton) row.setAttribute("aria-busy", "true");
        row.setAttribute("role", "list");
        for (const item of items) {
            const col = document.createElement("ion-col");
            col.setAttribute("size", "auto");
            const cell = this.tile(item, skeleton);
            cell.setAttribute("role", "listitem");
            col.appendChild(cell);
            row.appendChild(col);
        }
        grid.appendChild(row);
        return grid;
    }

    // Non-Ionic fallback: a CSS grid of tiles.
    private buildPlain(items: AppItem[], skeleton: boolean): HTMLElement {
        const grid = document.createElement("div");
        grid.className = "cobd-apps-grid";
        if (skeleton) {
            grid.classList.add("cobd-apps-grid-skeleton");
            grid.setAttribute("aria-busy", "true");
        }
        grid.setAttribute("role", "list");
        for (const item of items) {
            const cell = this.tile(item, skeleton);
            cell.setAttribute("role", "listitem");
            grid.appendChild(cell);
        }
        return grid;
    }

    private buildGrid(items: AppItem[], skeleton: boolean): HTMLElement {
        return ionicPresent()
            ? this.buildIonic(items, skeleton)
            : this.buildPlain(items, skeleton);
    }

    private async render() {
        this.captureFrom();
        const path = this.getAttribute("path");
        if (!path) {
            this.replaceChildren();
            return;
        }
        // Skeleton placeholders while the fetch is in flight.
        this.replaceChildren(this.buildGrid(
            Array.from({ length: 8 }, () => ({ label: "" })), true));

        let items: AppItem[] | null = null;
        try {
            const res = await fetch(path, { cache: "no-cache" });
            if (!res.ok) throw new Error("http " + res.status);
            const data = await res.json();
            items = Array.isArray(data) ? data : data?.apps;
        } catch (err) {
            console.error("cobd-apps-grid:", err);
            return;
        }
        if (!Array.isArray(items)) {
            console.error(
                "cobd-apps-grid: expected an array or { apps: [...] }");
            return;
        }
        this.replaceChildren(this.buildGrid(items, false));
        this.rendered = true;
    }
}

if (typeof customElements !== "undefined"
    && !customElements.get("cobd-apps-grid")) {
    customElements.define("cobd-apps-grid", CobdAppsGrid);
}
