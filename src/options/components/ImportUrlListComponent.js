import React, { Component } from "react";
import browser from "webextension-polyfill";
import { v4 as uuidv4 } from "uuid";
import OptionContainer from "./OptionContainer";
import { parseLinks, sessionFromTabs, fallbackTitle } from "../../common/pasteLinks";

// One session from the pasted text, read the same way as pasting links in
// the popup (one link per line, "link title", Markdown, links inside text).
// No favicons: Firefox fills them in when the tabs are opened, and nothing is
// fetched from other sites.
const createSessionByUrl = inputText => {
  const { tabs } = parseLinks(inputText);
  if (tabs.length === 0) return;
  return sessionFromTabs(tabs, { id: uuidv4(), fallbackName: fallbackTitle(tabs[0].url) });
};

export default class ImportSessionsComponent extends Component {
  constructor() {
    super();
    this.state = {
      inputText: ""
    };
  }

  importSessions() {
    const session = createSessionByUrl(this.state.inputText);
    if (session === undefined) return;

    browser.runtime.sendMessage({
      message: "import",
      importSessions: [session]
    });
    alert(browser.i18n.getMessage("importMessage"));
    this.setState({
      inputText: ""
    });
  }

  handleChange(e) {
    this.setState({
      inputText: e.target.value
    });
  }

  render() {
    const caption = browser.i18n
      .getMessage("urlImportCaptionLabel")
      .replace(/<br>/g, "\n")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    return (
      <div>
        <OptionContainer
          title="urlImportLabel"
          captions={[caption]}
          useRawCaptions={true}
          type="button"
          value="importSaveButtonLabel"
          onClick={this.importSessions.bind(this)}
          extraCaption={
            <textarea
              id="urlImportList"
              spellCheck={false}
              placeholder="https://www.google.com/ Google                                                                                              https://github.com/"
              onChange={this.handleChange.bind(this)}
              value={this.state.inputText}
            />
          }
        />
      </div>
    );
  }
}
