// Pure tab-group helpers with NO imports, kept out of the tabGroups ↔ settings
// ↔ defaultSettings circular import so they resolve reliably in every bundle
// (notably the background, where that cycle could leave them unresolved).

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
