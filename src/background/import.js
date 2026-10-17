import log from "loglevel";
import Sessions from "./sessions.js";
import { saveSession } from "./save.js";

const logDir = "background/import";

export default async function importSessions(importedSessions) {
  log.log(logDir, "import()", importedSessions);

  //同一セッションが存在しなければインポートする
  for (let importedSession of importedSessions) {
    const currentSessions = await Sessions.search("date", importedSession.date);

    const isSameSession = session =>
      session.id == importedSession.id && session.lastEditedTime >= importedSession.lastEditedTime;
    const existsSameSession = currentSessions.some(isSameSession);
    if (existsSameSession) continue;

    // "temp" marks the extension's own live working copy. An imported session
    // carrying it is hidden from the list and could be mistaken for the live
    // copy (upstream TSM #1502), so drop it.
    if (Array.isArray(importedSession.tag)) {
      importedSession.tag = importedSession.tag.filter(tag => tag !== "temp");
    }
    importedSession.lastEditedTime = Date.now();
    await saveSession(importedSession);
  }
}
