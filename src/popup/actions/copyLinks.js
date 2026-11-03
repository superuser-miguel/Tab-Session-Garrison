import browser from "webextension-polyfill";
import log from "loglevel";
import { getSettings } from "src/settings/settings";
import { collectTabs, linksText } from "../../common/copyLinks";
import { getSessions } from "./controlSessions";

const logDir = "popup/actions/copyLinks";

// PopupPage registers its notification function here, so any menu or key
// handler can say "Copied 12 links" without passing it down.
let notify = () => {};
export const setCopyNotifier = fn => (notify = fn);

// How many links a copy would give, for menu labels. null if the session's
// tabs aren't loaded yet.
export const countLinks = (session, scope) => {
  if (!session?.windows) return null;
  return linksText(collectTabs(session, scope), "links", getSettings("copyLinksSkipDuplicates")).count;
};

// Copy the links of a session, window, tab group or tab (see collectTabs for
// `scope`). Writing to the clipboard needs no extra permission because it
// always follows a click or a key press.
export const copyLinks = async (session, scope = {}, format = "links") => {
  try {
    const full = session.windows ? session : await getSessions(session.id);
    const { text, count, skipped } = linksText(
      collectTabs(full || {}, scope),
      format,
      getSettings("copyLinksSkipDuplicates")
    );
    if (count === 0) return;
    await navigator.clipboard.writeText(text);
    const message =
      count === 1
        ? browser.i18n.getMessage("copiedOneLinkLabel")
        : browser.i18n.getMessage("copiedLinksLabel", [String(count)]);
    notify({
      message: skipped
        ? `${message} · ${
            skipped === 1
              ? browser.i18n.getMessage("duplicateLeftOutLabel")
              : browser.i18n.getMessage("duplicatesLeftOutLabel", [String(skipped)])
          }`
        : message,
      type: "success",
      duration: 3000
    });
  } catch (e) {
    log.error(logDir, "copyLinks()", e);
    notify({
      message: browser.i18n.getMessage("copyLinksFailedLabel", [String(e?.message || e)]),
      type: "error",
      duration: 8000
    });
  }
};
