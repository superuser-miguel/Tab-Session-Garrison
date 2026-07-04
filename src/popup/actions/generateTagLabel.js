import React from "react";
import browser from "webextension-polyfill";
import TagIcon from "../icons/tag.svg";
import AutoSaveIcon from "../icons/update.svg";
import WindowCloseIcon from "../icons/windowClose.svg";
import BrowserExitIcon from "../icons/browserExit.svg";
import StartupIcon from "../icons/star.svg";
import TrackingIcon from "../icons/circle.svg";

export const generateTagLabel = tag => {
  switch (tag) {
    case "regular":
      return browser.i18n.getMessage("regularSaveSessionNameShort");
    case "winClose":
      return browser.i18n.getMessage("winCloseSessionNameShort");
    case "browserExit":
      return browser.i18n.getMessage("browserExitSessionNameShort");
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
