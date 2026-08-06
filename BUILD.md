# Building from source

Tab Session Garrison is bundled with **webpack**, and the shipped JavaScript is minified.
This document is the build instruction set that accompanies the source archive submitted
to addons.mozilla.org, and it is enough to reproduce the reviewed package from scratch.

For cutting and signing a release, see [RELEASING.md](RELEASING.md). For what the code
does, see [README.md](README.md).

## Build environment

| | |
|---|---|
| Operating system | Linux (Fedora 44). macOS and Windows also work — nothing in the build is platform-specific. |
| Node.js | **22.22.2** — the exact version used to produce the submitted package |
| npm | **10.9.7** |
| Extra tooling | None. No global installs, no native toolchain, no network access beyond `npm install`. |

Every other dependency is pinned in [`package-lock.json`](package-lock.json) and installed
locally into `node_modules/`.

## Build

From the root of the extracted source archive:

```bash
npm install     # installs exactly what package-lock.json pins
npm run build   # webpack --config webpack.config.dist.js
```

The build takes well under a minute and needs no configuration, environment variables, or
credentials.

## Output

`npm run build` writes three things:

| Path | What it is |
|---|---|
| `temp/firefox/` | The unpacked Firefox extension — **this is the reviewed add-on** |
| `dist/tab_session_garrison-for-firefox-<version>.zip` | The same tree, zipped. The submitted `.xpi` is this file after Mozilla's signer adds `META-INF/`. |
| `dist/tab_session_garrison-for-chrome-<version>.zip` | The Chrome/Chromium build — not submitted to AMO |
| `dist/copiedSource-tab_session_garrison-<version>.zip` | The source archive itself, regenerated |

## Verifying the build against the submitted package

The build is deterministic: extracting this archive into an empty directory and running
`npm install && npm run build` produces a `temp/firefox/` tree **byte-for-byte identical**
to the one the submitted package was built from.

Compare the built tree against the contents of the submitted `.xpi` (which is a zip):

```bash
mkdir -p /tmp/tsg-submitted
unzip -q tab_session_garrison-<version>.xpi -d /tmp/tsg-submitted
diff -r temp/firefox /tmp/tsg-submitted -x 'META-INF' -x 'mozilla-recommendation.json'
```

Expected differences, all added by Mozilla's signer and absent from a local build:

- `META-INF/manifest.mf`, `META-INF/mozilla.rsa`, `META-INF/mozilla.sf`, `META-INF/cose.manifest`,
  `META-INF/cose.sig` — the signature itself
- `mozilla-recommendation.json`, if present

The JavaScript bundles are minified but not obfuscated: webpack in `mode: "production"`
runs Terser with default settings, and there is no source-level transformation beyond
Babel (see [`babel.config.js`](babel.config.js)) and the SCSS/SVG loaders configured in
[`webpack.config.dist.js`](webpack.config.dist.js).

## How the Firefox build differs from the Chrome build

Both browsers build from the same `src/` tree. The only divergence is the manifest:
`webpack.utils.js` copies `src/manifest-ff.json` into the Firefox output as `manifest.json`,
and `src/manifest.json` into the Chrome output. Everything else — every component, every
locale — is shared.

## Source layout

| Path | Contents |
|---|---|
| `src/background/` | Background service worker: saving, restoring, auto-save, backup, undo |
| `src/popup/` | The session list UI (React) |
| `src/options/` | The settings, sessions, and shortcuts pages (React) |
| `src/common/` | Helpers shared between background and UI |
| `src/settings/` | Setting definitions and storage access |
| `src/_locales/` | Translations — 34 locales |
| `src/icons/` | Icon and logo assets |
