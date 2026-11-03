// Turns the tabs of a saved session (or one window, tab group or tab of it)
// into text for the clipboard. Pure functions, no browser APIs, so they can
// be tested without the extension.
//
// Formats:
//   "links"     one link per line, the format Settings → Import URL list reads
//   "markdown"  "- [title](link)" lines, a heading per tab group (and per
//               window when a whole multi-window session is copied)

const PLACEHOLDER = /\/replaced\/(index|replaced)\.html\?/;

// A tab that was waiting to load is stored behind the extension's placeholder
// page; the real link is in its url parameter.
export const realUrl = url => {
  if (!url || !url.startsWith("moz-extension://") || !PLACEHOLDER.test(url)) return url || "";
  const match = /[?&]url=([^&]*)/.exec(url);
  if (!match) return url;
  try {
    return decodeURIComponent(match[1]);
  } catch (e) {
    return match[1];
  }
};

// scope: {} = whole session, { windowId }, { windowId, groupId }, { windowId, tabId }.
// Returns the tabs in window order, each with its window number and group.
export const collectTabs = (session, scope = {}) => {
  const groups = new Map((session.tabGroups || []).map(group => [group.id, group]));
  const out = [];
  Object.keys(session.windows || {}).forEach((windowId, windowIndex) => {
    if (scope.windowId !== undefined && String(scope.windowId) !== String(windowId)) return;
    const tabs = Object.values(session.windows[windowId]).sort((a, b) => a.index - b.index);
    for (const tab of tabs) {
      if (scope.tabId !== undefined && String(scope.tabId) !== String(tab.id)) continue;
      const group = tab.groupId > 0 ? groups.get(tab.groupId) : null;
      if (scope.groupId !== undefined && tab.groupId !== scope.groupId) continue;
      out.push({
        title: tab.title || "",
        url: realUrl(tab.url),
        windowIndex,
        groupId: group ? tab.groupId : null,
        groupTitle: group ? group.title || group.color || "" : null
      });
    }
  });
  return out;
};

const escapeMarkdown = text => text.replace(/([\[\]\\])/g, "\\$1");

// { text, count, skipped }: count = links copied, skipped = duplicates left out.
export const linksText = (tabs, format = "links", skipDuplicates = true) => {
  const seen = new Set();
  const kept = [];
  let skipped = 0;
  for (const tab of tabs) {
    if (!tab.url) continue;
    if (skipDuplicates && seen.has(tab.url)) {
      skipped++;
      continue;
    }
    seen.add(tab.url);
    kept.push(tab);
  }

  if (format !== "markdown") return { text: kept.map(tab => tab.url).join("\n"), count: kept.length, skipped };

  const windows = new Set(kept.map(tab => tab.windowIndex));
  const multiWindow = windows.size > 1;
  const groups = new Set(kept.map(tab => tab.groupId));
  const oneRun = groups.size === 1; // a single group or a single tab: no headings needed
  const lines = [];
  let window = null;
  let group;
  for (const tab of kept) {
    if (multiWindow && tab.windowIndex !== window) {
      if (lines.length) lines.push("");
      lines.push(`## Window ${tab.windowIndex + 1}`);
      window = tab.windowIndex;
      group = undefined;
    }
    if (!oneRun && tab.groupId !== group) {
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      if (tab.groupId !== null) lines.push(`${multiWindow ? "###" : "##"} ${tab.groupTitle}`);
      group = tab.groupId;
    }
    lines.push(`- [${escapeMarkdown(tab.title || tab.url)}](${tab.url})`);
  }
  return { text: lines.join("\n"), count: kept.length, skipped };
};
