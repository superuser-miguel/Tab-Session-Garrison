// Keyboard regression test: presses real keys in the popup (headless Firefox,
// demo data) and checks the result. Run before each release:
//   npm run build            (repo root)
//   node keytest.js          (this folder)
// Exits non-zero if any check fails.
const { start, sleep, By, Key, BASE } = require("./harness");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? `  (${detail})` : ""}`);
};

async function main() {
  const h = await start(process.argv[2] || undefined);
  const { driver, evaluate, openPopup, clickRow, goExt } = h;

  const press = async (...keys) => {
    await driver.switchTo().activeElement().sendKeys(...keys);
    await sleep(350);
  };
  const withMods = async (mods, key) => {
    let a = driver.actions();
    for (const m of mods) a = a.keyDown(m);
    a = a.sendKeys(key);
    for (const m of [...mods].reverse()) a = a.keyUp(m);
    await a.perform();
    await sleep(400);
  };
  const state = () =>
    driver.executeScript(`
      const rows = [...document.querySelectorAll(".sessionItem")]
        .sort((a, b) => Number(a.style.order) - Number(b.style.order));
      const names = rows.map(r => r.querySelector(".name").textContent.trim());
      const sel = document.querySelector(".sessionItem.isSelected .name");
      const input = document.querySelector("#searchBar input");
      const a = document.activeElement;
      return {
        names,
        selected: sel ? sel.textContent.trim() : null,
        multi: document.querySelectorAll(".sessionItem.isMultiSelected").length,
        searchOpen: !!input,
        searchValue: input ? input.value : null,
        modalOpen: !!document.querySelector("#modalBackground.isOpen"),
        modalHasKeys: !!document.querySelector("#modal .keyboardReference"),
        modalInput: (document.querySelector("#modal input") || {}).value ?? null,
        menuOpen: !!document.querySelector("#menu"),
        focus: a.classList.contains("tabButton") ? "tab" :
               a.closest("#sessionsArea") ? "list" :
               a.tagName === "INPUT" ? "input" : a.tagName + "." + a.className
      };`);

  try {
    await openPopup(1200, 720);
    let s = await state();
    const total = s.names.length;
    await clickRow(s.names[0]);

    // --- moving the selection
    await press(Key.ARROW_DOWN);
    s = await state();
    check("↓ moves to the next session", s.selected === s.names[1], s.selected);
    await press(Key.END);
    s = await state();
    check("End jumps to the last session", s.selected === s.names[total - 1], s.selected);
    await press(Key.HOME);
    s = await state();
    check("Home jumps to the first session", s.selected === s.names[0], s.selected);
    await press(Key.PAGE_DOWN);
    s = await state();
    check("PgDn moves several rows", s.names.indexOf(s.selected) > 1, s.selected);
    await press(Key.HOME);

    // --- extending and clearing the selection
    await withMods([Key.SHIFT], Key.ARROW_DOWN);
    await withMods([Key.SHIFT], Key.ARROW_DOWN);
    s = await state();
    check("Shift+↓ extends the selection", s.multi === 3, `multi=${s.multi}`);
    await withMods([Key.SHIFT], Key.END);
    s = await state();
    check("Shift+End extends to the end", s.multi === total, `multi=${s.multi}`);
    await press(Key.ESCAPE);
    s = await state();
    check("Esc goes back to one selected", s.multi === 1, `multi=${s.multi}`);
    await withMods([Key.CONTROL], "a");
    s = await state();
    check("Ctrl+A selects everything", s.multi === total, `multi=${s.multi}`);
    await press(Key.ESCAPE);
    await press(Key.HOME);

    // --- type-to-search
    await withMods([Key.SHIFT], "'"); // the " key on a US layout
    s = await state();
    check('Typing " opens search with the quote in it', s.searchOpen && s.searchValue === '"', JSON.stringify(s.searchValue));
    await press('release notes"');
    await sleep(500);
    s = await state();
    check('"release notes" leaves 3 sessions', s.names.length === 3, `rows=${s.names.length}`);
    await press(Key.ESCAPE);
    s = await state();
    check("Esc in search clears the text first", s.searchOpen && s.searchValue === "", JSON.stringify(s.searchValue));
    await press(Key.ESCAPE);
    s = await state();
    check("Second Esc closes search and returns to the list", !s.searchOpen && s.focus === "list", s.focus);

    await withMods([Key.SHIFT], "k");
    s = await state();
    check("A capital letter opens search", s.searchOpen && s.searchValue === "K", JSON.stringify(s.searchValue));
    await press(Key.ESCAPE, Key.ESCAPE);

    await press(Key.ALT);
    await press(Key.F4);
    s = await state();
    check("Alt or F-keys don't open search", !s.searchOpen);

    await press("/");
    s = await state();
    check("/ opens an empty search", s.searchOpen && s.searchValue === "", JSON.stringify(s.searchValue));
    await press("rust", Key.ARROW_DOWN);
    s = await state();
    check("↓ in search goes to the first result", s.focus === "list" && /rust/i.test(s.selected || ""), `${s.focus} ${s.selected}`);
    await clickRow(s.selected);
    await driver.findElement(By.css("#searchBar input")).click();
    await press(Key.ESCAPE, Key.ESCAPE);

    // --- cheat sheet, rename, tag, menu
    await clickRow((await state()).names[0]);
    await withMods([Key.SHIFT], "/"); // "?"
    s = await state();
    check("? shows the list of keys", s.modalOpen && s.modalHasKeys);
    await press(Key.ESCAPE);
    s = await state();
    check("Esc closes a dialog", !s.modalOpen);

    await press(Key.F2);
    s = await state();
    check("F2 opens rename with the current name", s.modalOpen && s.modalInput === s.selected, `${s.modalInput}`);
    await press(Key.ESCAPE);
    await withMods([Key.SHIFT], Key.F2);
    s = await state();
    check("Shift+F2 opens Add tag", s.modalOpen && s.modalInput === "", `${s.modalInput}`);
    await press(Key.ESCAPE);

    await withMods([Key.SHIFT], Key.F10);
    s = await state();
    check("Shift+F10 opens the session menu", s.menuOpen);
    await press(Key.ARROW_DOWN);
    const menuFocus = await driver.executeScript("return document.activeElement.closest('#menu') !== null");
    check("↓ moves inside the menu", menuFocus);
    await press(Key.ESCAPE);
    s = await state();
    check("Esc closes the menu", !s.menuOpen);

    // --- tab list
    await clickRow("Kyoto trip planning");
    await press(Key.ARROW_RIGHT);
    s = await state();
    check("→ moves into the tab list", s.focus === "tab", s.focus);
    const t1 = await driver.executeScript("return document.activeElement.textContent");
    await press(Key.ARROW_DOWN);
    const t2 = await driver.executeScript("return document.activeElement.textContent");
    check("↓ moves to the next tab", t1 !== t2 && (await state()).focus === "tab");
    await press(Key.ARROW_LEFT);
    s = await state();
    check("← goes back to the session list", s.focus === "list", s.focus);

    // --- delete + undo/redo
    await clickRow("Weeknight dinners");
    const before = (await state()).names.length;
    await press(Key.DELETE);
    await sleep(800);
    s = await state();
    check("Delete removes the session", s.names.length === before - 1 && !s.names.includes("Weeknight dinners"));
    await withMods([Key.CONTROL], "z");
    await sleep(1000);
    s = await state();
    check("Ctrl+Z brings it back", s.names.includes("Weeknight dinners"), `rows=${s.names.length}`);
    await withMods([Key.CONTROL, Key.SHIFT], "z");
    await sleep(1000);
    s = await state();
    check("Ctrl+Shift+Z deletes it again", !s.names.includes("Weeknight dinners"));
    await withMods([Key.CONTROL], "z");
    await sleep(800);

    // --- other pages
    await goExt("/options/index.html#shortcuts");
    const kbdCount = await driver.executeScript("return document.querySelectorAll('.popupKeys kbd').length");
    check("Settings → Shortcuts lists the popup keys", kbdCount > 25, `kbd=${kbdCount}`);

    await goExt("/replaced/index.html?state=open_faild&title=Example&url=https%3A%2F%2Fexample.org&favIconUrl=&theme=dark&reason=Illegal%20URL");
    const reason = await driver.executeScript("return document.querySelector('.replacedPageReason').textContent");
    check('"Can not be opened" page shows the reason', /Illegal URL/.test(reason), reason);

    await evaluate(() =>
      browser.storage.local.set({ saveFailure: { since: Date.now(), last: Date.now(), count: 3, message: "QuotaExceededError" } })
    );
    await openPopup(1200, 720);
    const note = await driver.executeScript("const n = document.querySelector('.notification .message'); return n ? n.textContent : ''");
    check("Failed saves show a notice in the popup", /QuotaExceededError/.test(note), note);
    await evaluate(() => browser.storage.local.remove("saveFailure"));
  } finally {
    await driver.quit();
  }

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
