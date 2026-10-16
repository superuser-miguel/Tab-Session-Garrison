export const makeSearchInfo = session => {
  const windows = Object.values(session.windows);
  const tabTitles = windows.map(window => Object.values(window).map(tab => tab.title));
  // One title per line: a quoted phrase can then never match across two tabs.
  const joinedtitle = tabTitles.flat().join("\n").toLowerCase();
  // Tab-group names are searchable too, so typing a group's name surfaces every
  // session containing it — the chips are already visible in both panes.
  const groupsTitle = (session.tabGroups || [])
    .map(group => group.title || "")
    .join("\n")
    .toLowerCase();
  return { id: session.id, tabsTitle: joinedtitle, groupsTitle: groupsTitle };
};
