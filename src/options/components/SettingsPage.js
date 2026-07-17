import React, { Component } from "react";
import browser from "webextension-polyfill";
import { updateLogLevel, overWriteLogLevel } from "src/common/log";
import {
  initSettings,
  resetAllSettings,
  handleSettingsChange,
  exportSettings,
  importSettings
} from "src/settings/settings";
import defaultSettings from "src/settings/defaultSettings";
import CategoryContainer from "./CategoryContainer";
import OptionContainer from "./OptionContainer";

// Distance from the top of the viewport that marks the "focus line": the active
// section is the last one whose top has scrolled above this line.
const FOCUS_OFFSET = 150;

export default class SettingsPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isInit: false,
      activeCategory: 0
    };
    this.sectionRefs = [];
    this.ticking = false;
    this.init();
  }

  async init() {
    await initSettings();
    overWriteLogLevel();
    updateLogLevel();
    this.setState({ isInit: true });
    browser.storage.local.onChanged.addListener(handleSettingsChange);
  }

  componentDidMount() {
    window.addEventListener("scroll", this.onScroll, { passive: true });
    window.addEventListener("resize", this.onScroll, { passive: true });
  }

  componentWillUnmount() {
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.onScroll);
  }

  // rAF-throttle scroll/resize so we only recompute the active section once per frame.
  onScroll = () => {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.updateActiveCategory();
      this.ticking = false;
    });
  };

  updateActiveCategory() {
    // The last sections can't scroll up past a fixed focus line (there's no
    // content below them to scroll). So as the page bottoms out, slide the focus
    // line down toward the viewport bottom, letting each trailing section
    // ("Other", then import/export) take focus in turn.
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const remaining = Math.max(0, maxScroll - window.scrollY);
    const line = FOCUS_OFFSET + Math.max(0, window.innerHeight - FOCUS_OFFSET - remaining);

    let active = 0;
    this.sectionRefs.forEach((el, index) => {
      if (el && el.getBoundingClientRect().top <= line) active = index;
    });
    if (active !== this.state.activeCategory) this.setState({ activeCategory: active });
  }

  render() {
    const categories = [...defaultSettings, additionalCategory];
    const settingsContent = (
      <ul className="settingsList">
        {categories.map((category, index) => (
          <CategoryContainer
            {...category}
            key={index}
            isActive={index === this.state.activeCategory}
            ref={el => (this.sectionRefs[index] = el)}
          />
        ))}
      </ul>
    );

    return (
      <div>
        <p className="contentTitle">{browser.i18n.getMessage("settingsLabel")}</p>
        <hr />
        {this.state.isInit ? settingsContent : ""}
      </div>
    );
  }
}

const additionalCategory = {
  category: "importExportLabel",
  elements: [
    {
      id: "importSettings",
      title: "importSettingsLabel",
      captions: ["importSettingsCaptionLabel"],
      type: "file",
      accept: ".json",
      value: "importSaveButtonLabel",
      onChange: importSettings
    },
    {
      id: "exportSettings",
      title: "exportSettingsLabel",
      captions: ["exportSettingsCaptionLabel"],
      type: "button",
      value: "exportButtonLabel",
      onClick: async () => {
        await exportSettings();
      }
    },
    {
      id: "resetSettings",
      title: "resetSettingsLabel",
      captions: ["resetSettingsCaptionLabel"],
      type: "button",
      value: "resetSettingsButtonLabel",
      onClick: async () => {
        await resetAllSettings();
        location.reload(true);
      }
    }
  ]
};
