# Releasing (self-distributed, auto-updating)

Tab Session Garrison is distributed **privately** as an **unlisted** (self-signed)
Firefox add-on. It is *not* on addons.mozilla.org — nothing is published, listed,
or human-reviewed. Firefox still keeps it up to date automatically by polling
[`updates.json`](updates.json) in this repo (wired via
`browser_specific_settings.gecko.update_url` in `src/manifest-ff.json`).

Signing goes through Mozilla's signer only to obtain the cryptographic signature
Firefox requires; your code is uploaded to the signer but never made public.

## One-time setup

1. Get AMO API credentials: <https://addons.mozilla.org/developers/addon/api/key/>
   Export them per shell session — **do not commit them**:
   ```bash
   export AMO_JWT_ISSUER="user:XXXXX:YYY"
   export AMO_JWT_SECRET="ZZZZ..."
   ```
2. `npm install -g web-ext`

## Cut a release

1. **Bump the version** in *both* manifests (keep them equal, SemVer, higher than
   the last release):
   - `src/manifest-ff.json` → `"version"`
   - `src/manifest.json` → `"version"`

2. **Production build:**
   ```bash
   npm run build
   ```
   Unpacked Firefox build → `temp/firefox`; zip → `dist/tab_session_garrison-for-firefox-<v>.zip`.

3. **Sign it (unlisted).** Uploads to AMO's signer and returns a signed `.xpi`;
   nothing is published:
   ```bash
   web-ext sign \
     --source-dir temp/firefox \
     --channel unlisted \
     --api-key "$AMO_JWT_ISSUER" \
     --api-secret "$AMO_JWT_SECRET"
   ```
   The signed `.xpi` lands in `web-ext-artifacts/`.
   *(If `temp/firefox` isn't present, unzip the `dist` zip into a folder and point
   `--source-dir` at that.)*

4. **Publish the `.xpi` on a GitHub Release.** Rename it to
   `tab_session_garrison-<v>.xpi` so the URL matches `updates.json`:
   ```bash
   mv web-ext-artifacts/*.xpi tab_session_garrison-<v>.xpi
   gh release create v<v> tab_session_garrison-<v>.xpi --title "v<v>" --notes "…"
   ```

5. **Point `updates.json` at it.** Add a new entry at the **top** of the `updates`
   array and commit to `main`:
   ```json
   { "version": "<v>", "update_link": "https://github.com/superuser-miguel/Tab-Session-Garrison/releases/download/v<v>/tab_session_garrison-<v>.xpi" }
   ```

6. Firefox picks it up within ~24 h, or force it: **about:addons → gear ⚙ →
   Check for Updates**.

## First install (once)

Install the `v0.1.0` `.xpi` manually: **about:addons → ⚙ → Install Add-on From
File**. After that, every future release updates automatically via `updates.json`.

## Invariants — never change these

- The add-on **id** (`tab-session-garrison@superuser-miguel`) and the
  **`update_url`** must stay stable forever, or existing installs stop updating.
- `update_hash` (sha256) is **optional** here because releases are served over
  HTTPS; add it if you want tamper-verification.
