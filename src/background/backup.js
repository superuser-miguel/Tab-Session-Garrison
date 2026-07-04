import browser from "webextension-polyfill";
import moment from "moment";
import log from "loglevel";
import Sessions from "./sessions.js";
import { getSettings, setSettings } from "src/settings/settings";
import exportSessions from "./export.js";
import getSessions from "./getSessions.js";
import { buildZip, writeBackupFile } from "./backupZip.js";
import { addEntry } from "./backupManifest.js";

const logDir = "background/backup";

export const backupSessions = async () => {
  if (!getSettings("ifBackup")) return;

  // New backup engine (opt-in, additive). Legacy behavior below is retained
  // untouched until the Session/Incremental tiers replace it.
  if (getSettings("backupComplete")) await backupComplete();

  if (getSettings("individualBackup")) backupIndividualSessions();
  else backupAllSessions();
};

// Complete tier: a full, timestamped snapshot of every session, written as a
// single .zip into <backupFolder>/complete/. Kept indefinitely — space is
// managed by compression, not deletion.
const backupComplete = async () => {
  log.log(logDir, "backupComplete()");
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
      sessionsCount: sessions.length
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
  const raw = getSettings("backupFolder") || "Tab_Session_Garrison";
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

const backupAllSessions = async () => {
  log.log(logDir, "backupAllSessions");
  const folder = getSettings("backupFolder");
  await exportSessions(null, folder, true);
};

export const resetLastBackupTime = changes => {
  const isChangedBackupSettings =
    (!changes?.Settings?.oldValue?.ifBackup && changes?.Settings?.newValue?.ifBackup) ||
    changes?.Settings?.oldValue?.backupFolder !== changes?.Settings?.newValue?.backupFolder;
  if (isChangedBackupSettings) setSettings("lastBackupTime", 0);
};
