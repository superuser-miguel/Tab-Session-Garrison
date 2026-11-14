import browser from "webextension-polyfill";
import log from "loglevel";
import { v4 as uuidv4 } from "uuid";
import { getSettings } from "src/settings/settings";
import { collectTabs } from "../../common/copyLinks";
import {
  parseLinks,
  leaveOutDuplicates,
  addTabsToSession,
  sessionFromTabs
} from "../../common/pasteLinks";
import { getSessions, sendSessionUpdateMessage, sendUndoMessage } from "./controlSessions";
import { popupNotify } from "./copyLinks";

const logDir = "popup/actions/pasteLinks";

// Where pasted links go:
//   { newSession: true }      a new session
//   { windowId }              end of that window
//   { windowId, groupId }     end of that tab group
//   { windowId, tabId }       right after that tab

// PopupPage registers the function that opens the "Add links" dialog, so
// menus and the paste handler can open it without passing it down.
let openDialog = () => {};
export const setAddLinksOpener = fn => (openDialog = fn);
export const openAddLinks = (session, target, text = "") => openDialog(session, target, text);

const tabOf = (session, target) =>
  Object.values(session.windows?.[target.windowId] || {}).find(
    tab => String(tab.id) === String(target.tabId)
  );

// The links already in the place the new ones go, so repeats can be left out.
const existingUrls = (session, target) => {
  if (target.newSession || !session?.windows) return [];
  if (target.groupId !== undefined)
    return collectTabs(session, { windowId: target.windowId, groupId: target.groupId }).map(t => t.url);
  if (target.tabId !== undefined) {
    const tab = tabOf(session, target);
    const scope = tab?.groupId > 0 ? { windowId: target.windowId, groupId: tab.groupId } : { windowId: target.windowId };
    return collectTabs(session, scope).map(t => t.url);
  }
  return collectTabs(session, { windowId: target.windowId }).map(t => t.url);
};

// What adding `text` to `target` would do: { parsed, tabs, duplicates }.
export const planPaste = (session, target, text) => {
  const parsed = parseLinks(text);
  let tabs = parsed.tabs;
  // into a group or after a tab, everything joins that place; into a window,
  // pasted groups are kept but windows are not
  if (target.groupId !== undefined || target.tabId !== undefined)
    tabs = tabs.map(tab => ({ ...tab, group: null, windowIndex: 0 }));
  else if (!target.newSession) tabs = tabs.map(tab => ({ ...tab, windowIndex: 0 }));
  const { tabs: kept, duplicates } = leaveOutDuplicates(
    tabs,
    existingUrls(session, target),
    getSettings("copyLinksSkipDuplicates")
  );
  return { parsed, tabs: kept, duplicates };
};

const plural = (count, one, many) =>
  count === 1 ? browser.i18n.getMessage(one) : browser.i18n.getMessage(many, [String(count)]);

// Adds the planned tabs. Undo (Ctrl+Z) takes it back, like other edits.
export const addLinks = async (session, target, tabs) => {
  if (!tabs.length) return;
  try {
    let message;
    if (target.newSession) {
      const created = sessionFromTabs(tabs, {
        id: uuidv4(),
        fallbackName: browser.i18n.getMessage("pastedLinksSessionName")
      });
      await browser.runtime.sendMessage({ message: "save", session: created });
      message = browser.i18n.getMessage("addedLinksNewSessionLabel", [
        plural(tabs.length, "oneLinkLabel", "nLinksLabel")
      ]);
    } else {
      const full = session.windows ? session : await getSessions(session.id);
      const { session: updated, added } = addTabsToSession(full, tabs, target);
      if (!added) return;
      await sendSessionUpdateMessage(updated);
      message = plural(added, "addedOneLinkLabel", "addedLinksLabel");
    }
    popupNotify({
      message,
      type: "success",
      duration: 6000,
      buttonLabel: browser.i18n.getMessage("undoLabel"),
      onClick: () => sendUndoMessage()
    });
  } catch (e) {
    log.error(logDir, "addLinks()", e);
    popupNotify({
      message: browser.i18n.getMessage("addLinksFailedLabel", [String(e?.message || e)]),
      type: "error",
      duration: 8000
    });
  }
};

// The paste target of the focused element in the popup, or null when the
// paste isn't meant for us (typing in a box, a dialog is open, …).
export const pasteTargetOf = element => {
  if (!element || element === document.body) return { newSession: true };
  if (element.closest("input, textarea, [contenteditable], #modal, #menu")) return null;
  const marked = element.closest("[data-paste-target]");
  if (marked) {
    try {
      return JSON.parse(marked.dataset.pasteTarget);
    } catch (e) {
      return null;
    }
  }
  if (element.closest("#sessionsArea")) return { newSession: true };
  return null;
};
