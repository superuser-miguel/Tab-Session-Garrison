import browser from "webextension-polyfill";
import moment from "moment";
import log from "loglevel";
import Sessions from "./sessions.js";
import { getSettings, setSettings } from "src/settings/settings";
import exportSessions from "./export.js";
import getSessions from "./getSessions.js";
import { buildZip, writeBackupFile } from "./backupZip.js";
import { addEntry, getManifest } from "./backupManifest.js";

const logDir = "background/backup";

const DEFAULT_BACKUP_FOLDER = "Tab_Session_Garrison_Backup";
// Earlier defaults: upstream Tab Session Manager's, then this fork's first one.
const LEGACY_BACKUP_FOLDERS = ["TabSessionManager - Backup", "Tab Session Garrison - Backup"];

export const backupSessions = async () => {
  if (!getSettings("ifBackup")) return;

  // New backup engine (opt-in, additive). Legacy behavior below is retained
  // untouched until the Session/Incremental tiers replace it.
  if (getSettings("backupComplete")) await backupComplete();

  if (getSettings("individualBackup")) backupIndividualSessions();
  else backupAllSessions();
};

// Cheap signature of the session store (ids + edit times) used to skip a
// Complete snapshot when nothing changed since the previous one.
const getSessionsFingerprint = async () => {
  const sessions = await Sessions.getAll(["id", "lastEditedTime"]).catch(() => []);
  const text = sessions
    .map(s => `${s.id}:${s.lastEditedTime}`)
    .sort()
    .join("|");
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `${sessions.length}:${hash >>> 0}`;
};

// Complete tier: a full, timestamped snapshot of every session, written as a
// single .zip into <backupFolder>/complete/. Kept indefinitely — space is
// managed by compression, not deletion — so a snapshot is only written when
// the sessions changed since the last one.
const backupComplete = async () => {
  log.log(logDir, "backupComplete()");
  const fingerprint = await getSessionsFingerprint();
  const lastEntry = (await getManifest()).complete.slice(-1)[0];
  if (lastEntry?.fingerprint === fingerprint) {
    log.log(logDir, "backupComplete() unchanged, skipped");
    return;
  }

  const sessions = await getSessions().catch(() => {});
  if (!sessions || sessions.length === 0) return;

  const folder = backupBaseFolder();
  const stamp = moment().format("YYYY-MM-DD HH-mm-ss");
  const jsonName = `TSG-complete-${stamp}.json`;
  const zipBytes = buildZip({ [jsonName]: JSON.stringify(sessions, null, "  ") });
  const filename = `${folder}complete/TSG-complete-${stamp}.zip`;

  const downloadId = await writeBackupFile(zipBytes, filename);
  if (downloadId) {
    await addEntry("complete", {
      downloadId,
      filename,
      time: Date.now(),
      sessionsCount: sessions.length,
      fingerprint
    });
  }
};

// Schedule the recurring backup alarm: a first run ~30s after startup, then
// every backupInterval minutes while the browser is open.
export const scheduleBackupAlarm = () => {
  const interval = Number(getSettings("backupInterval")) || 30;
  browser.alarms.create("backupSessions", { delayInMinutes: 0.5, periodInMinutes: interval });
};

// Re-arm the alarm when the interval (or the backup on/off switch) changes, so
// settings take effect without a browser restart.
export const handleBackupSettingsChange = changes => {
  const oldV = changes?.Settings?.oldValue;
  const newV = changes?.Settings?.newValue;
  if (!newV) return;
  if (oldV?.backupInterval !== newV.backupInterval || oldV?.ifBackup !== newV.ifBackup) {
    scheduleBackupAlarm();
  }
};

// Sanitized "<backupFolder>/" prefix for backup file paths. The download folder
// is the only writable location, so backupFolder is always a subpath of it.
const backupBaseFolder = () => {
  const raw = getSettings("backupFolder") || DEFAULT_BACKUP_FOLDER;
  const cleaned = raw
    .replace(/[:?."<>|]/g, "-")
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
  return cleaned ? `${cleaned}/` : "";
};

const backupIndividualSessions = async () => {
  log.log(logDir, "backupIndividualSessions");

  const currentTime = Date.now();
  const lastBackupTime = getSettings("lastBackupTime") || 0;
  const backupFolder = getSettings("backupFolder");
  const labels = {
    regular: browser.i18n.getMessage("regularSaveSessionName"),
    browserExit: browser.i18n.getMessage("browserExitSessionName"),
    winClose: browser.i18n.getMessage("winCloseSessionName"),
    userSave: browser.i18n.getMessage("displayUserLabel")
  };
  const sessions = await Sessions.getAll(["id", "lastEditedTime", "tag"]).catch(() => {});

  for (let session of sessions) {
    if (session.lastEditedTime < lastBackupTime) continue;
    if (session.tag.includes("temp")) continue;

    let folderName = backupFolder;
    if (session.tag.includes("regular")) folderName += `\/${labels.regular}`;
    else if (session.tag.includes("winClose")) folderName += `\/${labels.winClose}`;
    else if (session.tag.includes("browserExit")) folderName += `\/${labels.browserExit}`;
    else folderName += `\/${labels.userSave}`;

    await exportSessions(session.id, folderName, true);
  }

  setSettings("lastBackupTime", currentTime);
};

// Legacy "all sessions" mode writes an uncompressed dump of everything under a
// new timestamped name each run, so it must not follow the periodic alarm —
// limit it to once per browser session, as it behaved before 0.3.0.
const backupAllSessions = async () => {
  const { didBackupAllSessions } = await browser.storage.session.get("didBackupAllSessions");
  if (didBackupAllSessions) return;
  log.log(logDir, "backupAllSessions");
  const folder = getSettings("backupFolder");
  await exportSessions(null, folder, true);
  await browser.storage.session.set({ didBackupAllSessions: true });
};

// One-time move of an untouched legacy default to the current default. A
// folder the user chose themselves is left alone. Existing backup files stay
// where they are; new ones go to the new folder.
export const migrateBackupFolder = async () => {
  if (!LEGACY_BACKUP_FOLDERS.includes(getSettings("backupFolder"))) return;
  log.info(logDir, "migrateBackupFolder()", getSettings("backupFolder"));
  await setSettings("backupFolder", DEFAULT_BACKUP_FOLDER);
};

export const resetLastBackupTime = changes => {
  const oldFolder = changes?.Settings?.oldValue?.backupFolder;
  const newFolder = changes?.Settings?.newValue?.backupFolder;
  // Moving off a legacy default isn't a real destination change: don't
  // re-export every session (thousands of downloads on a large profile).
  const isLegacyFolderMigration =
    LEGACY_BACKUP_FOLDERS.includes(oldFolder) && newFolder === DEFAULT_BACKUP_FOLDER;
  const isChangedBackupSettings =
    (!changes?.Settings?.oldValue?.ifBackup && changes?.Settings?.newValue?.ifBackup) ||
    (oldFolder !== newFolder && !isLegacyFolderMigration);
  if (isChangedBackupSettings) setSettings("lastBackupTime", 0);
};
