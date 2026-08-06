# Releasing (AMO-listed)

As of **v0.3.0** Tab Session Garrison is published **publicly on
addons.mozilla.org** (listed channel). Firefox auto-updates installs by checking
AMO directly for the add-on id — no `update_url` and no self-hosted
`updates.json` are involved any more.

Versions ≤ 0.2.1 were self-distributed as **unlisted** signed xpis updating via
[`updates.json`](updates.json). Because the add-on id is unchanged
(`tab-session-garrison@superuser-miguel`), those installs upgrade cleanly to the
listed build and keep their data (IndexedDB + storage.local).
`updates.json` is frozen at 0.2.1 as a migration bridge — never add newer
entries to it, and never re-add `update_url` to `src/manifest-ff.json`
(version numbers are unique per add-on id **across both channels**, so a
parallel self-hosted channel cannot coexist on this id).

## One-time setup

1. Get AMO API credentials: <https://addons.mozilla.org/developers/addon/api/key/>
   Export them per shell session — **do not commit them**:
   ```bash
   export AMO_JWT_ISSUER="user:XXXXX:YYY"
   export AMO_JWT_SECRET="ZZZZ..."
   ```
2. `npm install -g web-ext`

## Cut a release

1. **Bump the version** (keep all three equal, SemVer, higher than any previous
   version on either channel):
   - `src/manifest-ff.json` → `"version"`
   - `src/manifest.json` → `"version"`
   - `package.json` → `"version"`

2. **Production build:**
   ```bash
   npm run build
   ```
   Unpacked Firefox build → `temp/firefox`; zip → `dist/tab_session_garrison-for-firefox-<v>.zip`;
   source archive for AMO review → `dist/copiedSource…zip` (see `BUILD.md`).

3. **Sanity check:** `web-ext lint --source-dir temp/firefox` — expect 0 errors
   (vendor-bundle warnings are known noise).

4. **Submit (listed):**
   ```bash
   web-ext sign \
     --source-dir temp/firefox \
     --channel listed \
     --api-key "$AMO_JWT_ISSUER" \
     --api-secret "$AMO_JWT_SECRET"
   ```
   Because the build is webpack-minified, AMO requires the **source archive** —
   upload the `copiedSource` zip when prompted in the developer hub
   (build instructions for reviewers are in `BUILD.md`).
   Listed versions go through **human review**; the version is live once
   approved. Listing copy drafts live in `AMO-LISTING.md`.

   ⚠️ web-ext caches an upload uuid in `temp/firefox/.amo-upload-uuid` and can
   error with "This upload has already been submitted" **after a successful
   submit**. Don't resubmit blindly — check the version status first:
   `GET https://addons.mozilla.org/api/v5/addons/addon/tab-session-garrison@superuser-miguel/versions/?filter=all_with_unlisted`

5. **Mirror on GitHub** (distribution convenience only — updates still come from
   AMO): download the AMO-signed `.xpi` and attach it to a GitHub Release:
   ```bash
   gh release create v<v> tab_session_garrison-<v>.xpi --title "v<v>" --notes "…"
   ```

## Invariants — never change these

- The add-on **id** (`tab-session-garrison@superuser-miguel`) must stay stable
  forever — it is the identity AMO updates and user data are keyed to.
- No `update_url` in any manifest (not permitted on the listed channel).
- `updates.json` stays frozen at 0.2.1.
