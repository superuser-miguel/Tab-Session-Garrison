// Shared setup for the screenshot and keyboard-test scripts: a throwaway
// headless Firefox with the built extension installed and the demo sessions
// imported. Your real Firefox profiles are never touched.
const fs = require("fs");
const path = require("path");
const { Builder, By, Key, until } = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");

const HERE = __dirname;
const REPO = path.resolve(__dirname, "../..");
const GECKODRIVER = path.join(HERE, "bin/geckodriver-0.37.1");
const ADDON_ID = "tab-session-garrison@superuser-miguel";
const UUID = "5e55a0de-7a65-4c1e-9a11-000000000042";
const BASE = `moz-extension://${UUID}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));


async function start(srcExt = path.join(REPO, "temp/firefox")) {
  const SRC_EXT = srcExt;
  // fresh copy of the build + throwaway profile, both inside the scratch folder
  const work = path.join(HERE, "work");
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const ext = path.join(work, "ext");
  fs.cpSync(SRC_EXT, ext, { recursive: true });
  const demo = JSON.parse(fs.readFileSync(path.join(HERE, "demo-sessions.json"), "utf8"));

  process.env.TMPDIR = work; // selenium/geckodriver put the temp profile in TMPDIR
  const opts = new firefox.Options()
    .setBinary("/usr/bin/firefox")
    .addArguments("-headless")
    .setPreference("extensions.webextensions.uuids", JSON.stringify({ [ADDON_ID]: UUID }))
    .setPreference("browser.tabs.groups.enabled", true)
    .setPreference("ui.systemUsesDarkTheme", 1);
  // --allow-system-access: Firefox refuses remote navigation to moz-extension:// otherwise
  const service = new firefox.ServiceBuilder(GECKODRIVER).addArguments("--allow-system-access");
  const driver = await new Builder()
    .forBrowser("firefox")
    .setFirefoxOptions(opts)
    .setFirefoxService(service)
    .build();

  const evaluate = (fn, arg) =>
    driver.executeAsyncScript(
      `const done = arguments[arguments.length - 1];
       Promise.resolve((${fn.toString()})(arguments[0])).then(done, e => done("ERR " + e));`,
      arg
    );
  const setViewport = async (w, h) => {
    for (let i = 0; i < 4; i++) {
      const [iw, ih] = await driver.executeScript("return [innerWidth, innerHeight]");
      if (iw === w && ih === h) return;
      const r = await driver.manage().window().getRect();
      await driver.manage().window().setRect({ width: r.width + (w - iw), height: r.height + (h - ih) });
      await sleep(300);
    }
  };
  const goExt = async rel => {
    await driver.get("about:blank");
    await driver.get(BASE + rel);
    await sleep(1200);
  };
  const parkMouse = async () => {
    // move the pointer to a neutral spot so no hover states leak into shots
    const [iw, ih] = await driver.executeScript("return [innerWidth, innerHeight]");
    await driver.actions().move({ origin: "viewport", x: iw - 15, y: ih - 15 }).perform();
  };
  const openPopup = async (w, h) => {
    await setViewport(w, h);
    await goExt("/popup/index.html#inTab");
    await driver.wait(until.elementLocated(By.css(".sessionItem")), 20000);
    await sleep(1200);
    // the save box pre-fills with the active tab's title, i.e. this very page
    await driver.executeScript("const i = document.querySelector('#saveArea input'); if (i) i.value = '';");
  };
  const clickRow = async (name, ctrl = false) => {
    for (const r of await driver.findElements(By.css(".sessionItem"))) {
      const t = (await r.findElement(By.css(".name")).getText()).trim();
      if (t === name) {
        const target = await r.findElement(By.css(".name"));
        await driver.executeScript("arguments[0].scrollIntoView({block: 'nearest'})", target);
        if (ctrl)
          await driver.actions().keyDown(Key.CONTROL).click(target).keyUp(Key.CONTROL).perform();
        else await target.click();
        await sleep(500);
        return;
      }
    }
    throw new Error("row not found: " + name);
  };

  await driver.installAddon(ext, true);
  await sleep(2500);
  // onInstalled may open the options page in another tab; keep only one tab
  const handles = await driver.getAllWindowHandles();
  for (const h of handles.slice(1)) {
    await driver.switchTo().window(h);
    await driver.close();
  }
  await driver.switchTo().window(handles[0]);
  await setViewport(1280, 800);
  await goExt("/popup/index.html#inTab");

  // Quiet the auto-savers so the throwaway browser adds no sessions of its own,
  // then wipe and import the demo data.
  console.log(
    await evaluate(async () => {
      const { Settings = {} } = await browser.storage.local.get("Settings");
      Object.assign(Settings, {
        ifAutoSave: false,
        ifAutoSaveWhenClose: false,
        ifAutoSaveWhenExitBrowser: false,
        isShowOptionsPageWhenUpdated: false,
        shouldSaveDeviceName: false,
        ifBackup: false,
        filterValue: "_displayAll",
        sortValue: "newest"
      });
      await browser.storage.local.set({ Settings });
      await browser.runtime.sendMessage({ message: "deleteAllSessions" });
      return "settings ok";
    })
  );
  await sleep(800);
  await evaluate(
    data => browser.runtime.sendMessage({ message: "import", importSessions: data }),
    demo
  );
  let n = 0;
  for (let i = 0; i < 60; i++) {
    n = await evaluate(
      async () => (await browser.runtime.sendMessage({ message: "getSessions" })).length
    );
    if (n >= demo.length) break;
    await sleep(500);
  }
  console.log("sessions in store:", n);

  return { driver, evaluate, setViewport, goExt, parkMouse, openPopup, clickRow, demo };
}

module.exports = { start, sleep, By, Key, until, REPO, BASE };
