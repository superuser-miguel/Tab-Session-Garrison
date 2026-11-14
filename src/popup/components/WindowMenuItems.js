import React from "react";
import browser from "webextension-polyfill";
import { addCurrentTab } from "../actions/controlSessions";
import EditIcon from "../icons/edit.svg";
import { CopyLinksItems, AddLinksItem } from "./CopyLinksMenuItems";

export default props => {
  const handleAddCurrentTab = () => {
    addCurrentTab(props.sessionId, props.windowId);
  };

  const handleClickSection = e => {
    e.stopPropagation();
  };

  return (
    <ul>
      <li className="section" onClick={handleClickSection}>
        <EditIcon />
        {browser.i18n.getMessage("editWindowLabel")}
      </li>
      <li>
        <button onClick={handleAddCurrentTab}>
          {browser.i18n.getMessage("addCurrentTabLabel")}
        </button>
      </li>
      {props.session && (
        <>
          <hr />
          <CopyLinksItems session={props.session} scope={{ windowId: props.windowId }} />
          <hr />
          <AddLinksItem session={props.session} target={{ windowId: props.windowId }} />
        </>
      )}
    </ul>
  );
};
