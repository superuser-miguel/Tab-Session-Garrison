# AMO listing copy

Draft text for the addons.mozilla.org **listed** submission. Paste into the AMO form —
none of this ships inside the extension package.

The in-package `extDescription` (`src/_locales/en/messages.json`) is the short string
Firefox shows in `about:addons`. Keep it consistent with the **Summary** below.

---

## Name

```
Tab Session Garrison
```

## Summary (max 250 characters)

```
Keyboard-first session management for Firefox. Save and restore windows and tabs, then
work the list without the mouse: multi-select, bulk restore and delete with undo-all,
and tab-group awareness — fast even with thousands of saved sessions.
```

## Description

> AMO allows limited HTML. Keep the fork disclosure — the code is derived from Tab Session
> Manager, and stating that up front pre-empts a duplicate/copyright review hold.

```
Tab Session Garrison saves and restores your windows and tabs — and then gets out of your way
when you have hundreds of saved sessions to wade through.

WHAT MAKES IT DIFFERENT

Selection and bulk actions
• Multi-select with Ctrl/Cmd-click, Shift-click ranges, or the keyboard
• Full keyboard navigation — move, extend a selection, select all, restore, and delete without
  touching the mouse
• Bulk delete with a single "undo all", so clearing out dozens of stale auto-saves is safe
• Bulk restore — open every selected session at once, each in its own window, behind a confirm
• An "N selected" summary panel with Open all and Delete, so you always know what a bulk
  action will hit

Tab groups
• Every session shows its Firefox tab groups at a glance — named, coloured chips grouped by
  window in the detail pane, and coloured dots on each list row
• Add a saved session to your current window as a single named tab group
• Phantom-group masking cleans up older auto-saves that captured stray groups, non-destructively

Reliability and polish
• Durable auto-save — fixes an upstream bug where periodic auto-save could silently stop after
  the browser suspended or restarted; the alarm now self-heals
• Session types at a glance — Manual Save, Regularly, Window closed, and Browser exited each get
  their own icon and tint, so the saves you deliberately kept stand out from auto-save noise
• Restore respects your settings — with "Save tab groups" off, restoring no longer recreates the
  groups you opted out of
• Its own visual identity: a boxed card layout, one consistent green accent, and dark theme by
  default

Fast on large profiles
• Selecting, searching, and arrow-keying no longer walk the whole list on every keystroke
• Off-screen rows cost nothing to render until you scroll to them
• Bulk delete is a single batched write instead of one rewrite of undo history per session

PRIVACY

Everything stays in your browser. There is no account, no sign-in, and no server — sessions live
in local storage, and backups are written to a folder you choose. The extension collects and
transmits nothing.

ABOUT THIS FORK

Tab Session Garrison is a fork of Tab Session Manager by Sienori, which is Copyright (c) 2017–
Sienori and released under the Mozilla Public License 2.0. All of the core save/restore
functionality is theirs; this fork adds keyboard ergonomics, tab-group handling, and performance
work on top. Because the upstream code carries no "Incompatible With Secondary Licenses" notice,
MPL-2.0 permits redistribution under the GPL — this fork is GPL-3.0-or-later, and the original
MPL-2.0 text and copyright are preserved in the source.

If you want the polished, cross-browser, actively maintained original, install Tab Session
Manager instead.

Source: https://github.com/superuser-miguel/Tab-Session-Garrison
```

## Other AMO form fields

| Field | Value |
|---|---|
| Categories | Tabs; Privacy & Security *(pick 2 max)* |
| Support site | `https://superuser-miguel.github.io/Tab-Session-Garrison/` |
| Support email | *(your call — AMO requires one of site/email)* |
| License | GPL-3.0-or-later |
| Privacy policy | Required only if you collect data. Manifest declares `data_collection_permissions: none`, so a short "no data is collected or transmitted" statement is enough. |
| Tags | session, tabs, tab groups, keyboard, backup, restore |

## Screenshots

Still to redo — the current `docs/screenshots/` set predates the green logo and the
card layout. AMO wants at least one; up to ten.

Suggested shots:
1. Popup with a multi-selection and the "N selected" summary panel
2. Detail pane showing tab-group chips grouped by window
3. Bulk-restore confirm
4. Settings page with the scroll-focus card treatment
