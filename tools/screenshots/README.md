# Screenshot harness

Takes the README, landing-page and AMO screenshots from fictional demo data, in
headless Firefox with a throwaway profile. Your real Firefox profiles are never touched.

```bash
npm run build                       # in the repo root: refreshes temp/firefox
cd tools/screenshots
npm install                         # first time only (selenium-webdriver + geckodriver)
node shoot.js                       # writes into docs/screenshots/
node shoot.js "" ./out              # or into ./out to review first
ONLY=phrase-search,settings node shoot.js "" ./out   # just some shots
```

- `make-demo-data.js` builds `demo-sessions.json` (20 made-up sessions: all four
  session types, tags, tab groups, multi-window sessions). Edit it, then
  `node make-demo-data.js`.
- Shots: `list-and-details`, `multi-select`, `phrase-search` (1200×720, plus 1280×800
  `-amo` versions for the store), `session-types` (a crop of the list), `keyboard`
  (the "?" cheat sheet) and `settings`.

## Keyboard test

`node keytest.js` presses every popup key on the demo data and checks the result
(selection, search, cheat sheet, rename/tag dialogs, menus, tab list, delete + undo,
the Shortcuts page, the "can not be opened" reason and the failed-save notice). Run it
before each release; it exits non-zero on any failure. `harness.js` is the shared setup.
- geckodriver must run with `--allow-system-access` (shoot.js does this), or Firefox
  157+ refuses to open the extension's pages. Puppeteer can't drive extension pages
  in Firefox, which is why this uses Selenium.
- The add-on's UUID is pinned through the `extensions.webextensions.uuids` pref, so
  the `moz-extension://` addresses are fixed.
