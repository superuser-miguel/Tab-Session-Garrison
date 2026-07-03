import browser from "webextension-polyfill";
import { zipSync, strToU8 } from "fflate";
import log from "loglevel";

// Tab Session Garrison — compression + write helpers for the backup engine.
//
// Zips are built here at write time from the extension's own session data
// (fflate, service-worker-safe, no disk reads). This fork is Firefox-only, so
// URL.createObjectURL is available in the background context and no offscreen
// document is needed (unlike Chrome MV3).

const logDir = "background/backupZip";

// Build a .zip (Uint8Array) from a map of { entryName: stringContent }.
export const buildZip = files => {
  const entries = {};
  for (const [name, content] of Object.entries(files)) {
    entries[name] = strToU8(content);
  }
  return zipSync(entries, { level: 6 });
};

// Write bytes into the download folder and return the downloads id (or undefined
// on failure). The object URL is revoked once the download settles, so a blob
// isn't held alive longer than the write.
export const writeBackupFile = async (bytes, filename, mimeType = "application/zip") => {
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  try {
    const downloadId = await browser.downloads.download({
      url,
      filename,
      conflictAction: "uniquify",
      saveAs: false
    });
    revokeOnComplete(downloadId, url);
    return downloadId;
  } catch (e) {
    log.error(logDir, "writeBackupFile()", filename, e);
    URL.revokeObjectURL(url);
    return undefined;
  }
};

const revokeOnComplete = (downloadId, url) => {
  const listener = delta => {
    if (delta.id !== downloadId) return;
    if (delta.state?.current === "complete" || delta.error) {
      URL.revokeObjectURL(url);
      browser.downloads.onChanged.removeListener(listener);
    }
  };
  browser.downloads.onChanged.addListener(listener);
};
