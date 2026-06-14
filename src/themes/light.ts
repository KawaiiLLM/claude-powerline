import type { ColorTheme } from "./index";

// Light theme as a bright "rainbow streak" ribbon, keeping dark's inverted
// structure (vivid chip background + dark text; dark's *alert* look made the
// normal state). The chip palette is lifted from the rainbow-hair reference: 7
// hues, most as a saturated/pale pair. The saturated tone of each hue goes to a
// commonly-visible segment (model/session/context/fiveHour/weekly/cacheHit),
// the pale tone to a secondary one (git/block/tmux/metrics/version/env), so any
// subset still reads as one coherent spectrum. directory keeps Anthropic's
// brand coral (#DB7759) as the warm anchor; today (cost) keeps a semantic gold
// (#FFD64F) rather than a spectrum hue.
//
// Every chip is bright (high luminance), so a near-black text (~#1a1a1a) clears
// >=4.5:1 on all of them; a few fgs carry a faint hue tint to match the chip.
// Alerts swap each segment's fg<->bg, so an alerting chip flips dark (dark chip,
// bright accent text) and pops against the light ribbon.
export const lightTheme: ColorTheme = {
  directory: { bg: "#db7759", fg: "#ffffff" }, // brand coral anchor
  git: { bg: "#cba8e8", fg: "#3a3a4a" }, // pale violet
  model: { bg: "#fd3e74", fg: "#1a1a1a" }, // rose
  session: { bg: "#5ecdff", fg: "#202020" }, // sky
  block: { bg: "#a2daf4", fg: "#2a2a3a" }, // pale sky
  today: { bg: "#ffd64f", fg: "#1a1a1a" }, // gold (cost anchor)
  tmux: { bg: "#eefd87", fg: "#2f4f2f" }, // pale lime
  context: { bg: "#53fae0", fg: "#1d2d2d" }, // aqua
  metrics: { bg: "#95ece3", fg: "#374151" }, // pale aqua
  version: { bg: "#dc71f6", fg: "#2d2d3d" }, // light magenta
  env: { bg: "#faae80", fg: "#2d2d2d" }, // peach
  weekly: { bg: "#ff9458", fg: "#202020" }, // orange
  cacheHit: { bg: "#a87af0", fg: "#1a1a1a" }, // violet
  fiveHour: { bg: "#dcef49", fg: "#1a1a1a" }, // lime/green
  contextWarning: { bg: "#ffd64f", fg: "#1a1a1a" },
  contextCritical: { bg: "#ff6b6b", fg: "#1a1a1a" },
};

// ansi256 / ansi degrade through the hex->palette converters; reuse the same
// hexes so they quantise to the nearest palette tone.
export const lightAnsi256Theme: ColorTheme = lightTheme;
export const lightAnsiTheme: ColorTheme = lightTheme;
