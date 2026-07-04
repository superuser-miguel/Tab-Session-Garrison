import browser from "webextension-polyfill";
import browserInfo from "browser-info";
import log from "loglevel";
import { setSettings } from "../settings/settings";

const logDir = "common/tabGroups";

export const isEnabledTabGroups =
  (browserInfo().name == "Chrome" && browserInfo().version >= 89) ||
  (browserInfo().name == "Firefox" && browserInfo().version >= 139);

export const queryTabGroups = async (queryInfo = {}) => {
  try {
    const tabGroups = await browser.tabGroups.query(queryInfo);
    log.log(logDir, "queryTabGroups", tabGroups);
    return tabGroups;
  } catch (e) {
    log.error(logDir, "queryTabGroups", e);
    return [];
  }
};

export const updateTabGroups = async (groupId, updateProperties) => {
  log.log(logDir, "updateTabGroups");
  const { title, color, collapsed } = updateProperties;
  await browser.tabGroups.update(groupId, {
    title,
    color,
    collapsed
  });
};

export const handleSaveTabGroupsChange = async (id, checked) => {
  // NOTE: ChromeではtabGroupsの権限を要求する
  // tabGroupsの権限は、Chromeでは拡張機能更新時に警告が表示されるためoptional_permissionsとしている
  if (checked && browserInfo().name === "Chrome") {
    const isGranted = await browser.permissions.request({ permissions: ["tabGroups"] });
    log.log(logDir, "handleSaveTabGroupsChange", isGranted);
    if (!isGranted) {
      setSettings(id, false);
      return;
    }
  }
  setSettings(id, checked);
};

// Return only the tab groups actually referenced by a saved tab in `windows`.
// Masks phantom groups at read/display time — e.g. leftovers in older
// "Window closed" sessions saved before the window-prune fix — WITHOUT touching
// stored data. If windows aren't available (not yet loaded), returns as-is.
export const referencedTabGroups = (tabGroups, windows) => {
  if (!Array.isArray(tabGroups) || tabGroups.length === 0) return tabGroups;
  if (!windows) return tabGroups;
  const referenced = new Set();
  for (const win of Object.values(windows)) {
    for (const tab of Object.values(win || {})) {
      if (tab && tab.groupId > 0) referenced.add(tab.groupId);
    }
  }
  return tabGroups.filter(g => referenced.has(g.id));
};

// Firefox/Chrome tab-group color names → CSS hex, for rendering group indicators
// in the session list and detail pane.
export const tabGroupColorHex = name => {
  const colors = {
    grey: "#8b8b95",
    blue: "#3b7ded",
    red: "#e2483d",
    yellow: "#f5c518",
    green: "#3fb84f",
    pink: "#ff6bba",
    purple: "#9a5cf0",
    cyan: "#3bc9d4",
    orange: "#ff9f43"
  };
  return colors[name] || colors.grey;
};
