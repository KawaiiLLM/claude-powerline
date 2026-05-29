import path from "node:path";
import { homedir } from "node:os";
import { debug } from "../utils/logger";
import { PricingService } from "./pricing";
import { CacheManager } from "../utils/cache";
import { loadEntriesFromProjects, type ParsedEntry } from "../utils/claude";

// The mnemo project appears as a regular Claude Code project under ~/.claude/projects/.
// Claude derives the project dir name by replacing every '/' in the working dir path with '-'.
// Working dir ~/.claude-mnemo → -Users-<username>--claude-mnemo
const _mnemoWorkDir = path.join(homedir(), ".claude-mnemo");
export const DEFAULT_MNEMO_PROJECT_PATH = path.join(
  homedir(),
  ".claude",
  "projects",
  _mnemoWorkDir.replace(/[/.]/g, "-"),
);

export interface MnemoInfo {
  cost: number;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export class MnemoProvider {
  async getMnemoInfo(
    projectPath = DEFAULT_MNEMO_PROJECT_PATH,
  ): Promise<MnemoInfo | null> {
    const resolvedPath = projectPath.startsWith("~/")
      ? path.join(homedir(), projectPath.slice(2))
      : projectPath;
    return this._getMnemoInfo(resolvedPath);
  }

  private async _getMnemoInfo(projectPath: string): Promise<MnemoInfo | null> {
    try {
      const latestMtime = await CacheManager.getLatestTranscriptMtime();
      const cached = await CacheManager.getUsageCache("mnemo", latestMtime);
      if (cached) {
        debug("Using mnemo usage cache");
        return cached as MnemoInfo;
      }

      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const todayDate = formatDate(new Date());

      const fileFilter = (filePath: string, modTime: Date): boolean =>
        filePath.startsWith(projectPath) && modTime >= todayMidnight;

      const timeFilter = (entry: ParsedEntry): boolean =>
        entry.timestamp >= todayMidnight &&
        formatDate(entry.timestamp) === todayDate;

      const entries = await loadEntriesFromProjects(timeFilter, fileFilter);

      let totalCost = 0;
      for (const entry of entries) {
        if (!entry.message?.usage) continue;
        let cost = entry.costUSD;
        if (!cost && entry.raw) {
          cost = await PricingService.calculateCostForEntry(entry.raw);
        }
        totalCost += cost || 0;
      }

      const result: MnemoInfo = { cost: totalCost };
      await CacheManager.setUsageCache("mnemo", result, latestMtime);
      return result;
    } catch (error) {
      debug("Error getting mnemo info:", error);
      return null;
    }
  }
}
