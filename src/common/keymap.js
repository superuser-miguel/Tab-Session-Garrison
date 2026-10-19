// Every keyboard shortcut inside the popup, in one place. The popup's key
// handlers match against these bindings, and the Settings → Shortcuts page and
// the "?" cheat sheet list them, so the three can't drift apart. To add or
// change a key: edit it here, handle its `action` in the area's key handler,
// and add its label to _locales/en/messages.json.
//
// A binding is { key, accel, shift, alt }:
//   key    KeyboardEvent.key (letters are matched case-insensitively)
//   accel  Ctrl, or ⌘ on macOS
//   shift  true / false; "any" when the key itself needs Shift on some layouts ("?")
//   alt    true / false
// A binding with `text` instead of `key` is shown in lists but never matched
// (e.g. "type any text"). An entry's optional `display` replaces its bindings
// in lists when spelling every binding out would be too long.

export const KEY_AREAS = ["list", "search", "tabs", "dialogs", "anywhere"];

const MOVE_KEYS = ["ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];

export const POPUP_KEYMAP = [
  // Session list
  { action: "move", area: "list", label: "keyMoveLabel", bindings: MOVE_KEYS.map(key => ({ key })) },
  {
    action: "extend",
    area: "list",
    label: "keyExtendLabel",
    bindings: MOVE_KEYS.map(key => ({ key, shift: true })),
    display: [{ text: "keyShiftMoveKeysLabel", i18n: true }]
  },
  { action: "toggle", area: "list", label: "keyToggleLabel", bindings: [{ key: " " }] },
  { action: "selectAll", area: "list", label: "keySelectAllLabel", bindings: [{ key: "a", accel: true }] },
  { action: "clear", area: "list", label: "keyClearSelectionLabel", bindings: [{ key: "Escape" }] },
  {
    action: "open",
    area: "list",
    label: "keyOpenLabel",
    bindings: [{ key: "Enter" }, { key: "Enter", shift: true }]
  },
  {
    action: "openReplace",
    area: "list",
    label: "keyOpenReplaceLabel",
    bindings: [{ key: "Enter", accel: true }]
  },
  { action: "openAdd", area: "list", label: "keyOpenAddLabel", bindings: [{ key: "Enter", alt: true }] },
  {
    action: "delete",
    area: "list",
    label: "keyDeleteLabel",
    bindings: [{ key: "Delete" }, { key: "Backspace" }]
  },
  { action: "rename", area: "list", label: "keyRenameLabel", bindings: [{ key: "F2" }] },
  { action: "addTag", area: "list", label: "keyAddTagLabel", bindings: [{ key: "F2", shift: true }] },
  {
    action: "menu",
    area: "list",
    label: "keyMenuLabel",
    bindings: [{ key: "F10", shift: true }, { key: "ContextMenu" }]
  },
  { action: "toTabs", area: "list", label: "keyToTabsLabel", bindings: [{ key: "ArrowRight" }] },
  {
    action: "search",
    area: "list",
    label: "keySearchLabel",
    bindings: [{ key: "/", shift: "any" }, { text: "keyTypeAnyTextLabel", i18n: true }]
  },

  // Search box
  {
    action: "searchResults",
    area: "search",
    label: "keySearchResultsLabel",
    bindings: [{ key: "Enter" }, { key: "ArrowDown" }]
  },
  { action: "searchClear", area: "search", label: "keySearchClearLabel", bindings: [{ key: "Escape" }] },

  // Tab list of the selected session
  {
    action: "tabMove",
    area: "tabs",
    label: "keyTabMoveLabel",
    bindings: ["ArrowUp", "ArrowDown", "Home", "End"].map(key => ({ key }))
  },
  { action: "tabOpen", area: "tabs", label: "keyTabOpenLabel", bindings: [{ key: "Enter" }] },
  { action: "tabRemove", area: "tabs", label: "keyTabRemoveLabel", bindings: [{ key: "Delete" }] },
  {
    action: "tabBack",
    area: "tabs",
    label: "keyTabBackLabel",
    bindings: [{ key: "ArrowLeft" }, { key: "Escape" }]
  },

  // Menus and dialogs
  {
    action: "menuMove",
    area: "dialogs",
    label: "keyMenuMoveLabel",
    bindings: [{ key: "ArrowUp" }, { key: "ArrowDown" }]
  },
  { action: "close", area: "dialogs", label: "keyCloseLabel", bindings: [{ key: "Escape" }] },

  // Anywhere in the popup (except while typing in a text box)
  { action: "undo", area: "anywhere", label: "keyUndoLabel", bindings: [{ key: "z", accel: true }] },
  {
    action: "redo",
    area: "anywhere",
    label: "keyRedoLabel",
    bindings: [
      { key: "z", accel: true, shift: true },
      { key: "y", accel: true }
    ]
  },
  { action: "help", area: "anywhere", label: "keyHelpLabel", bindings: [{ key: "?", shift: "any" }] },
  { action: "focusNext", area: "anywhere", label: "keyFocusNextLabel", bindings: [{ text: "Tab" }, { text: "Shift+Tab" }] }
];

const isMac = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

export const matchesBinding = (e, binding) => {
  if (!binding.key) return false;
  const sameKey =
    binding.key.length === 1
      ? e.key.toLowerCase() === binding.key.toLowerCase()
      : e.key === binding.key;
  if (!sameKey) return false;
  const accel = e.ctrlKey || e.metaKey;
  if (accel !== !!binding.accel) return false;
  if (e.altKey !== !!binding.alt) return false;
  if (binding.shift !== "any" && e.shiftKey !== !!binding.shift) return false;
  return true;
};

// The action for this key event in `area`, or null.
export const actionFor = (e, area) => {
  for (const entry of POPUP_KEYMAP) {
    if (entry.area !== area) continue;
    if (entry.bindings.some(binding => matchesBinding(e, binding))) return entry.action;
  }
  return null;
};

const KEY_NAMES = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Escape: "Esc",
  Delete: "Del",
  ContextMenu: "Menu",
  " ": "Space"
};

// Display text for a binding, e.g. "Ctrl+Shift+Z" (or "⌘+Shift+Z" on macOS).
export const formatBinding = (binding, getMessage = key => key) => {
  if (binding.text) return binding.i18n ? getMessage(binding.text) : binding.text;
  const parts = [];
  if (binding.accel) parts.push(isMac() ? "⌘" : "Ctrl");
  if (binding.alt) parts.push(isMac() ? "⌥" : "Alt");
  if (binding.shift === true) parts.push("Shift");
  const key = binding.key;
  parts.push(KEY_NAMES[key] || (key.length === 1 ? key.toUpperCase() : key));
  return parts.join("+");
};
