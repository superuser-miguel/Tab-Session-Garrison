// Screenshot harness for Tab Session Garrison (selenium-webdriver + geckodriver).
// Usage: node shoot.js [extDir] [outDir]
//   extDir default: <repo>/temp/firefox   (run `npm run build` in the repo first)
//   outDir default: <repo>/docs/screenshots
//   ONLY=list-and-details,settings node shoot.js   → only some shots
// Note: puppeteer/WebDriver-BiDi can't drive moz-extension:// pages
// ("privileged scope"), classic WebDriver (Marionette) can.
const fs = require("fs");
const path = require("path");
const { start, sleep, By, Key, REPO } = require("./harness");

const SRC_EXT = process.argv[2] || undefined;
const OUT = process.argv[3] || path.join(REPO, "docs/screenshots");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { driver, evaluate, setViewport, goExt, parkMouse, openPopup, clickRow } = await start(
    SRC_EXT
  );
  const save = async (name, el) => {
    const b64 = el ? await el.takeScreenshot() : await driver.takeScreenshot();
    const file = path.join(OUT, name);
    fs.writeFileSync(file, Buffer.from(b64, "base64"));
    console.log("wrote", file);
  };

  try {
    const want = name => !ONLY || ONLY.includes(name);
    const sizes = { readme: [1200, 720], amo: [1280, 800] };

    for (const [variant, [w, h]] of Object.entries(sizes)) {
      const sfx = variant === "amo" ? "-amo" : "";

      if (want("list-and-details")) {
        await openPopup(w, h);
        await clickRow("Kyoto trip planning");
        await parkMouse();
        await sleep(600);
        await save(`list-and-details${sfx}.png`);
      }

      if (want("multi-select")) {
        await openPopup(w, h);
        await clickRow("Kyoto trip planning");
        await clickRow("Weeknight dinners", true);
        await clickRow("Release prep — v2.4", true);
        await clickRow("Rust Book — Ownership", true);
        await parkMouse();
        await sleep(400);
        await save(`multi-select${sfx}.png`);
      }

      if (want("phrase-search")) {
        await openPopup(w, h);
        await driver.findElement(By.css(".searchButton")).click();
        await sleep(400);
        const input = await driver.findElement(By.css("#searchBar input"));
        await input.sendKeys('"release notes"');
        await input.sendKeys(Key.ENTER);
        await sleep(1500);
        await clickRow("Release prep — v2.4");
        await parkMouse();
        await sleep(400);
        await save(`phrase-search${sfx}.png`);
      }

      if (variant === "amo") continue; // shots 4–5 are README-only

      if (want("session-types")) {
        await openPopup(w, h);
        await clickRow("MDN — Fetch API");
        await parkMouse();
        await sleep(300);
        await save("session-types.png", await driver.findElement(By.css(".column.sidebar")));
      }

      if (want("settings")) {
        // show the auto-savers ON (their defaults) — they were only switched off
        // so the throwaway browser wouldn't save sessions of its own
        await evaluate(async () => {
          const { Settings } = await browser.storage.local.get("Settings");
          Object.assign(Settings, { ifAutoSave: true, ifAutoSaveWhenClose: true, ifAutoSaveWhenExitBrowser: true });
          await browser.storage.local.set({ Settings });
        });
        await setViewport(w, h);
        await goExt("/options/index.html#settings");
        await sleep(800);
        // scroll so the "Auto save" card is the focused one, with the dimmed
        // neighbouring cards visible above and below
        await driver.executeScript(`
          const t = [...document.querySelectorAll(".categoryTitle")]
            .find(e => e.textContent.trim().toLowerCase() === "auto save");
          if (t) window.scrollTo(0, t.closest(".categoryContainer").getBoundingClientRect().top + scrollY - 110);
        `);
        await sleep(1000);
        await save("settings.png");
      }
    }
  } finally {
    await driver.quit();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
