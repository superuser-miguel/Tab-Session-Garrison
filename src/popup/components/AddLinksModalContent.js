import React, { Component } from "react";
import browser from "webextension-polyfill";
import { fallbackTitle } from "../../common/pasteLinks";
import { planPaste, addLinks } from "../actions/pasteLinks";
import { formatBinding } from "../../common/keymap";
import "../styles/AddLinksModalContent.scss";

const PREVIEW_ROWS = 8;
const msg = (key, subs) => browser.i18n.getMessage(key, subs);
const count = (n, one, many) => (n === 1 ? msg(one) : msg(many, [String(n)]));

// The check before pasted links are added: an editable box with the text,
// what will happen, and the first few links.
export default class AddLinksModalContent extends Component {
  constructor(props) {
    super(props);
    this.state = { text: props.text || "" };
  }

  handleChange = e => this.setState({ text: e.target.value });

  handleKeyDown = e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.add();
    }
  };

  add = () => {
    const { session, target, closeModal } = this.props;
    const { tabs } = planPaste(session, target, this.state.text);
    if (!tabs.length) return;
    closeModal();
    addLinks(session, target, tabs);
  };

  facts = ({ parsed, tabs, duplicates }) => {
    const { target } = this.props;
    if (!this.state.text.trim()) return [{ text: msg("addLinksHintLabel"), kind: "note" }];
    const out = [{ text: count(tabs.length, "oneLinkToAddLabel", "linksToAddLabel"), kind: tabs.length ? "ok" : "note" }];
    if (duplicates) out.push({ text: count(duplicates, "oneAlreadyThereLabel", "alreadyThereLabel"), kind: "note" });
    if (parsed.ignored) out.push({ text: count(parsed.ignored, "oneLineIgnoredLabel", "linesIgnoredLabel"), kind: "note" });
    const intoOnePlace = target.groupId !== undefined || target.tabId !== undefined;
    if (intoOnePlace && parsed.groups.length) out.push({ text: msg("headingsIgnoredLabel"), kind: "note" });
    if (target.newSession && parsed.windowCount > 1)
      out.push({ text: msg("windowsCountLabel", [String(parsed.windowCount)]), kind: "note" });
    return out;
  };

  render() {
    const { session, target, closeModal } = this.props;
    const plan = planPaste(session, target, this.state.text);
    const { tabs } = plan;
    const existingGroups = new Set(
      target.newSession || target.windowId === undefined
        ? []
        : (session.tabGroups || [])
            .filter(group => String(group.windowId) === String(target.windowId))
            .map(group => group.title)
    );

    const rows = [];
    let lastGroup = null;
    tabs.slice(0, PREVIEW_ROWS).forEach((tab, i) => {
      if (tab.group && tab.group !== lastGroup) {
        rows.push(
          <li className="previewGroup" key={`g${i}`}>
            {tab.group}
            <span className="groupNote">
              {existingGroups.has(tab.group) ? msg("joinsGroupLabel") : msg("newGroupLabel")}
            </span>
          </li>
        );
      }
      lastGroup = tab.group;
      rows.push(
        <li className={`previewTab${tab.title ? "" : " untitled"}`} key={i} title={tab.url}>
          {tab.title || fallbackTitle(tab.url)}
        </li>
      );
    });
    if (tabs.length > PREVIEW_ROWS)
      rows.push(
        <li className="previewMore" key="more">
          {msg("andMoreLabel", [String(tabs.length - PREVIEW_ROWS)])}
        </li>
      );

    return (
      <div className="addLinksModalContent">
        <textarea
          value={this.state.text}
          onChange={this.handleChange}
          onKeyDown={this.handleKeyDown}
          placeholder={msg("addLinksHintLabel")}
          spellCheck={false}
          aria-label={msg("addLinksBoxLabel")}
        />
        <ul className="facts" aria-live="polite">
          {this.facts(plan).map((fact, i) => (
            <li className={fact.kind} key={i}>
              {fact.text}
            </li>
          ))}
        </ul>
        {rows.length > 0 && <ul className="preview">{rows}</ul>}
        <div className="buttons">
          <span className="tip">
            {formatBinding({ key: "Enter", accel: true })} {msg("addLinksTipLabel")}
          </span>
          <button type="button" onClick={closeModal}>
            {msg("cancelLabel")}
          </button>
          <button type="button" className="saveButton" onClick={this.add} disabled={!tabs.length}>
            {tabs.length ? count(tabs.length, "addOneLinkLabel", "addNLinksLabel") : msg("addLabel")}
          </button>
        </div>
      </div>
    );
  }
}
