import browser from "webextension-polyfill";
import log from "loglevel";
import { showBadge, hideBadge } from "./setBadge";

// Makes failed saves visible. Saves used to fail silently: the error only
// went to the debug log, so a broken database could stop every auto-save
// without the user noticing (upstream TSM #1667). Now a failure shows a red
// "!" on the toolbar icon and a notice in the popup; the next successful save
// clears both.
const logDir = "background/saveHealth";
const KEY = "saveFailure";
const ERROR_COLOR = "#d70022";

// undefined = not read yet this background wake, null = no failure.
let current;

const load = async () => {
  if (current === undefined) {
    current = (await browser.storage.local.get(KEY))[KEY] || null;
  }
  return current;
};

export const reportSaveFailure = async error => {
  try {
    const previous = await load();
    current = {
      since: previous?.since || Date.now(),
      last: Date.now(),
      count: (previous?.count || 0) + 1,
      message: String(error?.message || error?.name || error || "Unknown error")
    };
    await browser.storage.local.set({ [KEY]: current });
    showBadge("!", ERROR_COLOR);
  } catch (e) {
    log.error(logDir, "reportSaveFailure()", e);
  }
};

export const reportSaveSuccess = async () => {
  try {
    if ((await load()) === null) return;
    current = null;
    await browser.storage.local.remove(KEY);
    hideBadge();
  } catch (e) {
    log.error(logDir, "reportSaveSuccess()", e);
  }
};

// The badge doesn't survive a browser restart; put it back if saves are
// still failing.
export const restoreSaveFailureBadge = async () => {
  try {
    if (await load()) showBadge("!", ERROR_COLOR);
  } catch (e) {
    log.error(logDir, "restoreSaveFailureBadge()", e);
  }
};
