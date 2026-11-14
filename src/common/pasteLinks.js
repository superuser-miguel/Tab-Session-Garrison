// Reads links out of pasted text and adds them to a saved session.
// Pure functions, no browser APIs, so they can be tested without the extension.
//
// The reader accepts:
//   - one link per line (what Copy links gives)
//   - Markdown, including our own: "## Group" headings become tab groups, and
//     "## Window 2" + "### Group" become windows and groups
//   - "[title](link)" anywhere in a line
//   - "link title" lines (the old Import URL list format)
//   - links inside ordinary text, such as an email
//   - "example.com/page" on its own, without https://

import { realUrl } from "./copyLinks";

const SCHEMES = /^(https?|ftp|file):$/;
const IN_TEXT = /\b(?:https?|ftp|file):\/\/[^\s<>"'`]+|moz-extension:\/\/[^\s<>"'`]+/gi;
// Inside a sentence, a link without https:// only counts with a path or a
// leading "www." ("kichikichi.com/en", "www.example.org"), so "node.js" or
// "notes.txt" aren't taken for websites.
const IN_TEXT_BARE = /(?:^|[\s(<"'])((?:www\.(?:[a-z0-9-]+\.)+[a-z]{2,}|(?:[a-z0-9-]+\.)+[a-z]{2,}\/)[^\s<>"'`]*)/gi;
const BARE_DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i;
const MARKDOWN_LINK = /\[((?:\\.|[^\]\\])*)\]\(\s*<?((?:[^\s()<>]|\([^\s()]*\))+)>?(?:\s+"[^"]*")?\s*\)/g;
const BULLET = /^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const WINDOW_HEADING = /^window\s+\d+$/i;

// Trailing punctuation that belongs to the sentence, not the link.
const trimTrailing = url => {
  let out = url;
  for (;;) {
    const last = out.slice(-1);
    if (/[.,;:!?'"*_>]/.test(last)) out = out.slice(0, -1);
    else if (last === ")" && (out.match(/\(/g) || []).length < (out.match(/\)/g) || []).length)
      out = out.slice(0, -1);
    else if (last === "]" && !out.includes("[")) out = out.slice(0, -1);
    else return out;
  }
};

// A clean, openable link, or null.
export const normalizeUrl = raw => {
  if (!raw) return null;
  let url = trimTrailing(raw.trim());
  if (url.startsWith("moz-extension://")) {
    const unwrapped = realUrl(url);
    if (unwrapped === url) return null; // some other extension page
    url = unwrapped;
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    if (!BARE_DOMAIN.test(url)) return null;
    url = "https://" + url;
  }
  try {
    const parsed = new URL(url);
    if (!SCHEMES.test(parsed.protocol)) return null;
    if (parsed.protocol !== "file:" && !parsed.hostname) return null;
    return url;
  } catch (e) {
    return null;
  }
};

const unescapeMarkdown = text => text.replace(/\\([\\\[\]])/g, "$1").trim();

// What to call a link that came without a title: "kayak.com/flight-routes/HND".
export const fallbackTitle = url => {
  try {
    const u = new URL(url);
    if (u.protocol === "file:") return decodeURIComponent(u.pathname.split("/").pop() || u.pathname);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : decodeURIComponent(u.pathname).replace(/\/$/, "");
    const text = host + path;
    return text.length > 80 ? text.slice(0, 79) + "…" : text;
  } catch (e) {
    return url;
  }
};

// Returns { tabs: [{ url, title, windowIndex, group }], ignored, windowCount, groups }
//   title is "" when the text had none; group is a name or null.
export const parseLinks = text => {
  const lines = String(text || "").split(/\r\n|\r|\n/);
  // With "###" headings present, "##" headings are windows (our multi-window
  // Markdown). Otherwise "## Window N" is a window and other headings are groups.
  const hasSubHeadings = lines.some(line => /^###\s/.test(line.trim()));
  const tabs = [];
  let ignored = 0;
  let windowIndex = 0;
  let windowUsed = false;
  let group = null;

  const push = (url, title) => {
    const clean = normalizeUrl(url);
    if (!clean) return false;
    tabs.push({ url: clean, title: title || "", windowIndex, group });
    windowUsed = true;
    return true;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, " ").trim();
    if (line === "") {
      group = null; // a blank line ends a group, as in our own Markdown
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      const name = heading[2];
      const isWindow = hasSubHeadings ? level <= 2 : WINDOW_HEADING.test(name);
      if (isWindow) {
        if (windowUsed) windowIndex++;
        windowUsed = false;
        group = null;
      } else {
        group = name || null;
      }
      continue;
    }

    // [title](link), anywhere in the line
    let found = false;
    MARKDOWN_LINK.lastIndex = 0;
    let match;
    while ((match = MARKDOWN_LINK.exec(line))) {
      if (push(match[2], unescapeMarkdown(match[1]))) found = true;
    }
    if (found) continue;

    // "link title" (also "- link title")
    const body = line.replace(BULLET, "");
    const space = body.indexOf(" ");
    const first = space === -1 ? body : body.slice(0, space);
    const rest = space === -1 ? "" : body.slice(space + 1).trim();
    if (normalizeUrl(first) && (/^[a-z][a-z0-9+.-]*:\/\//i.test(first) || BARE_DOMAIN.test(trimTrailing(first)))) {
      push(first, rest.replace(/^[-–—:|]\s*/, ""));
      // more links later in the same line, e.g. "a.com and b.com" — keep them too
      const later = rest.match(IN_TEXT) || [];
      later.forEach(url => push(url, ""));
      continue;
    }

    // links inside ordinary text
    const inText = line.match(IN_TEXT) || [];
    let any = false;
    for (const url of inText) if (push(url, "")) any = true;
    const rest2 = line.replace(IN_TEXT, " ");
    IN_TEXT_BARE.lastIndex = 0;
    let bare;
    while ((bare = IN_TEXT_BARE.exec(rest2))) if (push(bare[1], "")) any = true;
    if (!any) ignored++;
  }

  const windowCount = tabs.length ? Math.max(...tabs.map(tab => tab.windowIndex)) + 1 : 0;
  const groups = [...new Set(tabs.map(tab => tab.group).filter(Boolean))];
  return { tabs, ignored, windowCount, groups };
};

// Leaves out links that are already in the target (and repeats inside the
// pasted text). Returns { tabs, duplicates }.
export const leaveOutDuplicates = (tabs, existingUrls = [], skipDuplicates = true) => {
  if (!skipDuplicates) return { tabs, duplicates: 0 };
  const seen = new Set(existingUrls);
  const kept = [];
  let duplicates = 0;
  for (const tab of tabs) {
    if (seen.has(tab.url)) {
      duplicates++;
      continue;
    }
    seen.add(tab.url);
    kept.push(tab);
  }
  return { tabs: kept, duplicates };
};

// Firefox's tab-group colours, in the order new groups get them.
export const GROUP_COLORS = ["blue", "purple", "cyan", "orange", "green", "pink", "yellow", "red", "grey"];

const makeTab = (id, index, windowId, url, title, groupId) => {
  const tab = {
    id,
    index,
    windowId,
    url,
    title: title || fallbackTitle(url),
    active: false,
    highlighted: false,
    pinned: false,
    incognito: false,
    isArticle: false,
    isInReaderMode: false,
    lastAccessed: Date.now(),
    groupId: groupId > 0 ? groupId : -1
  };
  return tab;
};

const nextNumber = numbers => (numbers.length ? Math.max(...numbers.map(Number).filter(n => !isNaN(n))) + 1 : 1);

const countTabs = session =>
  Object.values(session.windows).reduce((n, win) => n + Object.keys(win).length, 0);

// Adds parsed tabs to a copy of `session`.
// target: { windowId }                → end of that window, pasted groups kept
//         { windowId, groupId }       → end of that group (pasted groups ignored)
//         { windowId, tabId }         → right after that tab, in its group
//         { newWindow: true }         → new window(s), pasted windows and groups kept
// Returns { session, added }.
export const addTabsToSession = (original, tabs, target) => {
  const session = JSON.parse(JSON.stringify(original));
  session.tabGroups = session.tabGroups || [];
  const allTabIds = Object.values(session.windows).flatMap(win => Object.values(win).map(tab => tab.id));
  let nextTabId = nextNumber(allTabIds.length ? allTabIds : [0]);
  let nextGroupId = nextNumber(session.tabGroups.map(group => group.id).concat([0]));
  const usedColors = new Set(session.tabGroups.map(group => group.color));

  const newGroup = (title, windowId) => {
    const color = GROUP_COLORS.find(c => !usedColors.has(c)) || GROUP_COLORS[session.tabGroups.length % GROUP_COLORS.length];
    usedColors.add(color);
    const group = { id: nextGroupId++, title, color, collapsed: false, windowId: Number(windowId) };
    session.tabGroups.push(group);
    return group.id;
  };

  // Puts `list` into one window at `position` (default: the end), all in
  // group `groupId` (or none).
  const insert = (windowId, list, groupId, position) => {
    const win = session.windows[windowId];
    const existing = Object.values(win);
    if (position === undefined) position = existing.length;
    existing.forEach(tab => {
      if (tab.index >= position) tab.index += list.length;
    });
    for (const item of list) {
      const tab = makeTab(nextTabId++, position++, Number(windowId), item.url, item.title, groupId);
      win[tab.id] = tab;
    }
  };

  const endOfGroup = (windowId, groupId) => {
    const inGroup = Object.values(session.windows[windowId]).filter(tab => tab.groupId === groupId);
    return inGroup.length ? Math.max(...inGroup.map(tab => tab.index)) + 1 : undefined;
  };

  // Adds `list` to the end of one window, keeping the pasted groups. A pasted
  // group with the same name as one already in this window joins it, placed
  // right after that group's tabs.
  const fillWindow = (windowId, list) => {
    const existingGroups = new Map(
      session.tabGroups
        .filter(group => String(group.windowId) === String(windowId) && group.title)
        .map(group => [group.title, group.id])
    );
    const joining = new Map();
    const rest = [];
    for (const item of list) {
      if (item.group && existingGroups.has(item.group)) {
        const gid = existingGroups.get(item.group);
        if (!joining.has(gid)) joining.set(gid, []);
        joining.get(gid).push(item);
      } else rest.push(item);
    }
    for (const [gid, items] of joining) insert(windowId, items, gid, endOfGroup(windowId, gid));
    // consecutive items with the same group go in together
    const newGroups = new Map();
    let run = [];
    let runGroup;
    const flush = () => {
      if (!run.length) return;
      let gid;
      if (runGroup) {
        if (!newGroups.has(runGroup)) newGroups.set(runGroup, newGroup(runGroup, windowId));
        gid = newGroups.get(runGroup);
      }
      insert(windowId, run, gid);
      run = [];
    };
    for (const item of rest) {
      if (item.group !== runGroup) flush();
      runGroup = item.group;
      run.push(item);
    }
    flush();
  };

  if (target.newWindow) {
    const windowIds = Object.keys(session.windows);
    let nextWindowId = nextNumber(windowIds.length ? windowIds : [0]);
    const byWindow = new Map();
    tabs.forEach(tab => {
      if (!byWindow.has(tab.windowIndex)) byWindow.set(tab.windowIndex, []);
      byWindow.get(tab.windowIndex).push(tab);
    });
    for (const list of byWindow.values()) {
      const windowId = nextWindowId++;
      session.windows[windowId] = {};
      fillWindow(windowId, list);
      if (session.windowsInfo) session.windowsInfo[windowId] = { id: windowId, title: list[0].title || fallbackTitle(list[0].url) };
    }
  } else {
    const windowId = target.windowId;
    const win = session.windows[windowId];
    if (!win) return { session: original, added: 0 };
    if (target.tabId !== undefined) {
      const after = Object.values(win).find(tab => String(tab.id) === String(target.tabId));
      if (!after) return { session: original, added: 0 };
      insert(windowId, tabs, after.groupId > 0 ? after.groupId : undefined, after.index + 1);
    } else if (target.groupId !== undefined) {
      insert(windowId, tabs, target.groupId, endOfGroup(windowId, target.groupId));
    } else {
      fillWindow(windowId, tabs);
    }
  }

  if (!session.tabGroups.length) delete session.tabGroups;
  session.tabsNumber = countTabs(session);
  session.windowsNumber = Object.keys(session.windows).length;
  session.lastEditedTime = Date.now();
  return { session, added: tabs.length };
};

// A brand-new session made from parsed tabs. Pass in id and date so this
// stays pure.
export const sessionFromTabs = (tabs, { id, now = Date.now(), fallbackName = "" }) => {
  const base = {
    windows: {},
    windowsNumber: 0,
    windowsInfo: {},
    tabsNumber: 0,
    name: "",
    date: now,
    lastEditedTime: now,
    tag: [],
    sessionStartTime: now,
    id
  };
  const { session } = addTabsToSession(base, tabs, { newWindow: true });
  const first = Object.values(Object.values(session.windows)[0] || {}).sort((a, b) => a.index - b.index)[0];
  if (first) first.active = true;
  Object.values(session.windows).forEach(win => {
    const firstTab = Object.values(win).sort((a, b) => a.index - b.index)[0];
    if (firstTab) firstTab.active = true;
  });
  // the first title, or the caller's name (e.g. "Pasted links") when the
  // links came without titles
  session.name = (tabs.find(tab => tab.title) || {}).title || fallbackName;
  return session;
};
