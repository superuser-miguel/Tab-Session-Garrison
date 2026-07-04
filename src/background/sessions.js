import Sessions from "./sessions";
import log from "loglevel";
import { referencedTabGroups } from "../common/tabGroupUtils";

const logDir = "background/sessions";

let DB;
export default {
  init: () => {
    log.log(logDir, "init()");
    // NOTE: ChromeのService Workerからは呼び出せないが、unlimitedStorage権限があるため削除されることはない
    if (navigator.storage.persist) navigator.storage.persist();
    const request = indexedDB.open("sessions", 1);

    request.onupgradeneeded = e => {
      const db = request.result;
      const store = db.createObjectStore("sessions", {
        keyPath: "id"
      });

      store.createIndex("name", "name");
      store.createIndex("date", "date");
      store.createIndex("tag", "tag");
      store.createIndex("tabsNumber", "tabsNumber");
      store.createIndex("windowsNumber", "windowsNumber");
      store.createIndex("sessionStartTime", "sessionStartTime");
    };

    return new Promise(resolve => {
      request.onsuccess = e => {
        DB = request.result;
        log.log(logDir, "=>init()", e);
        resolve(e);
      };
      request.onerror = e => {
        log.error(logDir, "init()", e);
      };
    });
  },

  DBUpdate: async () => {
    log.log(logDir, "DBUpdate()");
    let sessions;
    try {
      sessions = await Session.getAll();
      await Session.deleteAll();
    } catch (e) {
      log.error(logDir, "DBUpdate()", e);
      return;
    }

    for (let session of sessions) {
      await Session.put(session).catch(e => {
        log.error(logDir, "DBUpdate()", e);
      });
    }
  },

  put: session => {
    log.log(logDir, "put()", session);
    const db = DB;
    const transaction = db.transaction("sessions", "readwrite");
    const store = transaction.objectStore("sessions");
    const request = store.put(session);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        log.log(logDir, "=>put()", "success");
        resolve();
      };
      request.onerror = e => {
        log.error(logDir, "put()", e.target);
        reject(e.target);
      };
    });
  },

  delete: id => {
    log.log(logDir, "delete()", id);
    const db = DB;
    const transaction = db.transaction("sessions", "readwrite");
    const store = transaction.objectStore("sessions");
    const request = store.delete(id);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        log.log(logDir, "=>delete()", "complete");
        resolve();
      };
      transaction.onerror = e => {
        log.error(logDir, "delete()", e.target);
        reject(e.target);
      };
    });
  },

  deleteAll: () => {
    log.log(logDir, "deleteAll()");
    DB.close("sessions");

    const request = indexedDB.deleteDatabase("sessions");

    return new Promise(resolve => {
      request.onsuccess = () => {
        log.log(logDir, "=>deleteAll()", "success");
        resolve(Sessions.init());
      };
      request.onerror = e => {
        log.error(logDir, "deleteAll()", e);
        reject(e);
      };
    });
  },

  get: id => {
    log.log(logDir, "get()", id);
    const db = DB;
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        if (request.result) {
          const result = request.result;
          if (result.tabGroups) {
            result.tabGroups = referencedTabGroups(result.tabGroups, result.windows);
          }
          log.log(logDir, "=>get()", result);
          resolve(result);
        } else reject(request);
      };
      request.onerror = e => {
        log.error(logDir, "get()", e);
        reject(request);
      };
    });
  },

  getAll: (needKeys = null) => {
    log.log(logDir, "getAll()", needKeys);
    const db = DB;
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");
    const request = store.openCursor();

    let sessions = [];
    return new Promise((resolve, reject) => {
      request.onsuccess = e => {
        const cursor = request.result;
        if (cursor) {
          let session = {};
          if (needKeys == null) {
            session = cursor.value;
          } else {
            for (let i of needKeys) {
              session[i] = cursor.value[i];
            }
          }

          // Mask phantom tab groups using the full record's windows, even when
          // the projection omits them.
          if (session.tabGroups) {
            session.tabGroups = referencedTabGroups(session.tabGroups, cursor.value.windows);
          }

          sessions.push(session);
          cursor.continue();
        } else {
          log.log(logDir, "=>getAll()", sessions);
          resolve(sessions);
        }
      };
      request.onerror = e => {
        log.error(logDir, "getAll()", e);
        reject(request);
      };
    });
  },

  getAllWithStream: (sendResponse, needKeys, count) => {
    log.log(logDir, "getAllWithStream()", needKeys, count);
    const db = DB;
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");
    const request = store.openCursor();

    let sessions = [];

    request.onsuccess = e => {
      const cursor = request.result;
      if (cursor) {
        let session = {};
        if (needKeys == null) {
          session = cursor.value;
        } else {
          for (let i of needKeys) {
            session[i] = cursor.value[i];
          }
        }

        // Mask phantom tab groups (unreferenced by any saved tab) at read time,
        // so the list-row group dots stay correct on older sessions too.
        if (session.tabGroups) {
          session.tabGroups = referencedTabGroups(session.tabGroups, cursor.value.windows);
        }

        sessions.push(session);
        if (sessions.length === count) {
          sendResponse(sessions, false);
          sessions = [];
        }
        cursor.continue();
      } else {
        log.log(logDir, "=>getAllWithStream()");
        sendResponse(sessions, true);
      }
    };
    request.onerror = e => {
      log.error(logDir, "getAllWithStream()", e);
    };
  },

  search: (index, key) => {
    log.log(logDir, "search()", index, key);
    const db = DB;
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");
    const request = store.index(index).openCursor(key, "next");

    let sessions = [];
    return new Promise(resolve => {
      request.onsuccess = e => {
        const cursor = request.result;
        if (cursor) {
          sessions.push(cursor.value);
          cursor.continue();
        } else {
          log.log(logDir, "=>search()", sessions);
          resolve(sessions);
        }
      };
      request.onerror = e => {
        log.error(logDir, "search()", e);
        resolve();
      };
    });
  }
};
