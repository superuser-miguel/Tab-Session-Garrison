import log from "loglevel";
import { referencedTabGroups } from "../common/tabGroupUtils";
import { makeSearchInfo } from "../common/makeSearchInfo";

const logDir = "background/sessions";

// Store layout (DB version 2):
//   sessions   — full session records (windows, tabs, favicons…), the source of truth
//   summaries  — per-session list fields (SUMMARY_KEYS + masked tabGroups), a few
//                hundred bytes each; answers every "light" read without decoding
//                the full records
//   searchText — per-session { id, tabsTitle, groupsTitle } for popup search
// summaries/searchText are derived from sessions and written in the same
// transaction on every put/delete, so they cannot drift. If their counts ever
// disagree with sessions (first run after the upgrade, an interrupted
// rebuild), init() rebuilds them. To change the derived format, bump DB_VERSION
// and clear both stores in onupgradeneeded; the count check then rebuilds.
const DB_NAME = "sessions";
const DB_VERSION = 2;
const SUMMARY_KEYS = [
  "id",
  "name",
  "date",
  "tag",
  "tabsNumber",
  "windowsNumber",
  "lastEditedTime",
  "sessionStartTime"
];
const SUMMARY_FIELDS = new Set([...SUMMARY_KEYS, "tabGroups"]);
const ALL_STORES = ["sessions", "summaries", "searchText"];

const makeSummary = session => {
  const summary = {};
  for (const key of SUMMARY_KEYS) {
    if (session[key] !== undefined) summary[key] = session[key];
  }
  if (session.tabGroups) {
    summary.tabGroups = referencedTabGroups(session.tabGroups, session.windows);
  }
  return summary;
};

const makeSearchText = session => {
  try {
    return makeSearchInfo({
      ...session,
      tabGroups: referencedTabGroups(session.tabGroups, session.windows)
    });
  } catch (e) {
    return { id: session.id, tabsTitle: "", groupsTitle: "" };
  }
};

const isCoveredBySummary = needKeys =>
  Array.isArray(needKeys) && needKeys.every(key => SUMMARY_FIELDS.has(key));

const project = (record, needKeys) => {
  const session = {};
  for (const key of needKeys) session[key] = record[key];
  return session;
};

const promisifyRequest = request =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const promisifyTransaction = transaction =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

const countStore = storeName =>
  promisifyRequest(DB.transaction(storeName, "readonly").objectStore(storeName).count());

// Regenerate summaries + searchText from the full records, in one transaction.
const rebuildIndex = async () => {
  const startTime = performance.now();
  const transaction = DB.transaction(ALL_STORES, "readwrite");
  const summaries = transaction.objectStore("summaries");
  const searchText = transaction.objectStore("searchText");
  summaries.clear();
  searchText.clear();

  let count = 0;
  const request = transaction.objectStore("sessions").openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    summaries.put(makeSummary(cursor.value));
    searchText.put(makeSearchText(cursor.value));
    count++;
    cursor.continue();
  };

  await promisifyTransaction(transaction);
  log.info(logDir, "rebuildIndex()", count, `${Math.round(performance.now() - startTime)}ms`);
};

const ensureIndex = async () => {
  const [sessions, summaries, searchText] = await Promise.all(ALL_STORES.map(countStore));
  if (sessions === summaries && sessions === searchText) return;
  log.info(logDir, "ensureIndex() rebuilding", { sessions, summaries, searchText });
  await rebuildIndex();
};

const openDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = e => {
      const db = request.result;
      if (e.oldVersion < 1) {
        const store = db.createObjectStore("sessions", { keyPath: "id" });
        store.createIndex("name", "name");
        store.createIndex("date", "date");
        store.createIndex("tag", "tag");
        store.createIndex("tabsNumber", "tabsNumber");
        store.createIndex("windowsNumber", "windowsNumber");
        store.createIndex("sessionStartTime", "sessionStartTime");
      }
      if (e.oldVersion < 2) {
        const summaries = db.createObjectStore("summaries", { keyPath: "id" });
        summaries.createIndex("tag", "tag", { multiEntry: true });
        db.createObjectStore("searchText", { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Yield to a deleteDatabase/upgrade from another context instead of
      // blocking it forever.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });

let DB;
let initPromise = null;

const Sessions = {
  // Concurrent callers (several background events can race init) share one
  // open + index check.
  init: () => {
    if (initPromise) return initPromise;
    log.log(logDir, "init()");
    // NOTE: ChromeのService Workerからは呼び出せないが、unlimitedStorage権限があるため削除されることはない
    if (navigator.storage.persist) navigator.storage.persist();

    initPromise = (async () => {
      try {
        DB = await openDB();
        await ensureIndex();
        log.log(logDir, "=>init()");
      } catch (e) {
        log.error(logDir, "init()", e);
        initPromise = null;
        throw e;
      }
    })();
    return initPromise;
  },

  put: session => {
    log.log(logDir, "put()", session);
    const transaction = DB.transaction(ALL_STORES, "readwrite");
    transaction.objectStore("sessions").put(session);
    transaction.objectStore("summaries").put(makeSummary(session));
    transaction.objectStore("searchText").put(makeSearchText(session));

    return promisifyTransaction(transaction).then(
      () => log.log(logDir, "=>put()", "success"),
      e => {
        log.error(logDir, "put()", e);
        throw e;
      }
    );
  },

  delete: id => {
    log.log(logDir, "delete()", id);
    const transaction = DB.transaction(ALL_STORES, "readwrite");
    for (const storeName of ALL_STORES) transaction.objectStore(storeName).delete(id);

    return promisifyTransaction(transaction).then(
      () => log.log(logDir, "=>delete()", "complete"),
      e => {
        log.error(logDir, "delete()", e);
        throw e;
      }
    );
  },

  deleteAll: () => {
    log.log(logDir, "deleteAll()");
    DB.close();

    const request = indexedDB.deleteDatabase(DB_NAME);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        log.log(logDir, "=>deleteAll()", "success");
        initPromise = null;
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
    const request = DB.transaction("sessions", "readonly").objectStore("sessions").get(id);

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

  // Light reads (every key in needKeys is a summary field) come from the
  // summaries store; anything else decodes the full records.
  getAll: async (needKeys = null) => {
    log.log(logDir, "getAll()", needKeys);
    const startTime = performance.now();

    if (isCoveredBySummary(needKeys)) {
      const summaries = await promisifyRequest(
        DB.transaction("summaries", "readonly").objectStore("summaries").getAll()
      );
      const sessions = summaries.map(summary => project(summary, needKeys));
      log.log(logDir, "=>getAll() summaries", `${Math.round(performance.now() - startTime)}ms`);
      return sessions;
    }

    const records = await promisifyRequest(
      DB.transaction("sessions", "readonly").objectStore("sessions").getAll()
    );
    const sessions = records.map(record => {
      const session = needKeys == null ? record : project(record, needKeys);
      // Mask phantom tab groups using the full record's windows, even when
      // the projection omits them.
      if (session.tabGroups) {
        session.tabGroups = referencedTabGroups(session.tabGroups, record.windows);
      }
      return session;
    });
    log.log(logDir, "=>getAll() full", `${Math.round(performance.now() - startTime)}ms`);
    return sessions;
  },

  // Sessions whose tags include `tag`, via the summaries' multi-entry tag index.
  // Returns summary projections when needKeys is covered, else full records.
  getByTag: async (tag, needKeys = null) => {
    log.log(logDir, "getByTag()", tag, needKeys);
    const summaries = await promisifyRequest(
      DB.transaction("summaries", "readonly").objectStore("summaries").index("tag").getAll(tag)
    );
    if (isCoveredBySummary(needKeys)) return summaries.map(summary => project(summary, needKeys));

    const sessions = [];
    for (const summary of summaries) {
      const session = await Sessions.get(summary.id).catch(() => null);
      if (session) sessions.push(needKeys == null ? session : project(session, needKeys));
    }
    return sessions;
  },

  getSearchInfo: () => {
    log.log(logDir, "getSearchInfo()");
    return promisifyRequest(
      DB.transaction("searchText", "readonly").objectStore("searchText").getAll()
    );
  },

  // Streams sessions to the popup. A light key set is served from summaries in
  // a single message; full records are paged with getAll(range, count) — one
  // request per batch instead of one cursor round-trip per record (after
  // upstream PR #1650).
  getAllWithStream: async (sendResponse, needKeys, count) => {
    log.log(logDir, "getAllWithStream()", needKeys, count);
    const startTime = performance.now();

    try {
      if (isCoveredBySummary(needKeys) || !count) {
        sendResponse(await Sessions.getAll(needKeys), true);
      } else {
        let lastKey = null;
        while (true) {
          const store = DB.transaction("sessions", "readonly").objectStore("sessions");
          const range = lastKey === null ? null : IDBKeyRange.lowerBound(lastKey, true);
          const rawBatch = await promisifyRequest(store.getAll(range, count));

          const sessions = rawBatch.map(record => {
            const session = needKeys == null ? record : project(record, needKeys);
            if (session.tabGroups) {
              session.tabGroups = referencedTabGroups(session.tabGroups, record.windows);
            }
            return session;
          });

          // Page on the raw record's key, so callers needn't request "id".
          const isEnd = rawBatch.length < count;
          if (!isEnd) lastKey = rawBatch[rawBatch.length - 1].id;
          sendResponse(sessions, isEnd);
          if (isEnd) break;
        }
      }
      log.info(logDir, "=>getAllWithStream()", `${Math.round(performance.now() - startTime)}ms`);
    } catch (e) {
      log.error(logDir, "getAllWithStream()", e);
    }
  },

  search: (index, key) => {
    log.log(logDir, "search()", index, key);
    const request = DB.transaction("sessions", "readonly")
      .objectStore("sessions")
      .index(index)
      .getAll(key);
    return promisifyRequest(request).catch(e => {
      log.error(logDir, "search()", e);
    });
  }
};

export default Sessions;
