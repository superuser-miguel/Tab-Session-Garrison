import browser from "webextension-polyfill";
import { getSettings } from "../../settings/settings";

// The themeable CSS variables defined in styles/body.scss. When "Match Firefox"
// is active we override these inline on <body>; otherwise we leave them to the
// light/dark rules in the stylesheet.
const THEME_VARS = [
  "--main-text",
  "--sub-text",
  "--line",
  "--line2",
  "--button",
  "--highlight",
  "--main-bg",
  "--highlight-bg"
];

// For each of our variables, the Firefox theme color keys to try, best first.
// Firefox themes only populate some keys, so each has fallbacks.
const FF_SOURCES = {
  "--main-bg": ["popup", "frame", "toolbar", "ntp_background"],
  "--main-text": ["popup_text", "toolbar_text", "tab_text", "ntp_text"],
  "--line": ["popup_border", "toolbar_field_border", "toolbar_top_separator"],
  "--line2": ["toolbar_field_border", "popup_border"],
  "--button": ["icons", "toolbar_field_text", "popup_text"],
  "--highlight": ["popup_highlight", "button_background_active", "icons_attention"],
  "--highlight-bg": ["popup_highlight", "button_background_hover"]
};

const removeOverrides = () => {
  for (const v of THEME_VARS) document.body.style.removeProperty(v);
};

// Firefox theme colors arrive as "#rrggbb", "rgb()/rgba()" strings, or [r,g,b(,a)].
const toRgb = color => {
  if (!color) return null;
  if (Array.isArray(color)) return color.slice(0, 3).map(Number);
  if (typeof color !== "string") return null;
  const s = color.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3)
      hex = hex
        .split("")
        .map(c => c + c)
        .join("");
    if (hex.length < 6) return null;
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(",").map(p => parseFloat(p));
    if (parts.length >= 3) return parts.slice(0, 3).map(Number);
  }
  return null;
};

const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const firstAvailable = (colors, keys) => {
  if (!colors) return null;
  for (const k of keys) if (colors[k]) return colors[k];
  return null;
};

const applyFirefoxColors = theme => {
  const colors = theme && theme.colors;

  // Pick a light/dark base from the effective color scheme. This is reliable even
  // when a built-in theme exposes no colors, so unmapped vars still look right.
  let dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const bgRgb = toRgb(firstAvailable(colors, ["popup", "frame", "toolbar", "ntp_background"]));
  if (bgRgb) dark = luminance(bgRgb) < 0.5;
  document.body.dataset.theme = dark ? "dark" : "light";

  removeOverrides();
  if (!colors) return; // no per-color data — the light/dark base is enough

  for (const [varName, keys] of Object.entries(FF_SOURCES)) {
    const rgb = toRgb(firstAvailable(colors, keys));
    if (rgb) document.body.style.setProperty(varName, `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
  }
};

// Apply the selected theme to the popup. Call on open and whenever it may change.
export const applyTheme = async () => {
  const setting = getSettings("theme");

  if (setting !== "firefox") {
    removeOverrides();
    document.body.dataset.theme = setting || "light";
    return;
  }

  let theme = null;
  try {
    if (browser.theme && browser.theme.getCurrent) theme = await browser.theme.getCurrent();
  } catch (e) {
    theme = null;
  }
  applyFirefoxColors(theme);
};

// Re-apply live when the Firefox theme changes or the OS scheme flips — but only
// while "Match Firefox" is the active choice.
export const watchTheme = () => {
  const reapply = () => {
    if (getSettings("theme") === "firefox") applyTheme();
  };
  try {
    if (browser.theme && browser.theme.onUpdated) browser.theme.onUpdated.addListener(reapply);
  } catch (e) {}
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", reapply);
  } catch (e) {}
};
