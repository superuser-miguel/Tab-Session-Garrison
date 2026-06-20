import React, { Component } from "react";
import browser from "webextension-polyfill";
import DeleteIcon from "../icons/delete.svg";
import "../styles/SelectionSummary.scss";

export default class SelectionSummary extends Component {
  render() {
    const { count, removeSelectedSessions, clearSelection } = this.props;
    const countLabel = browser.i18n
      .getMessage("selectedSessionsCountLabel", [count.toString()])
      .replace(/^$/, `${count} sessions selected`);

    return (
      <div className="selectionSummary">
        <div className="summaryInner">
          <p className="count">{countLabel}</p>
          <div className="buttons">
            <button type="button" className="removeSelected" onClick={removeSelectedSessions}>
              <DeleteIcon />
              <span>{browser.i18n.getMessage("remove").replace(/^$/, "Delete")}</span>
            </button>
            <button type="button" className="clearSelected" onClick={clearSelection}>
              {browser.i18n.getMessage("clearSelectionLabel").replace(/^$/, "Clear selection")}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
