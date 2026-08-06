import React from "react";
import browser from "webextension-polyfill";
import log from "loglevel";
import openUrl from "../actions/openUrl";
import "../styles/Error.scss";

const logDir = "popup/components/Error";

const openIndexedDBHelp = () => {
  openUrl("https://superuser-miguel.github.io/Tab-Session-Garrison/help/indexeddb-error.html");
};

const errorContent = {
  indexedDB: (
    <div>
      <b>{browser.i18n.getMessage("errorLabel")}</b>
      <br />
      {browser.i18n.getMessage("indexedDBErrorLabel")}
      <br />
      <a onClick={() => browser.runtime.reload()}>
        {browser.i18n.getMessage("reloadExtensionLabel")}
      </a>
      <br />
      <a onClick={openIndexedDBHelp}>{browser.i18n.getMessage("howToSolveLabel")}</a>
    </div>
  )
};

export default props => {
  if (!props.error.isError) return null;
  log.error(logDir, "Error()", props.error);
  return <div className="error">{errorContent[props.error.type]}</div>;
};
