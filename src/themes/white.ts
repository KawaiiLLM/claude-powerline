import type { ColorTheme } from "./index";

// A white theme: every segment is a near-white chip on a cool #F3F5FC ramp that
// steps a touch darker left->right (just enough that the powerline chevrons
// stay visible). The directory keeps dark's signature orange anchor; every
// other segment's text takes dark's exact hue but deepened in luminance (dark's
// bright fgs are invisible on a light bg) so the bar keeps dark's colour
// identity, deepened just enough to read. Contrast is split by temperature:
// cool/neutral text (blue, teal, indigo, violet, grey) shares the cool-blue
// chip's hue family, so it needs a grounded >=7:1 to separate; warm text
// (gold, orange, lime) already contrasts the cool chips in hue, so it is tuned
// to ~4.8:1 at full chroma instead -- darkening warm hues to 7:1 turns them all
// to muddy brown, whereas the lighter high-chroma values stay recognisably gold
// vs orange vs green. Because the chip backgrounds cycle (see WHITE_BG_CYCLE),
// every fg is floored against the darkest cycle tone so it stays legible in any
// position. The effort label's rainbow uses the renderer's light-bg ramp.
//
// The chips are ordered to form a smooth gradient in the common segment order
// (directory -> model -> session -> today -> context -> fiveHour -> weekly ->
// cacheHit); other segments are slotted into the same range so any order stays
// coherent. Alerts invert each segment's own fg<->bg (via swapAnsiRole), so an
// alerting chip flips dark and pops against the light ribbon.
export const whiteTheme: ColorTheme = {
  directory: { bg: "#8b4513", fg: "#ffffff" },
  git: { bg: "#f3f5fc", fg: "#23272e" },
  model: { bg: "#eef2fb", fg: "#8b0048" },
  session: { bg: "#e9eef9", fg: "#0039b0" },
  block: { bg: "#e7ecf9", fg: "#0d4b64" },
  today: { bg: "#e4eaf8", fg: "#765a00" },
  tmux: { bg: "#ebeff9", fg: "#006200" },
  context: { bg: "#dfe6f6", fg: "#124e4d" },
  metrics: { bg: "#dde4f5", fg: "#3f4651" },
  version: { bg: "#e2e8f7", fg: "#434365" },
  env: { bg: "#e6ebf8", fg: "#683068" },
  fiveHour: { bg: "#dae2f4", fg: "#506600" },
  weekly: { bg: "#d5def2", fg: "#944800" },
  cacheHit: { bg: "#d0daf0", fg: "#3801dd" },
  // Warm alert chips (kept for completeness; the live alerts use fg<->bg
  // inversion of the segment's own colours rather than these entries).
  contextWarning: { bg: "#e8a13a", fg: "#ffffff" },
  contextCritical: { bg: "#dc4b3e", fg: "#ffffff" },
};

// ansi256 / ansi degrade through the hex->palette converters; reuse the same
// cool-slate hexes so the gradient quantises to neutral 256 grays.
export const whiteAnsi256Theme: ColorTheme = whiteTheme;
export const whiteAnsiTheme: ColorTheme = whiteTheme;
