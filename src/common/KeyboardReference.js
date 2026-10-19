import React from "react";
import browser from "webextension-polyfill";
import { POPUP_KEYMAP, KEY_AREAS, formatBinding } from "./keymap";
import "./KeyboardReference.scss";

const AREA_LABELS = {
  list: "keyAreaListLabel",
  search: "keyAreaSearchLabel",
  tabs: "keyAreaTabsLabel",
  dialogs: "keyAreaDialogsLabel",
  anywhere: "keyAreaAnywhereLabel"
};

// Lists every popup key from common/keymap.js, grouped by where it works.
// Used by the popup's "?" cheat sheet and Settings → Shortcuts.
const KeyboardReference = () => {
  const getMessage = key => browser.i18n.getMessage(key);
  return (
    <div className="keyboardReference">
      {KEY_AREAS.map(area => (
        <section key={area}>
          <h4>{getMessage(AREA_LABELS[area])}</h4>
          <table>
            <tbody>
              {POPUP_KEYMAP.filter(entry => entry.area === area).map(entry => (
                <tr key={entry.action}>
                  <td className="keys">
                    {entry.bindings.map((binding, i) => (
                      <kbd key={i}>{formatBinding(binding, getMessage)}</kbd>
                    ))}
                  </td>
                  <td>{getMessage(entry.label)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
};

export default KeyboardReference;
