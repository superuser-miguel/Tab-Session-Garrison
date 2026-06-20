import React from "react";
import browser from "webextension-polyfill";
import { HashRouter } from "react-router-dom";
import { initSettings, getSettings } from "../../settings/settings";
import SideBar from "./SideBar";
import ContentsArea from "./ContentsArea";
import ScrollToTop from "./ScrollToTop";
import "../styles/OptionsPage.scss";

const resolveTheme = value =>
  value === "firefox"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : value;

const setupTheme = async () => {
  await initSettings();
  document.body.dataset.theme = resolveTheme(getSettings("theme"));

  browser.storage.local.onChanged.addListener(changes => {
    if (changes.Settings.newValue.theme === changes.Settings.oldValue.theme) return;
    document.body.dataset.theme = resolveTheme(changes.Settings.newValue.theme);
  });
};

export default () => {
  setupTheme();
  return (
    <HashRouter hashType="noslash">
      <ScrollToTop>
        <div className="optionsPage">
          <SideBar />
          <ContentsArea />
        </div>
      </ScrollToTop>
    </HashRouter>
  );
};
