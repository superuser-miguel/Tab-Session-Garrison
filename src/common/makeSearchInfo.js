export const makeSearchInfo = session => {
  const windows = Object.values(session.windows);
  const tabTitles = windows.map(window => Object.values(window).map(tab => tab.title));
  const joinedtitle = tabTitles.flat().join(" ").toLowerCase();
  // Tab-group names are searchable too, so typing a group's name surfaces every
  // session containing it — the chips are already visible in both panes.
  const groupsTitle = (session.tabGroups || [])
    .map(group => group.title || "")
    .join(" ")
    .toLowerCase();
  return { id: session.id, tabsTitle: joinedtitle, groupsTitle: groupsTitle };
};
