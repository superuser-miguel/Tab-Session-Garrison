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

    // --- copy links (the clipboard is caught, not really written)
    await driver.executeScript(
      "window.__clip = []; navigator.clipboard.writeText = t => (window.__clip.push(t), Promise.resolve());"
    );
    const lastCopy = () => driver.executeScript("return window.__clip[window.__clip.length - 1] || ''");
    const notice = () =>
      driver.executeScript("const n = document.querySelector('.notification .message'); return n ? n.textContent : ''");
    await clickRow("Kyoto trip planning");
    await press(Key.ARROW_RIGHT);
    await withMods([Key.CONTROL], "c");
    check("Ctrl+C on a tab copies its link", (await lastCopy()) === "https://www.rome2rio.com/s/Tokyo/Kyoto", await lastCopy());
    check('…and says "Copied 1 link"', /Copied 1 link/.test(await notice()), await notice());
    await press(Key.ARROW_UP);
    const onHeader = await driver.executeScript("return document.activeElement.classList.contains('groupHeader')");
    check("↑ from a group's first tab reaches the group header", onHeader);
    await withMods([Key.CONTROL], "c");
    check("Ctrl+C on a group header copies the group's links",
      (await lastCopy()) === "https://www.rome2rio.com/s/Tokyo/Kyoto\nhttps://www.kayak.com/flight-routes/HND", await lastCopy());
    await withMods([Key.CONTROL, Key.SHIFT], "c");
    check("Ctrl+Shift+C copies Markdown", /^- \[Tokyo to Kyoto by Shinkansen/.test(await lastCopy()), await lastCopy());
    const header = await driver.findElement(By.css(".groupHeader"));
    await driver.actions().contextClick(header).perform();
    await sleep(400);
    const menuText = await driver.executeScript("const m = document.querySelector('#menu'); return m ? m.textContent : ''");
    check("Right-clicking a group header offers Copy 2 links", /Copy 2 links/.test(menuText), menuText);
    await press(Key.ESCAPE);
    await press(Key.ARROW_LEFT);
    await withMods([Key.CONTROL], "c");
    check("Ctrl+C in the session list copies the whole session",
      (await lastCopy()).split("\n").length === 14, `${(await lastCopy()).split("\n").length} lines`);

    // --- add links (a real Ctrl+C from a scratch text box, then Ctrl+V)
    const setClipboard = async text => {
      await driver.executeScript(
        "const t = document.createElement('textarea'); t.id = '__clipsrc'; t.value = arguments[0];" +
          "document.body.appendChild(t); t.focus(); t.select();",
        text
      );
      await withMods([Key.CONTROL], "c");
      await driver.executeScript("document.getElementById('__clipsrc').remove()");
    };
    const dialog = () =>
      driver.executeScript(`
        const m = document.querySelector("#modalBackground.isOpen");
        if (!m) return null;
        return {
          title: m.querySelector(".modalTitle").textContent,
          facts: [...m.querySelectorAll(".addLinksModalContent .facts li")].map(li => li.textContent),
          button: (m.querySelector(".addLinksModalContent .saveButton") || {}).textContent
        };`);
    const groupSize = name =>
      driver.executeScript(
        `const h = [...document.querySelectorAll(".groupHeader")].find(h => h.textContent.trim() === arguments[0]);
         if (!h) return -1;
         let n = 0, el = h.nextElementSibling;
         while (el && el.classList.contains("tabContainer") && el.classList.contains("inGroup")) { n++; el = el.nextElementSibling; }
         return n;`,
        name
      );

    await clickRow("Kyoto trip planning");
    const flightsBefore = await groupSize("Flights");
    await setClipboard("Two more:\nhttps://www.kayak.com/flight-routes/HND\nhttps://www.jal.co.jp/jp/en/");
    await driver.executeScript(
      "[...document.querySelectorAll('.groupHeader')].find(h => h.textContent.trim() === 'Flights').focus()"
    );
    await withMods([Key.CONTROL], "v");
    await sleep(400);
    let d = await dialog();
    check("Ctrl+V on a group header opens Add links for that group", d && /Flights/.test(d.title), JSON.stringify(d));
    check(
      "…which leaves out a link already in the group and ignores plain text",
      d && d.facts.join("|") === "1 link to add|1 is already there, left out|1 line without a link, ignored",
      d && d.facts.join("|")
    );
    await withMods([Key.CONTROL], Key.ENTER);
    await sleep(1200);
    check("Ctrl+Enter adds it to the end of the group", (await groupSize("Flights")) === flightsBefore + 1,
      `${flightsBefore} → ${await groupSize("Flights")}`);
    check('…and says "Added 1 link"', /Added 1 link/.test(await notice()), await notice());
    await withMods([Key.CONTROL], "z");
    await sleep(1200);
    check("Ctrl+Z takes the added link back out", (await groupSize("Flights")) === flightsBefore,
      `${await groupSize("Flights")}`);

    await clickRow("Kyoto trip planning");
    await setClipboard("## Ramen\n- [Ichiran Kyoto](https://ichiran.com/shop/kansai/kyoto/)\n- [Menya Inoichi](https://tabelog.com/en/kyoto/A2601/)");
    await clickRow("Kyoto trip planning");
    await withMods([Key.CONTROL], "v");
    await sleep(400);
    d = await dialog();
    check("Ctrl+V in the session list offers a new session", d && /New session/.test(d.title) && d.button === "Add 2 links", JSON.stringify(d));
    await withMods([Key.CONTROL], Key.ENTER);
    await sleep(1500);
    s = await state();
    check("…which appears in the list, named after the first link", s.names.includes("Ichiran Kyoto"), s.names.slice(0, 3).join(" | "));
    await clickRow("Ichiran Kyoto");
    await sleep(500);
    const ramen = await groupSize("Ramen");
    check("…with the Markdown heading as a tab group", ramen === 2, `group size ${ramen}`);
    await withMods([Key.CONTROL], "z");
    await sleep(1200);

    await clickRow("Kyoto trip planning");
    const windowTitle = await driver.findElement(By.css(".windowTitle"));
    await driver.actions().contextClick(windowTitle).perform();
    await sleep(400);
    await driver.executeScript(
      "[...document.querySelectorAll('#menu button')].find(b => /^Add links/.test(b.textContent)).click()"
    );
    await sleep(500);
    d = await dialog();
    const focusInBox = await driver.executeScript("return document.activeElement.tagName === 'TEXTAREA'");
    check('"Add links…" in the window menu opens an empty box to paste into', d && /window/.test(d.title) && focusInBox,
      JSON.stringify(d));
    await press(Key.ESCAPE);

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
