import React from "react";
import browser from "webextension-polyfill";
import TagIcon from "../icons/tag.svg";
import AutoSaveIcon from "../icons/update.svg";
import WindowCloseIcon from "../icons/windowClose.svg";
import BrowserExitIcon from "../icons/browserExit.svg";
import ManualSaveIcon from "../icons/bookmark.svg";
import StartupIcon from "../icons/star.svg";
import TrackingIcon from "../icons/circle.svg";

// The stored discriminators that mark how a session was saved. `manual` is
// stamped on user-initiated saves; the three auto types are pushed by autoSave.
// These are types, not user labels — they render without a remove button.
export const TYPE_TAGS = ["manual", "regular", "winClose", "browserExit"];
const AUTO_SAVE_TAGS = ["regular", "winClose", "browserExit"];

// A manual save is anything the user kept themselves — i.e. it carries none of
// the auto-save discriminators (nor the hidden temp buffer tag).
export const isManualSave = session =>
  Array.isArray(session.tag) &&
  !session.tag.some(t => AUTO_SAVE_TAGS.includes(t) || t === "temp");

// Tags to render for a session. New manual saves already carry a stored `manual`
// tag; legacy bare saves (and pre-stamp imports) get a synthetic `manual` chip
// prepended at display time so the whole library reads consistently.
export const getDisplayTags = session => {
  const tags = session.tag || [];
  if (tags.includes("manual")) return tags;
  if (isManualSave(session)) return ["manual", ...tags];
  return tags;
};

export const generateTagLabel = tag => {
  switch (tag) {
    case "regular":
      return browser.i18n.getMessage("regularSaveSessionNameShort");
    case "winClose":
      return browser.i18n.getMessage("winCloseSessionNameShort");
    case "browserExit":
      return browser.i18n.getMessage("browserExitSessionNameShort");
    case "manual":
      return "Manual Save";
    case "_startup":
      return browser.i18n.getMessage("startupLabel");
    case "_tracking":
      return browser.i18n.getMessage("trackingLabel");
    default:
      return tag;
  }
};

export const generateTagIcon = tag => {
  switch (tag) {
    case "regular":
      return <AutoSaveIcon className="autoSaveIcon" />;
    case "winClose":
      return <WindowCloseIcon className="winCloseIcon" />;
    case "browserExit":
      return <BrowserExitIcon className="browserExitIcon" />;
    case "manual":
      return <ManualSaveIcon className="manualSaveIcon" />;
    case "_startup":
      return <StartupIcon className="startupIcon" />;
    case "_tracking":
      return <TrackingIcon className="trackingIcon" />;
    default:
      return <TagIcon className="tagIcon" />;
  }
};

// Per-type modifier class so each auto-save kind gets its own colour in the
// pill (see the *.scss tagRegular/tagWinClose/tagBrowserExit rules).
export const generateTagClass = tag => {
  switch (tag) {
    case "regular":
      return "tagRegular";
    case "winClose":
      return "tagWinClose";
    case "browserExit":
      return "tagBrowserExit";
    default:
      return "";
  }
};
