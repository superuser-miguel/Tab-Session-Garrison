import React from "react";
import browser from "webextension-polyfill";
import { copyLinks, countLinks } from "../actions/copyLinks";
import { openAddLinks } from "../actions/pasteLinks";
import { formatBinding, POPUP_KEYMAP } from "../../common/keymap";
import CopyIcon from "../icons/copy.svg";

const shortcut = action => {
  const entry = POPUP_KEYMAP.find(e => e.action === action && e.area === "tabs");
  return entry ? formatBinding(entry.bindings[0]) : "";
};

// "Copy N links" + "Copy as Markdown", for any menu. `single` = one tab.
export const CopyLinksItems = ({ session, scope, single = false }) => {
  const count = countLinks(session, scope);
  const linksLabel = single
    ? browser.i18n.getMessage("copyLinkLabel")
    : count === null
    ? browser.i18n.getMessage("copyAllLinksLabel")
    : count === 1
    ? browser.i18n.getMessage("copyOneLinkLabel")
    : browser.i18n.getMessage("copyNLinksLabel", [String(count)]);
  return (
    <>
      <li>
        <button onClick={() => copyLinks(session, scope, "links")}>
          {linksLabel}
          <span className="menuShortcut">{shortcut("copyLinks")}</span>
        </button>
      </li>
      <li>
        <button onClick={() => copyLinks(session, scope, "markdown")}>
          {browser.i18n.getMessage("copyAsMarkdownLabel")}
          <span className="menuShortcut">{shortcut("copyMarkdown")}</span>
        </button>
      </li>
    </>
  );
};

// "Add links…": opens the Add links dialog empty, to paste into. Reading the
// clipboard from a menu click would need an extra permission; a paste the
// user makes doesn't.
export const AddLinksItem = ({ session, target, label = "addLinksMenuLabel" }) => (
  <li>
    <button onClick={() => openAddLinks(session, target)}>
      {browser.i18n.getMessage(label)}
      <span className="menuShortcut">{shortcut("pasteLinks")}</span>
    </button>
  </li>
);

const stop = e => e.stopPropagation();

// Right-click menu of a tab-group header in the tab list.
export const GroupMenuItems = ({ session, windowId, group, color }) => (
  <ul>
    <li className="section groupSection" onClick={stop}>
      <span className="groupDot" style={{ "--group-color": color }} />
      {group.title || group.color}
    </li>
    <CopyLinksItems session={session} scope={{ windowId, groupId: group.id }} />
    <hr />
    <AddLinksItem session={session} target={{ windowId, groupId: group.id }} />
  </ul>
);

// Right-click menu of one tab in the tab list.
export const TabMenuItems = ({ session, windowId, tab }) => (
  <ul>
    <li className="section" onClick={stop}>
      <CopyIcon />
      <span className="sectionTitle">{tab.title || tab.url}</span>
    </li>
    <CopyLinksItems session={session} scope={{ windowId, tabId: tab.id }} single />
    <hr />
    <AddLinksItem session={session} target={{ windowId, tabId: tab.id }} label="addLinksAfterTabMenuLabel" />
  </ul>
);
