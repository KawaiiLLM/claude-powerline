import type { ColorTheme } from "./index";

export const darkTheme: ColorTheme = {
  directory: { bg: "#8b4513", fg: "#ffffff" },
  git: { bg: "#404040", fg: "#ffffff" },
  model: { bg: "#2d2d2d", fg: "#ff5cb0" },
  session: { bg: "#202020", fg: "#5a90ff" },
  block: { bg: "#2a2a2a", fg: "#87ceeb" },
  today: { bg: "#1a1a1a", fg: "#ffd64f" },
  tmux: { bg: "#2f4f2f", fg: "#90ee90" },
  context: { bg: "#2d2d2d", fg: "#3fccc9" },
  // Alerts invert into a solid warm chip (dark text); no red for now.
  contextWarning: { bg: "#d9820e", fg: "#1a1a1a" },
  contextCritical: { bg: "#f59e0b", fg: "#1a1a1a" },
  metrics: { bg: "#374151", fg: "#d1d5db" },
  version: { bg: "#3a3a4a", fg: "#b8b8d0" },
  env: { bg: "#2d2d3d", fg: "#d0a0d0" },
  weekly: { bg: "#202020", fg: "#ffa44f" },
  cacheHit: { bg: "#1a1a1a", fg: "#a78bfa" },
  fiveHour: { bg: "#262626", fg: "#cdef4d" },
};

export const darkAnsi256Theme: ColorTheme = {
  directory: { bg: "#af5f00", fg: "#ffffff" },
  git: { bg: "#444444", fg: "#ffffff" },
  model: { bg: "#3a3a3a", fg: "#ffffff" },
  session: { bg: "#262626", fg: "#00ffff" },
  block: { bg: "#303030", fg: "#87ceeb" },
  today: { bg: "#1c1c1c", fg: "#87ff87" },
  tmux: { bg: "#444444", fg: "#87ff87" },
  context: { bg: "#5f5f87", fg: "#d0d0d0" },
  contextWarning: { bg: "#af5f00", fg: "#ffaf00" },
  contextCritical: { bg: "#870000", fg: "#ff8787" },
  metrics: { bg: "#4e4e4e", fg: "#d0d0d0" },
  version: { bg: "#444444", fg: "#d7afff" },
  env: { bg: "#3a3a3a", fg: "#d787d7" },
  weekly: { bg: "#262626", fg: "#87afd7" },
  cacheHit: { bg: "#1c1c1c", fg: "#5fffaf" },
  fiveHour: { bg: "#3a3a3a", fg: "#ffaf87" },
};

export const darkAnsiTheme: ColorTheme = {
  directory: { bg: "#d75f00", fg: "#ffffff" },
  git: { bg: "#585858", fg: "#ffffff" },
  model: { bg: "#444444", fg: "#ffffff" },
  session: { bg: "#303030", fg: "#00ffff" },
  block: { bg: "#3a3a3a", fg: "#5fafff" },
  today: { bg: "#262626", fg: "#00ff00" },
  tmux: { bg: "#585858", fg: "#00ff00" },
  context: { bg: "#585858", fg: "#ffffff" },
  contextWarning: { bg: "#d75f00", fg: "#ffff00" },
  contextCritical: { bg: "#af0000", fg: "#ff0000" },
  metrics: { bg: "#666666", fg: "#ffffff" },
  version: { bg: "#585858", fg: "#af87ff" },
  env: { bg: "#444444", fg: "#ff87ff" },
  weekly: { bg: "#303030", fg: "#5fafff" },
  cacheHit: { bg: "#262626", fg: "#00ff87" },
  fiveHour: { bg: "#444444", fg: "#ff8700" },
};
