# <sub><img src="/src/icons/icon.svg" width="64" height="64"></sub> Tab Session Garrison

**Keyboard-first session management for Firefox.** Save and restore windows and tabs — with fast multi-select and full keyboard navigation for wrangling large numbers of saved sessions.

> _Branding (logo, screenshots) is getting its own refresh — see the roadmap. For now the original Tab Session Manager icon stands in._

Tab Session Garrison is a personal fork of [**Tab Session Manager**](https://github.com/sienori/Tab-Session-Manager) by Sienori, focused on power-user controls: selecting, navigating, and deleting sessions without leaving the keyboard, and clearing out the noise that builds up when you auto-save constantly.

---

## Features

Everything Tab Session Manager does — save and restore the state of windows and tabs, automatic timed saving, tagging, search, import/export — **plus:**

- **Multi-select** sessions with Ctrl/Cmd-click, Shift-click ranges, or the keyboard
- **Full keyboard navigation** of the session list — move, extend, select-all, restore, and delete without touching the mouse
- **Bulk delete** with a single **"undo all"** — clear out dozens of stale auto-saves at once, and still get them back if you misclick
- An **"N selected" summary** panel so you always know what a bulk action will hit

### Keyboard & selection reference

| Input | Action |
|---|---|
| Click | Select one session |
| Ctrl/Cmd + Click | Toggle one session in/out of the selection |
| Shift + Click | Select the range from the anchor to the clicked row |
| ↑ / ↓ | Move the selection |
| Shift + ↑ / ↓ | Extend the selection |
| Space | Toggle the focused row |
| Ctrl/Cmd + A | Select all visible sessions (respects filter/search) |
| Delete / Backspace | Delete the selection (confirms when more than one) |
| Esc | Collapse back to a single selection |
| Enter / Shift + Enter | Restore the selected session |

---

## Status

This is a **personal fork**, built and used on **Firefox (Linux)**. A few things to know:

- **Firefox only, for now.** This fork targets Firefox and nothing else; Chrome/Edge may come later. If you need those today, the [original Tab Session Manager](https://addons.mozilla.org/firefox/addon/tab-session-manager/) is on the Firefox, Chrome, and Edge stores.
- **Not on the add-on stores.** You install it yourself (below).
- **Cloud sync is disabled** in local builds — it relies on API keys that aren't part of the source. Local saving, restoring, auto-save, and everything above work normally.
- **No telemetry.** Sessions are stored by the browser, on your machine.

---

## Installing

### Try it (temporary)

1. Build it (see [Developing](#developing)), or use an existing `dev/firefox` build.
2. Firefox → `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json` inside `dev/firefox`.

Temporary add-ons unload when Firefox restarts.

### Keep it (permanent)

Firefox won't permanently install an unsigned extension, so sign it through Mozilla as an **unlisted** (self-distributed) add-on — automated, free, and it keeps your normal Firefox:

```bash
npm install -g web-ext
cd dev/firefox
web-ext sign --channel=unlisted --api-key="user:XXXX:YY" --api-secret="ZZZZ"
```

Then install the resulting `.xpi` via `about:addons` → ⚙ → **Install Add-on From File**. (API keys come from AMO → Developer Hub → *Manage API Keys*.)

---

## Developing

> Target: Node 24.13.0 / npm 11.7.0 — builds fine on Node 22+ with a harmless engine warning.

```bash
git clone https://github.com/superuser-miguel/Tab-Session-Garrison
cd Tab-Session-Garrison

# Cloud-sync credentials are gitignored and absent from the repo.
# A stub lets the build complete (cloud sync stays off locally):
printf 'export const clientId = "";\nexport const clientSecret = "";\n' > src/credentials.js

npm install
npm run watch-dev      # rebuilds on save; output lands in dev/firefox
```

Load `dev/firefox/manifest.json` via **about:debugging** (see [Installing](#installing)).

---

## Roadmap

Planned, not yet built:

- **Richer backups** — write outside the Downloads folder, with timestamping, rotation, and compression
- **Duplicate cleanup** — collapse the near-identical snapshots that pile up from frequent auto-saving
- **Theme-matching popup** — follow the active Firefox theme's colors
- **Branding** — logo, icons, and screenshots of its own
- **Chrome / Edge** — possibly, further down the line

---

## Credit

Tab Session Garrison stands entirely on [**Tab Session Manager**](https://github.com/sienori/Tab-Session-Manager) by **Sienori** (forked at v7.3.0) — all of the core functionality is theirs. If you want a polished, signed, cross-browser, actively maintained session manager, install the original and **[support Sienori's work](https://www.patreon.com/sienori)**. This fork just adds keyboard ergonomics on top.

## License

[Mozilla Public License 2.0](LICENSE) — the same license as the upstream project.
Copyright © 2017– Sienori and contributors. Fork modifications © 2026 superuser-miguel.
