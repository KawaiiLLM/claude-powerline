import path from "node:path";
import type { ClaudeHookData } from "../utils/claude";
import { getEffortLevel } from "../utils/claude";
import type { PowerlineColors } from "../themes";
import type { PowerlineConfig } from "../config/loader";
import type { BlockInfo } from "./block";
import { formatModelName, abbreviateFishStyle } from "../utils/formatters";
import { swapAnsiRole, hexToAnsi } from "../utils/colors";

export interface SegmentConfig {
  enabled: boolean;
}

export interface DirectorySegmentConfig extends SegmentConfig {
  showBasename?: boolean;
  style?: "full" | "fish" | "basename";
}

export interface GitSegmentConfig extends SegmentConfig {
  showSha?: boolean;
  showAheadBehind?: boolean;
  showWorkingTree?: boolean;
  showOperation?: boolean;
  showTag?: boolean;
  showTimeSinceCommit?: boolean;
  showStashCount?: boolean;
  showUpstream?: boolean;
  showRepoName?: boolean;
}

export interface UsageSegmentConfig extends SegmentConfig {
  type: "cost" | "tokens" | "both" | "breakdown" | "io" | "tokens-today";
  costSource?: "calculated" | "official";
}

export interface TmuxSegmentConfig extends SegmentConfig {}

export type BarDisplayStyle =
  | "text"
  | "ball"
  | "bar"
  | "blocks"
  | "blocks-line"
  | "capped"
  | "dots"
  | "filled"
  | "geometric"
  | "line"
  | "squares";

export interface ContextSegmentConfig extends SegmentConfig {
  showPercentageOnly?: boolean;
  displayStyle?: BarDisplayStyle;
  autocompactBuffer?: number;
  percentageMode?: "remaining" | "used";
}

export interface MetricsSegmentConfig extends SegmentConfig {
  showResponseTime?: boolean;
  showLastResponseTime?: boolean;
  showDuration?: boolean;
  showMessageCount?: boolean;
  showLinesAdded?: boolean;
  showLinesRemoved?: boolean;
}

export interface BlockSegmentConfig extends SegmentConfig {
  type: "cost" | "tokens" | "both" | "time" | "weighted";
  burnType?: "cost" | "tokens" | "both" | "none";
  displayStyle?: BarDisplayStyle;
}

export interface TodaySegmentConfig extends SegmentConfig {
  type: "cost" | "tokens" | "both" | "breakdown";
  mnemoPath?: string;
}

export interface VersionSegmentConfig extends SegmentConfig {}

export interface SessionIdSegmentConfig extends SegmentConfig {
  showIdLabel?: boolean;
}

export interface EnvSegmentConfig extends SegmentConfig {
  variable: string;
  prefix?: string;
}

export interface WeeklySegmentConfig extends SegmentConfig {
  displayStyle?: BarDisplayStyle;
}

export interface FiveHourSegmentConfig extends SegmentConfig {
  displayStyle?: BarDisplayStyle;
}

export interface CacheHitSegmentConfig extends SegmentConfig {}

export type AnySegmentConfig =
  | SegmentConfig
  | DirectorySegmentConfig
  | GitSegmentConfig
  | UsageSegmentConfig
  | TmuxSegmentConfig
  | ContextSegmentConfig
  | MetricsSegmentConfig
  | BlockSegmentConfig
  | TodaySegmentConfig
  | VersionSegmentConfig
  | SessionIdSegmentConfig
  | EnvSegmentConfig
  | WeeklySegmentConfig
  | FiveHourSegmentConfig
  | CacheHitSegmentConfig;

import {
  formatCost,
  formatTokens,
  formatTokenBreakdown,
  formatTimeSince,
  formatDuration,
  formatLongTimeRemaining,
  minutesUntilReset,
} from "../utils/formatters";
import { getBudgetStatus } from "../utils/budget";
import type {
  UsageInfo,
  TokenBreakdown,
  GitInfo,
  ContextInfo,
  MetricsInfo,
} from ".";
import type { CacheHitInfo } from "./cache-hit";
import type { TodayInfo } from "./today";

export interface PowerlineSymbols {
  right: string;
  left: string;
  branch: string;
  model: string;
  git_clean: string;
  git_dirty: string;
  git_conflicts: string;
  git_ahead: string;
  git_behind: string;
  git_worktree: string;
  git_tag: string;
  git_sha: string;
  git_upstream: string;
  git_stash: string;
  git_time: string;
  session_cost: string;
  block_cost: string;
  today_cost: string;
  context_time: string;
  metrics_response: string;
  metrics_last_response: string;
  metrics_duration: string;
  metrics_messages: string;
  metrics_lines_added: string;
  metrics_lines_removed: string;
  metrics_burn: string;
  version: string;
  bar_filled: string;
  bar_empty: string;
  env: string;
  session_id: string;
  weekly_cost: string;
  five_hour: string;
  cache_hit: string;
  token_in: string;
  token_out: string;
}

export interface SegmentData {
  text: string;
  bgColor: string;
  fgColor: string;
}

interface BarStyleDef {
  filled: string;
  empty: string;
  cap?: string;
  marker?: string;
}

const BAR_STYLES: Record<string, BarStyleDef> = {
  ball: { filled: "─", empty: "─", marker: "●" },
  blocks: { filled: "█", empty: "░" },
  "blocks-line": { filled: "█", empty: "─" },
  capped: { filled: "━", empty: "┄", cap: "╸" },
  dots: { filled: "●", empty: "○" },
  filled: { filled: "■", empty: "□" },
  geometric: { filled: "▰", empty: "▱" },
  line: { filled: "━", empty: "┄" },
  squares: { filled: "◼", empty: "◻" },
};

// Claude Code's reasoning-effort palette: the seven rainbow anchors its /effort
// slider scrolls across the "max" label (CC theme.ts lightTheme rainbow_red..
// rainbow_violet -- the exact rgb values). CC_RAINBOW pops on dark chips;
// CC_RAINBOW_DEEP is the same hues halved in luminance so they still read on a
// near-white chip. Order is ROYGBIV(+violet), matching CC's VJ5 array.
const CC_RAINBOW: number[][] = [
  [235, 95, 87], // rainbow_red
  [245, 139, 87], // rainbow_orange
  [250, 195, 95], // rainbow_yellow
  [145, 200, 130], // rainbow_green
  [130, 170, 220], // rainbow_blue
  [155, 130, 200], // rainbow_indigo
  [200, 130, 180], // rainbow_violet
];
const CC_RAINBOW_DEEP: number[][] = CC_RAINBOW.map((c) => [
  Math.round(c[0]! * 0.5),
  Math.round(c[1]! * 0.5),
  Math.round(c[2]! * 0.5),
]);

// CC escalates the effort label by level (its qAq map): the lower three are
// flat semantic colours (low->warning, medium->success, high->permission),
// xhigh sweeps a single bright glyph across a violet base (autoAccept-shimmer),
// and max scrolls the rainbow (rainbow-animated). Each colour is a { dark,
// light } pair -- CC's dark-theme value (pops on dark chips) and its light-theme
// value (reads on near-white) -- the exact rgb from CC's theme.ts.
const EFFORT_LEVEL_COLOR: Record<string, { dark: number[]; light: number[] }> =
  {
    low: { dark: [255, 193, 7], light: [150, 108, 30] }, // warning / amber
    medium: { dark: [78, 186, 101], light: [44, 122, 57] }, // success / green
    high: { dark: [177, 185, 249], light: [87, 105, 247] }, // permission / blue
  };
const EFFORT_XHIGH_BASE = { dark: [175, 135, 255], light: [135, 0, 255] }; // autoAccept violet
const EFFORT_XHIGH_GLINT = { dark: [222, 205, 255], light: [176, 110, 255] }; // sweep highlight

/** Parse the R,G,B of a `38;2`/`48;2` truecolor escape, or null. */
function escRgb(esc: string): [number, number, number] | null {
  const m = /[34]8;2;(\d+);(\d+);(\d+)/.exec(esc);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Paint the effort label with Claude Code's per-level escalation (its /effort
 * slider): low/medium/high are a flat semantic colour, xhigh sweeps a single
 * bright glyph across a violet base (a glint that advances every 100ms), and max
 * scrolls the rainbow (char i takes palette[(i + tick) % 7]). The palette
 * follows the segment background's luminance -- CC's dark-theme tones on dark
 * chips, its light-theme tones on near-white -- while a saturated mid-luminance
 * chip (the light theme's rose model chip) keeps the plain segment fg, since
 * every hue washes out on it. Truecolor only; escapes are stripped by
 * visibleLength so width is unaffected. The statusline is re-invoked
 * periodically rather than per frame, so the animations step by the number of
 * 100ms ticks elapsed between refreshes.
 */
function colorizeEffort(
  effort: string,
  restoreFg: string,
  restoreBg: string,
): string {
  if (!restoreFg.startsWith("\x1b[38;2;")) return effort;
  const bg = escRgb(restoreBg);
  if (!bg) return effort;
  const [cr, cg, cb] = bg;
  const luma = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
  const chroma = Math.max(cr, cg, cb) - Math.min(cr, cg, cb);
  // Saturated mid-luminance chip (the light theme's rose model chip): every hue
  // collides with it and washes out, so keep the plain dark fg. Greys, dark and
  // near-white chips clear that range.
  if (chroma >= 80 && luma > 70 && luma < 190) return effort;
  const light = luma >= 140; // near-white chip -> CC's deeper light-theme tones
  const level = effort.toLowerCase();
  const tick = Math.floor(Date.now() / 100);
  const esc = (c: number[]) => `\x1b[38;2;${c[0]!};${c[1]!};${c[2]!}m`;
  const chars = [...effort];

  // max: rainbow-animated -- the rainbow scrolls across the word over time.
  if (level === "max") {
    const palette = light ? CC_RAINBOW_DEEP : CC_RAINBOW;
    const n = palette.length;
    const painted = chars
      .map((ch, i) => `${esc(palette[(i + tick) % n]!)}${ch}`)
      .join("");
    return `${painted}${restoreFg}`;
  }

  // xhigh: autoAccept-shimmer -- one bright glint sweeps the violet base, with a
  // +4 gap after the word so it pauses before re-entering.
  if (level === "xhigh") {
    const base = esc(light ? EFFORT_XHIGH_BASE.light : EFFORT_XHIGH_BASE.dark);
    const glint = esc(
      light ? EFFORT_XHIGH_GLINT.light : EFFORT_XHIGH_GLINT.dark,
    );
    const z = tick % (chars.length + 4);
    const painted = chars
      .map((ch, i) => `${i === z ? glint : base}${ch}`)
      .join("");
    return `${painted}${restoreFg}`;
  }

  // low / medium / high: a single flat CC semantic colour.
  const lc = EFFORT_LEVEL_COLOR[level];
  if (!lc) return effort;
  return `${esc(light ? lc.light : lc.dark)}${effort}${restoreFg}`;
}

export class SegmentRenderer {
  constructor(
    private readonly config: PowerlineConfig,
    private readonly symbols: PowerlineSymbols,
  ) {}

  renderDirectory(
    hookData: ClaudeHookData,
    colors: PowerlineColors,
    config?: DirectorySegmentConfig,
  ): SegmentData {
    const currentDir = hookData.workspace?.current_dir || hookData.cwd || "/";
    const projectDir = hookData.workspace?.project_dir;

    const style = config?.style ?? (config?.showBasename ? "basename" : "full");

    if (style === "basename") {
      const basename = path.basename(currentDir) || "root";
      return {
        text: basename,
        bgColor: colors.modeBg,
        fgColor: colors.modeFg,
      };
    }

    const homeDir = process.env.HOME || process.env.USERPROFILE;
    let displayDir = currentDir;
    let displayProjectDir = projectDir;

    if (homeDir) {
      if (currentDir.startsWith(homeDir)) {
        displayDir = currentDir.replace(homeDir, "~");
      }
      if (projectDir && projectDir.startsWith(homeDir)) {
        displayProjectDir = projectDir.replace(homeDir, "~");
      }
    }

    let dirName = this.getDisplayDirectoryName(displayDir, displayProjectDir);

    if (style === "fish") {
      dirName = abbreviateFishStyle(dirName);
    }

    return {
      text: dirName,
      bgColor: colors.modeBg,
      fgColor: colors.modeFg,
    };
  }

  renderGit(
    gitInfo: GitInfo,
    colors: PowerlineColors,
    config?: GitSegmentConfig,
  ): SegmentData | null {
    if (!gitInfo) return null;

    const parts: string[] = [];

    if (config?.showRepoName && gitInfo.repoName) {
      parts.push(gitInfo.repoName);
      if (gitInfo.isWorktree) {
        parts.push(this.symbols.git_worktree);
      }
    }

    if (config?.showOperation && gitInfo.operation) {
      parts.push(`[${gitInfo.operation}]`);
    }

    parts.push(`${this.symbols.branch} ${gitInfo.branch}`);

    if (config?.showTag && gitInfo.tag) {
      parts.push(`${this.symbols.git_tag} ${gitInfo.tag}`);
    }

    if (config?.showSha && gitInfo.sha) {
      parts.push(`${this.symbols.git_sha} ${gitInfo.sha}`);
    }

    if (config?.showAheadBehind !== false) {
      if (gitInfo.ahead > 0 && gitInfo.behind > 0) {
        parts.push(
          `${this.symbols.git_ahead}${gitInfo.ahead}${this.symbols.git_behind}${gitInfo.behind}`,
        );
      } else if (gitInfo.ahead > 0) {
        parts.push(`${this.symbols.git_ahead}${gitInfo.ahead}`);
      } else if (gitInfo.behind > 0) {
        parts.push(`${this.symbols.git_behind}${gitInfo.behind}`);
      }
    }

    if (config?.showWorkingTree) {
      const counts: string[] = [];
      if (gitInfo.staged && gitInfo.staged > 0)
        counts.push(`+${gitInfo.staged}`);
      if (gitInfo.unstaged && gitInfo.unstaged > 0)
        counts.push(`~${gitInfo.unstaged}`);
      if (gitInfo.untracked && gitInfo.untracked > 0)
        counts.push(`?${gitInfo.untracked}`);
      if (gitInfo.conflicts && gitInfo.conflicts > 0)
        counts.push(`!${gitInfo.conflicts}`);
      if (counts.length > 0) {
        parts.push(`(${counts.join(" ")})`);
      }
    }

    if (config?.showUpstream && gitInfo.upstream) {
      parts.push(`${this.symbols.git_upstream}${gitInfo.upstream}`);
    }

    if (
      config?.showStashCount &&
      gitInfo.stashCount &&
      gitInfo.stashCount > 0
    ) {
      parts.push(`${this.symbols.git_stash} ${gitInfo.stashCount}`);
    }

    if (config?.showTimeSinceCommit && gitInfo.timeSinceCommit !== undefined) {
      const time = formatTimeSince(gitInfo.timeSinceCommit);
      parts.push(`${this.symbols.git_time} ${time}`);
    }

    let gitStatusIcon = this.symbols.git_clean;
    if (gitInfo.status === "conflicts") {
      gitStatusIcon = this.symbols.git_conflicts;
    } else if (gitInfo.status === "dirty") {
      gitStatusIcon = this.symbols.git_dirty;
    }
    parts.push(gitStatusIcon);

    return {
      text: parts.join(" "),
      bgColor: colors.gitBg,
      fgColor: colors.gitFg,
    };
  }

  renderModel(hookData: ClaudeHookData, colors: PowerlineColors): SegmentData {
    const rawName = hookData.model?.display_name || "Claude";
    let modelName = formatModelName(rawName);

    // Replace the trailing context suffix (e.g. "(1M)") with the current
    // reasoning effort (e.g. "(max)"). Prefer the live session value from the
    // statusline payload — it reflects mid-session /effort changes, including
    // session-only levels like "max" that never hit settings.json — and fall
    // back to the persisted settings value on older CC that doesn't send it.
    const effort = hookData.effort?.level || getEffortLevel();
    if (effort) {
      const base = modelName.replace(/\s*\([^)]*\)\s*$/, "");
      // Tint the level per the /effort ramp (max gets a pink->red gradient);
      // colors.modelFg restores the segment fg after the coloured word, and
      // colors.modelBg picks the light- vs dark-bg rainbow tuning.
      modelName = `${base} (${colorizeEffort(effort, colors.modelFg, colors.modelBg)})`;
    }

    return {
      text: `${this.symbols.model} ${modelName}`,
      bgColor: colors.modelBg,
      fgColor: colors.modelFg,
    };
  }

  renderSession(
    usageInfo: UsageInfo,
    colors: PowerlineColors,
    config?: UsageSegmentConfig,
  ): SegmentData {
    const type = config?.type || "cost";
    const costSource = config?.costSource;
    const sessionBudget = this.config.budget?.session;

    const getCost = () => {
      if (costSource === "calculated") return usageInfo.session.calculatedCost;
      if (costSource === "official") return usageInfo.session.officialCost;
      return usageInfo.session.cost;
    };

    const formattedUsage = this.formatUsageWithBudget(
      getCost(),
      usageInfo.session.tokens,
      usageInfo.session.tokenBreakdown,
      type,
      sessionBudget?.amount,
      sessionBudget?.warningThreshold || 80,
      sessionBudget?.type,
      usageInfo.session.todayTokens,
    );

    const text = `${this.symbols.session_cost} ${formattedUsage}`;

    return {
      text,
      bgColor: colors.sessionBg,
      fgColor: colors.sessionFg,
    };
  }

  renderSessionId(
    sessionId: string,
    colors: PowerlineColors,
    config?: SessionIdSegmentConfig,
  ): SegmentData {
    const showLabel = config?.showIdLabel !== false;
    const text = showLabel
      ? `${this.symbols.session_id} ${sessionId}`
      : sessionId;

    return {
      text,
      bgColor: colors.sessionBg,
      fgColor: colors.sessionFg,
    };
  }

  renderTmux(
    sessionId: string | null,
    colors: PowerlineColors,
  ): SegmentData | null {
    if (!sessionId) {
      return {
        text: `tmux:none`,
        bgColor: colors.tmuxBg,
        fgColor: colors.tmuxFg,
      };
    }

    return {
      text: `tmux:${sessionId}`,
      bgColor: colors.tmuxBg,
      fgColor: colors.tmuxFg,
    };
  }

  renderContext(
    contextInfo: ContextInfo | null,
    colors: PowerlineColors,
    config?: ContextSegmentConfig,
  ): SegmentData | null {
    const barLength = 10;
    const style = config?.displayStyle ?? "text";
    const defaultMode = style === "text" ? "remaining" : "used";
    const mode = config?.percentageMode ?? defaultMode;

    const barStyleDef = this.resolveBarStyleDef(style);

    const emptyPct = mode === "remaining" ? "100%" : "0%";
    if (!contextInfo) {
      if (barStyleDef) {
        const emptyBar = barStyleDef.empty.repeat(barLength);
        return {
          text: `${emptyBar} ${emptyPct}`,
          bgColor: colors.contextBg,
          fgColor: colors.contextFg,
        };
      }
      return {
        text: `${this.symbols.context_time} 0 (${emptyPct})`,
        bgColor: colors.contextBg,
        fgColor: colors.contextFg,
      };
    }

    let bgColor = colors.contextBg;
    let fgColor = colors.contextFg;

    if (
      contextInfo.contextLeftPercentage <= 20 ||
      contextInfo.totalTokens >= 500_000
    ) {
      // Urgent: saturated aqua fill (own-colour inversion), dark text.
      // swapAnsiRole keeps the escapes role-correct so the powerline arrow
      // drawn from bgColor also picks up the fill colour. The absolute 500k
      // trigger covers large (e.g. 1M) context windows where 20% left is
      // still a huge number of tokens in flight.
      bgColor = swapAnsiRole(colors.contextFg);
      fgColor = swapAnsiRole(colors.contextBg);
    } else if (
      contextInfo.contextLeftPercentage <= 40 ||
      contextInfo.totalTokens >= 300_000
    ) {
      // Caution: pale aqua fill, dark text -- the soft tone of context's own
      // hue, a "running low, heads up" step below the vivid urgent fill. The
      // 300k absolute trigger mirrors the urgent tier's 500k for large (1M)
      // windows where 40% left is still a huge number of tokens in flight.
      bgColor = hexToAnsi("#95ece4", true);
      fgColor = hexToAnsi("#1a1a1a", false);
    }

    const pct =
      mode === "remaining"
        ? contextInfo.contextLeftPercentage
        : contextInfo.usablePercentage;
    const filledCount = Math.round(
      (contextInfo.usablePercentage / 100) * barLength,
    );
    const emptyCount = barLength - filledCount;

    if (barStyleDef) {
      const bar = this.buildBar(
        barStyleDef,
        filledCount,
        emptyCount,
        barLength,
      );

      const text = config?.showPercentageOnly
        ? `${bar} ${pct}%`
        : `${bar} ${contextInfo.totalTokens.toLocaleString()} (${pct}%)`;

      return { text, bgColor, fgColor };
    }

    const text = config?.showPercentageOnly
      ? `${this.symbols.context_time} ${pct}%`
      : `${this.symbols.context_time} ${contextInfo.totalTokens.toLocaleString()} (${pct}%)`;

    return { text, bgColor, fgColor };
  }

  private buildBar(
    s: BarStyleDef,
    filledCount: number,
    emptyCount: number,
    barLength: number,
  ): string {
    if (s.marker) {
      const pos = Math.min(filledCount, barLength - 1);
      return (
        s.filled.repeat(pos) + s.marker + s.empty.repeat(barLength - pos - 1)
      );
    }
    if (s.cap) {
      if (filledCount === 0) {
        return s.cap + s.empty.repeat(barLength - 1);
      }
      if (filledCount >= barLength) {
        return s.filled.repeat(barLength);
      }
      return (
        s.filled.repeat(filledCount - 1) + s.cap + s.empty.repeat(emptyCount)
      );
    }
    return s.filled.repeat(filledCount) + s.empty.repeat(emptyCount);
  }

  private resolveBarStyleDef(style: string): BarStyleDef | null {
    return style === "bar"
      ? { filled: this.symbols.bar_filled, empty: this.symbols.bar_empty }
      : (BAR_STYLES[style] ?? null);
  }

  private formatPercentageWithBar(
    pct: number,
    displayStyle?: BarDisplayStyle,
    timeStr?: string | null,
  ): string {
    const style = displayStyle ?? "text";
    const barStyleDef = this.resolveBarStyleDef(style);
    const barLength = 10;

    if (barStyleDef) {
      const filledCount = Math.round((pct / 100) * barLength);
      const emptyCount = barLength - filledCount;
      const bar = this.buildBar(
        barStyleDef,
        filledCount,
        emptyCount,
        barLength,
      );
      return timeStr ? `${bar} ${pct}% (${timeStr})` : `${bar} ${pct}%`;
    }
    return timeStr ? `${pct}% (${timeStr})` : `${pct}%`;
  }

  renderMetrics(
    metricsInfo: MetricsInfo | null,
    colors: PowerlineColors,
    _blockInfo: BlockInfo | null,
    config?: MetricsSegmentConfig,
  ): SegmentData | null {
    if (!metricsInfo) {
      return {
        text: `${this.symbols.metrics_response} new`,
        bgColor: colors.metricsBg,
        fgColor: colors.metricsFg,
      };
    }

    const parts: string[] = [];

    if (config?.showLastResponseTime && metricsInfo.lastResponseTime !== null) {
      const lastResponseTime =
        metricsInfo.lastResponseTime < 60
          ? `${metricsInfo.lastResponseTime.toFixed(1)}s`
          : `${(metricsInfo.lastResponseTime / 60).toFixed(1)}m`;
      parts.push(`${this.symbols.metrics_last_response} ${lastResponseTime}`);
    }

    if (
      config?.showResponseTime !== false &&
      metricsInfo.responseTime !== null
    ) {
      const responseTime =
        metricsInfo.responseTime < 60
          ? `${metricsInfo.responseTime.toFixed(1)}s`
          : `${(metricsInfo.responseTime / 60).toFixed(1)}m`;
      parts.push(`${this.symbols.metrics_response} ${responseTime}`);
    }

    if (
      config?.showDuration !== false &&
      metricsInfo.sessionDuration !== null
    ) {
      const duration = formatDuration(metricsInfo.sessionDuration);
      parts.push(`${this.symbols.metrics_duration} ${duration}`);
    }

    if (
      config?.showMessageCount !== false &&
      metricsInfo.messageCount !== null
    ) {
      parts.push(
        `${this.symbols.metrics_messages} ${metricsInfo.messageCount}`,
      );
    }

    if (
      config?.showLinesAdded !== false &&
      metricsInfo.linesAdded !== null &&
      metricsInfo.linesAdded > 0
    ) {
      parts.push(
        `${this.symbols.metrics_lines_added} ${metricsInfo.linesAdded}`,
      );
    }

    if (
      config?.showLinesRemoved !== false &&
      metricsInfo.linesRemoved !== null &&
      metricsInfo.linesRemoved > 0
    ) {
      parts.push(
        `${this.symbols.metrics_lines_removed} ${metricsInfo.linesRemoved}`,
      );
    }

    if (parts.length === 0) {
      return {
        text: `${this.symbols.metrics_response} active`,
        bgColor: colors.metricsBg,
        fgColor: colors.metricsFg,
      };
    }

    return {
      text: parts.join(" "),
      bgColor: colors.metricsBg,
      fgColor: colors.metricsFg,
    };
  }

  renderBlock(
    blockInfo: BlockInfo,
    colors: PowerlineColors,
    config?: BlockSegmentConfig,
  ): SegmentData {
    if (blockInfo.source === "native" && blockInfo.nativeUtilization !== null) {
      return this.renderNativeBlock(blockInfo, colors, config);
    }
    return this.renderTranscriptBlock(blockInfo, colors, config);
  }

  private renderNativeBlock(
    blockInfo: BlockInfo,
    colors: PowerlineColors,
    config?: BlockSegmentConfig,
  ): SegmentData {
    const pct = Math.round(blockInfo.nativeUtilization!);
    const timeStr = this.formatBlockTimeRemaining(blockInfo.timeRemaining);
    const blockBudget = this.config.budget?.block;
    const warningThreshold = blockBudget?.warningThreshold ?? 80;

    let bgColor = colors.blockBg;
    let fgColor = colors.blockFg;
    if (pct >= warningThreshold) {
      bgColor = colors.contextCriticalBg;
      fgColor = colors.contextCriticalFg;
    } else if (pct >= 50) {
      bgColor = colors.contextWarningBg;
      fgColor = colors.contextWarningFg;
    }

    return {
      text: `${this.symbols.block_cost} ${this.formatPercentageWithBar(pct, config?.displayStyle, timeStr)}`,
      bgColor,
      fgColor,
    };
  }

  private renderTranscriptBlock(
    blockInfo: BlockInfo,
    colors: PowerlineColors,
    config?: BlockSegmentConfig,
  ): SegmentData {
    let displayText: string;

    if (blockInfo.cost === null && blockInfo.tokens === null) {
      displayText = "No active block";
    } else {
      const type = config?.type || "cost";
      const burnType = config?.burnType;
      const blockBudget = this.config.budget?.block;

      const timeStr = this.formatBlockTimeRemaining(blockInfo.timeRemaining);

      let mainContent: string;
      switch (type) {
        case "cost":
          mainContent = this.formatUsageWithBudget(
            blockInfo.cost,
            null,
            null,
            "cost",
            blockBudget?.amount,
            blockBudget?.warningThreshold,
            blockBudget?.type,
          );
          break;
        case "tokens":
          mainContent = this.formatUsageWithBudget(
            null,
            blockInfo.tokens,
            null,
            "tokens",
            blockBudget?.amount,
            blockBudget?.warningThreshold,
            blockBudget?.type,
          );
          break;
        case "weighted": {
          const rateLimit =
            blockBudget?.type === "tokens" ? blockBudget.amount : undefined;
          const weightedDisplay = formatTokens(blockInfo.weightedTokens);
          if (rateLimit && blockInfo.weightedTokens !== null) {
            const rateLimitStatus = getBudgetStatus(
              blockInfo.weightedTokens,
              rateLimit,
              blockBudget?.warningThreshold || 80,
            );
            mainContent = `${weightedDisplay}${rateLimitStatus.displayText}`;
          } else {
            mainContent = `${weightedDisplay} (weighted)`;
          }
          break;
        }
        case "both":
          mainContent = this.formatUsageWithBudget(
            blockInfo.cost,
            blockInfo.tokens,
            null,
            "both",
            blockBudget?.amount,
            blockBudget?.warningThreshold,
            blockBudget?.type,
          );
          break;
        case "time":
          mainContent = timeStr || "N/A";
          break;
        default:
          mainContent = this.formatUsageWithBudget(
            blockInfo.cost,
            null,
            null,
            "cost",
            blockBudget?.amount,
            blockBudget?.warningThreshold,
            blockBudget?.type,
          );
      }

      let burnContent = "";
      if (burnType && burnType !== "none") {
        switch (burnType) {
          case "cost": {
            const costBurnRate =
              blockInfo.burnRate !== null
                ? blockInfo.burnRate < 1
                  ? `${(blockInfo.burnRate * 100).toFixed(0)}¢/h`
                  : `$${blockInfo.burnRate.toFixed(2)}/h`
                : "N/A";
            burnContent = ` | ${costBurnRate}`;
            break;
          }
          case "tokens": {
            const tokenBurnRate =
              blockInfo.tokenBurnRate !== null
                ? `${formatTokens(Math.round(blockInfo.tokenBurnRate))}/h`
                : "N/A";
            burnContent = ` | ${tokenBurnRate}`;
            break;
          }
          case "both": {
            const costBurn =
              blockInfo.burnRate !== null
                ? blockInfo.burnRate < 1
                  ? `${(blockInfo.burnRate * 100).toFixed(0)}¢/h`
                  : `$${blockInfo.burnRate.toFixed(2)}/h`
                : "N/A";
            const tokenBurn =
              blockInfo.tokenBurnRate !== null
                ? `${formatTokens(Math.round(blockInfo.tokenBurnRate))}/h`
                : "N/A";
            burnContent = ` | ${costBurn} / ${tokenBurn}`;
            break;
          }
        }
      }

      if (type === "time") {
        displayText = mainContent;
      } else {
        displayText = timeStr
          ? `${mainContent}${burnContent} (${timeStr} left)`
          : `${mainContent}${burnContent}`;
      }
    }

    return {
      text: `${this.symbols.block_cost} ${displayText}`,
      bgColor: colors.blockBg,
      fgColor: colors.blockFg,
    };
  }

  private formatBlockTimeRemaining(
    timeRemaining: number | null,
  ): string | null {
    if (timeRemaining === null) return null;
    const hours = Math.floor(timeRemaining / 60);
    const minutes = timeRemaining % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  renderWeekly(
    hookData: ClaudeHookData,
    colors: PowerlineColors,
    config?: WeeklySegmentConfig,
  ): SegmentData | null {
    const sevenDay = hookData.rate_limits?.seven_day;
    if (!sevenDay) return null;

    const pct = Math.round(sevenDay.used_percentage);
    const timeStr = formatLongTimeRemaining(
      minutesUntilReset(sevenDay.resets_at),
    );

    let bgColor = colors.weeklyBg;
    let fgColor = colors.weeklyFg;
    if (pct >= 80) {
      // Escalated alert: weekly's own saturated orange fill (true fg/bg
      // inversion), dark text -- the urgent signal as the limit nears.
      bgColor = swapAnsiRole(colors.weeklyFg);
      fgColor = swapAnsiRole(colors.weeklyBg);
    } else if (pct >= 50) {
      // Caution: solid warm-peach fill, dark text. A soft peach reads as a
      // "past halfway, heads up" nudge -- gentler than the saturated orange,
      // which is held back to mark the more urgent >=80% escalation.
      bgColor = hexToAnsi("#faae7f", true);
      fgColor = hexToAnsi("#1a1a1a", false);
    }

    return {
      text: `${this.symbols.weekly_cost} ${this.formatPercentageWithBar(pct, config?.displayStyle, timeStr)}`,
      bgColor,
      fgColor,
    };
  }

  renderFiveHour(
    hookData: ClaudeHookData,
    colors: PowerlineColors,
    config?: FiveHourSegmentConfig,
  ): SegmentData | null {
    const fiveHour = hookData.rate_limits?.five_hour;
    if (!fiveHour) return null;

    const pct = Math.round(fiveHour.used_percentage);
    const timeStr = formatLongTimeRemaining(
      minutesUntilReset(fiveHour.resets_at),
    );

    let bgColor = colors.fiveHourBg;
    let fgColor = colors.fiveHourFg;
    if (pct >= 80) {
      // Escalated: saturated lime fill (own-colour inversion), dark text.
      bgColor = swapAnsiRole(colors.fiveHourFg);
      fgColor = swapAnsiRole(colors.fiveHourBg);
    } else if (pct >= 50) {
      // Caution: pale lime fill, dark text -- the soft tone of 5h's own hue,
      // a "past halfway" nudge below the vivid >=80% escalation.
      bgColor = hexToAnsi("#edfc88", true);
      fgColor = hexToAnsi("#1a1a1a", false);
    }

    return {
      text: `${this.symbols.five_hour} ${this.formatPercentageWithBar(pct, config?.displayStyle, timeStr)}`,
      bgColor,
      fgColor,
    };
  }

  renderToday(
    todayInfo: TodayInfo,
    colors: PowerlineColors,
    type = "cost",
  ): SegmentData {
    let text: string;

    if (todayInfo.mnemoSubcost != null) {
      // mnemoSubcost is already included in todayInfo.cost; just annotate the portion
      const mnemoStr =
        todayInfo.mnemoSubcost < 0.01
          ? `${(todayInfo.mnemoSubcost * 100).toFixed(1)}¢`
          : todayInfo.mnemoSubcost.toFixed(2);
      text = `${this.symbols.today_cost} ${formatCost(todayInfo.cost)} (${mnemoStr})`;
    } else {
      const todayBudget = this.config.budget?.today;
      text = `${this.symbols.today_cost} ${this.formatUsageWithBudget(
        todayInfo.cost,
        todayInfo.tokens,
        todayInfo.tokenBreakdown,
        type,
        todayBudget?.amount,
        todayBudget?.warningThreshold,
        todayBudget?.type,
      )}`;
    }

    return {
      text,
      bgColor: colors.todayBg,
      fgColor: colors.todayFg,
    };
  }

  private getDisplayDirectoryName(
    currentDir: string,
    projectDir?: string,
  ): string {
    if (currentDir.startsWith("~")) {
      return currentDir;
    }

    if (projectDir && projectDir !== currentDir) {
      if (currentDir.startsWith(projectDir)) {
        const relativePath = currentDir.slice(projectDir.length + 1);
        return relativePath || path.basename(projectDir) || "project";
      }
    }

    return currentDir;
  }

  private formatUsageDisplay(
    cost: number | null,
    tokens: number | null,
    tokenBreakdown: TokenBreakdown | null,
    type: string,
    todayTokens: number | null = null,
  ): string {
    switch (type) {
      case "cost":
        return formatCost(cost);
      case "tokens":
        return formatTokens(tokens);
      case "both":
        return `${formatCost(cost)} (${formatTokens(tokens)})`;
      case "tokens-today":
        return `${formatTokens(tokens)} (${formatTokens(todayTokens)})`;
      case "breakdown":
        return formatTokenBreakdown(tokenBreakdown);
      case "io": {
        if (!tokenBreakdown) {
          return `${this.symbols.token_in}0 ${this.symbols.token_out}0`;
        }
        const inputTokens =
          tokenBreakdown.input +
          tokenBreakdown.cacheCreation +
          tokenBreakdown.cacheRead;
        return `${this.symbols.token_in}${formatTokens(inputTokens)} ${this.symbols.token_out}${formatTokens(tokenBreakdown.output)}`;
      }
      default:
        return formatCost(cost);
    }
  }

  private formatUsageWithBudget(
    cost: number | null,
    tokens: number | null,
    tokenBreakdown: TokenBreakdown | null,
    type: string,
    budget: number | undefined,
    warningThreshold = 80,
    budgetType?: "cost" | "tokens",
    todayTokens: number | null = null,
  ): string {
    const baseDisplay = this.formatUsageDisplay(
      cost,
      tokens,
      tokenBreakdown,
      type,
      todayTokens,
    );

    if (budget && budget > 0) {
      let budgetValue: number | null = null;

      if (budgetType === "tokens" && tokens !== null) {
        budgetValue = tokens;
      } else if (budgetType === "cost" && cost !== null) {
        budgetValue = cost;
      } else if (!budgetType && cost !== null) {
        budgetValue = cost;
      }

      if (budgetValue !== null) {
        const budgetStatus = getBudgetStatus(
          budgetValue,
          budget,
          warningThreshold,
        );
        return baseDisplay + budgetStatus.displayText;
      }
    }

    return baseDisplay;
  }

  renderVersion(
    hookData: ClaudeHookData,
    colors: PowerlineColors,
    _config?: VersionSegmentConfig,
  ): SegmentData | null {
    if (!hookData.version) {
      return null;
    }

    return {
      text: `${this.symbols.version} v${hookData.version}`,
      bgColor: colors.versionBg,
      fgColor: colors.versionFg,
    };
  }

  renderCacheHit(
    cacheHitInfo: CacheHitInfo | null,
    colors: PowerlineColors,
    _config?: CacheHitSegmentConfig,
  ): SegmentData | null {
    if (!cacheHitInfo) return null;

    let ttlText = "";
    if (
      cacheHitInfo.cacheLastAccessedAt !== null &&
      cacheHitInfo.cacheTtlMs !== null
    ) {
      const expiresAt =
        cacheHitInfo.cacheLastAccessedAt + cacheHitInfo.cacheTtlMs;
      if (expiresAt > Date.now()) {
        const d = new Date(expiresAt);
        const hh = d.getHours().toString().padStart(2, "0");
        const mm = d.getMinutes().toString().padStart(2, "0");
        const ss = d.getSeconds().toString().padStart(2, "0");
        ttlText = ` (${hh}:${mm}:${ss})`;
      }
    }

    let bgColor = colors.cacheHitBg;
    let fgColor = colors.cacheHitFg;
    if (cacheHitInfo.hitRate < 50) {
      // Escalated: saturated violet fill (own-colour inversion), dark text --
      // a hit rate below 50% is the urgent case.
      bgColor = swapAnsiRole(colors.cacheHitFg);
      fgColor = swapAnsiRole(colors.cacheHitBg);
    } else if (cacheHitInfo.hitRate < 90) {
      // Caution: pale violet fill, dark text -- cache hit rates normally sit
      // high (90%+), so slipping below 90% is a soft "heads up" below the
      // vivid <50% escalation.
      bgColor = hexToAnsi("#cca9e7", true);
      fgColor = hexToAnsi("#1a1a1a", false);
    }

    return {
      text: `${this.symbols.cache_hit} ${cacheHitInfo.hitRate}%${ttlText}`,
      bgColor,
      fgColor,
    };
  }

  renderEnv(
    colors: PowerlineColors,
    config: EnvSegmentConfig,
  ): SegmentData | null {
    const value = process.env[config.variable];
    if (!value) return null;
    const prefix = config.prefix ?? config.variable;
    const text = prefix
      ? `${this.symbols.env} ${prefix}: ${value}`
      : `${this.symbols.env} ${value}`;
    return { text, bgColor: colors.envBg, fgColor: colors.envFg };
  }
}
