import browser from "webextension-polyfill";
import log from "loglevel";

// Tab Session Garrison — record of backup files this extension has written.
//
// An extension can't read the download folder back off disk, so to ever manage
// (e.g. roll loose incremental files into a zip and remove the redundant copies)
// the files it created, it has to remember what it wrote. This manifest, kept in
// storage.local under its own key, is that memory: for each backup file we keep
// the downloads API id (so we can later downloads.removeFile it) plus metadata.

const logDir = "background/backupManifest";
const KEY = "BackupManifest";

// shape: { complete: [entry], session: { [sessionId]: entry }, incremental: [entry] }
// entry: { downloadId, filename, time, ...tierSpecific }
const emptyManifest = () => ({ complete: [], session: {}, incremental: [] });

export const getManifest = async () => {
  const res = await browser.storage.local.get(KEY);
  return { ...emptyManifest(), ...(res[KEY] || {}) };
};

export const saveManifest = async manifest => {
  await browser.storage.local.set({ [KEY]: manifest });
};

// Append an entry to a list-shaped tier (complete / incremental).
export const addEntry = async (tier, entry) => {
  const manifest = await getManifest();
  if (!Array.isArray(manifest[tier])) manifest[tier] = [];
  manifest[tier].push(entry);
  await saveManifest(manifest);
  log.log(logDir, "addEntry()", tier, entry.filename);
};

// Delete backup files we previously wrote, by downloads id, and drop them from
// the manifest. Failures (record already gone, file moved) are non-fatal — we
// just forget the entry. Returns the entries actually removed.
export const removeFiles = async (entries = []) => {
  for (const entry of entries) {
    try {
      await browser.downloads.removeFile(entry.downloadId);
    } catch (e) {
      log.warn(logDir, "removeFiles() could not remove file", entry.filename, e);
    }
    try {
      await browser.downloads.erase({ id: entry.downloadId });
    } catch (e) {
      // erasing the history record is best-effort
    }
  }
  return entries;
};
