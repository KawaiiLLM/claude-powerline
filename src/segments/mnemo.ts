import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { debug } from "../utils/logger";
import { PricingService } from "./pricing";
import { CacheManager } from "../utils/cache";
import { parseJsonlFile } from "../utils/claude";

export const DEFAULT_MNEMO_PATH = path.join(
  homedir(),
  ".claude-mnemo",
  "sessions",
);

export interface MnemoInfo {
  cost: number;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function getLatestMtime(dirPath: string): Promise<number> {
  try {
    const files = await fs.promises.readdir(dirPath);
    let latest = 0;
    for (const file of files.filter((f) => f.endsWith(".jsonl"))) {
      const stat = await fs.promises.stat(path.join(dirPath, file));
      if (stat.mtimeMs > latest) latest = stat.mtimeMs;
    }
    return latest;
  } catch {
    return Date.now();
  }
}

export class MnemoProvider {
  async getMnemoInfo(sessionsPath = DEFAULT_MNEMO_PATH): Promise<MnemoInfo | null> {
    const resolvedPath = sessionsPath.startsWith("~/")
      ? path.join(homedir(), sessionsPath.slice(2))
      : sessionsPath;
    return this._getMnemoInfo(resolvedPath);
  }

  private async _getMnemoInfo(sessionsPath: string): Promise<MnemoInfo | null> {
    try {
      const latestMtime = await getLatestMtime(sessionsPath);
      const cached = await CacheManager.getUsageCache("mnemo", latestMtime);
      if (cached) {
        debug("Using mnemo usage cache");
        return cached as MnemoInfo;
      }

      const todayDate = formatDate(new Date());
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);

      let files: string[];
      try {
        files = (await fs.promises.readdir(sessionsPath))
          .filter((f) => f.endsWith(".jsonl"))
          .map((f) => path.join(sessionsPath, f));
      } catch {
        debug(`Mnemo sessions path not found: ${sessionsPath}`);
        return null;
      }

      let totalCost = 0;
      const seen = new Set<string>();

      for (const filePath of files) {
        const stat = await fs.promises.stat(filePath);
        if (stat.mtimeMs < todayMidnight.getTime()) continue;

        const entries = await parseJsonlFile(filePath);
        for (const entry of entries) {
          if (!entry.message?.usage) continue;
          if (entry.timestamp < todayMidnight) continue;
          if (formatDate(entry.timestamp) !== todayDate) continue;

          const msgId = entry.message.id;
          if (msgId) {
            if (seen.has(msgId)) continue;
            seen.add(msgId);
          }

          let cost = entry.costUSD;
          if (!cost && entry.raw) {
            cost = await PricingService.calculateCostForEntry(entry.raw);
          }
          totalCost += cost || 0;
        }
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
