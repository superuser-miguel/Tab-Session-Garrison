import React from "react";
import browser from "webextension-polyfill";
import log from "loglevel";
import openUrl from "../actions/openUrl";
import { sendUndoMessage, sendRedoMessage } from "../actions/controlSessions";
import UndoIcon from "../icons/undo.svg";
import RedoIcon from "../icons/redo.svg";
import ExpandIcon from "../icons/expand.svg";
import SettingsIcon from "../icons/settings.svg";
import "../styles/Header.scss";

const logDir = "popup/components/Header";

const openSettings = () => {
  log.info(logDir, "openSettings()");
  const url = "../options/index.html#settings";
  openUrl(url);
};

const openSessionListInTab = () => {
  log.info(logDir, "openSessionListInTab()");
  const url = "../popup/index.html#inTab";
  openUrl(url);
  window.close();
};

// Corner badge with the number of steps available; hidden at zero.
const CountBadge = ({ count }) =>
  count > 0 ? <span className="countBadge">{count > 99 ? "99+" : count}</span> : null;

const labelWithCount = (label, count) => (count > 0 ? `${label} (${count})` : label);

export default props => {
  const { undoStatus } = props;

  return (
    <div id="header">
      <div className="title">
        <img className="titleLogo" src="/icons/icon.svg" alt="" />
        <span>Tab Session Garrison</span>
      </div>
      <div className="rightButtons">
        <button
          className={`undoButton ${undoStatus.undoCount == 0 ? "disable" : ""}`}
          onClick={sendUndoMessage}
          title={labelWithCount(browser.i18n.getMessage("undoLabel"), undoStatus.undoCount)}
        >
          <UndoIcon />
          <CountBadge count={undoStatus.undoCount} />
        </button>
        <button
          className={`redoButton ${undoStatus.redoCount == 0 ? "disable" : ""}`}
          onClick={sendRedoMessage}
          title={labelWithCount(browser.i18n.getMessage("redoLabel"), undoStatus.redoCount)}
        >
          <RedoIcon />
          <CountBadge count={undoStatus.redoCount} />
        </button>
        <div className="separation" />
        <button
          className={"openInTabButton"}
          onClick={openSessionListInTab}
          title={browser.i18n.getMessage("openSessionListInTabLabel")}
        >
          <ExpandIcon />
        </button>
        <button
          className={"settingsButton"}
          onClick={openSettings}
          title={browser.i18n.getMessage("settingsLabel")}
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  );
};
