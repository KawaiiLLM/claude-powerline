import { open } from "node:fs/promises";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { debug } from "../utils/logger";
import { findTranscriptFile, type ClaudeHookData } from "../utils/claude";

export interface CacheHitInfo {
  cacheRead: number;
  cacheCreation: number;
  inputTokens: number;
  hitRate: number;
  cacheLastAccessedAt: number | null;
  cacheTtlMs: number | null;
}

interface ParsedLine {
  uuid?: string;
  type?: string;
  promptId?: string;
  cacheRead: number;
  cacheCreation: number;
  cacheCreation5m: number;
  cacheCreation1h: number;
  inputTokens: number;
  hasUsage: boolean;
  timestamp?: number;
}

const CHUNK_SIZE = 32 * 1024;

/**
 * Read tail of file in non-overlapping chunks, parse each JSONL line once,
 * and return parsed entries covering at least two user boundaries (for fallback).
 */
async function readTailParsed(filePath: string): Promise<ParsedLine[]> {
  const fileInfo = await stat(filePath);
  const fileSize = fileInfo.size;
  if (fileSize === 0) return [];

  const fh = await open(filePath, "r");
  try {
    let end = fileSize;
    let accumulated = "";
    let userCount = 0;

    while (end > 0) {
      const start = Math.max(0, end - CHUNK_SIZE);
      const readSize = end - start;
      const buf = Buffer.alloc(readSize);
      await fh.read(buf, 0, readSize, start);
      accumulated = buf.toString("utf-8") + accumulated;
      end = start;

      // Count user entries found so far — need at least 2 for fallback
      let count = 0;
      const lines = accumulated.split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        const l = lines[i]!.trim();
        if (!l) continue;
        // Quick check without full JSON parse
        if (
          l.includes('"type":"user"') ||
          l.includes('"type":"human"') ||
          l.includes('"type": "user"') ||
          l.includes('"type": "human"')
        ) {
          count++;
          if (count >= 2) break;
        }
      }
      userCount = count;

      if (userCount >= 2 || start === 0) break;
    }

    // Parse all lines once, deduping by uuid. Claude Code re-appends the
    // session history on `--continue` / `--resume`, producing duplicate
    // entries with identical uuid.
    const result: ParsedLine[] = [];
    const seenUuids = new Set<string>();
    for (const line of accumulated.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const raw = JSON.parse(trimmed);
        if (typeof raw.uuid === "string") {
          if (seenUuids.has(raw.uuid)) continue;
          seenUuids.add(raw.uuid);
        }
        const usage = raw.message?.usage;
        const ts = raw.timestamp
          ? new Date(raw.timestamp as string).getTime()
          : undefined;
        result.push({
          uuid: typeof raw.uuid === "string" ? raw.uuid : undefined,
          type: raw.type,
          promptId: typeof raw.promptId === "string" ? raw.promptId : undefined,
          cacheRead: usage?.cache_read_input_tokens || 0,
          cacheCreation: usage?.cache_creation_input_tokens || 0,
          cacheCreation5m:
            usage?.cache_creation?.ephemeral_5m_input_tokens || 0,
          cacheCreation1h:
            usage?.cache_creation?.ephemeral_1h_input_tokens || 0,
          inputTokens: usage?.input_tokens || 0,
          hasUsage: !!usage,
          timestamp: Number.isNaN(ts) ? undefined : ts,
        });
      } catch {
        continue;
      }
    }

    return result;
  } finally {
    await fh.close();
  }
}

function isUserEntry(entry: ParsedLine): boolean {
  return entry.type === "user" || entry.type === "human";
}

/**
 * Calculate the weighted cache hit rate for entries in [from, to):
 * ΣcacheRead / Σtotal. This reflects how much of the turn's total
 * token cost landed on cheap cache reads.
 */
function calcTurnHitRate(
  entries: ParsedLine[],
  from: number,
  to: number,
): CacheHitInfo | null {
  let sumCacheRead = 0;
  let sumCacheCreation = 0;
  let sumInput = 0;
  let hasAny = false;

  for (let i = from; i < to; i++) {
    const e = entries[i]!;
    if (!e.hasUsage || isUserEntry(e)) continue;

    const total = e.inputTokens + e.cacheRead + e.cacheCreation;
    if (total === 0) continue;

    sumCacheRead += e.cacheRead;
    sumCacheCreation += e.cacheCreation;
    sumInput += e.inputTokens;
    hasAny = true;
  }

  if (!hasAny) return null;

  const sumTotal = sumCacheRead + sumCacheCreation + sumInput;
  return {
    cacheRead: sumCacheRead,
    cacheCreation: sumCacheCreation,
    inputTokens: sumInput,
    hitRate: Math.round((sumCacheRead / sumTotal) * 100),
    cacheLastAccessedAt: null,
    cacheTtlMs: null,
  };
}

export class CacheHitProvider {
  async getCacheHitInfo(
    hookData: ClaudeHookData,
  ): Promise<CacheHitInfo | null> {
    try {
      const transcriptPath =
        hookData.transcript_path ||
        (await findTranscriptFile(hookData.session_id));

      if (!transcriptPath || !existsSync(transcriptPath)) {
        return null;
      }

      const entries = await readTailParsed(transcriptPath);

      // Find real turn boundaries: type=user with a new promptId
      const userIndices: number[] = [];
      let lastPromptId: string | undefined;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i]!;
        if (isUserEntry(e) && e.promptId && e.promptId !== lastPromptId) {
          userIndices.push(i);
          lastPromptId = e.promptId;
        }
      }

      // Find TTL info: last cache access time and creation TTL type.
      // Cache TTL countdown starts at prefill (when the server reads/writes the
      // cache block), which happens at request receipt — not when streaming ends.
      // Using the assistant response timestamp would overestimate the remaining
      // TTL by the full decode duration (potentially minutes for long responses).
      // Instead, use the user entry immediately preceding the last cache-touching
      // assistant entry: that user entry's timestamp ≈ when the request was sent
      // ≈ when prefill and the TTL reset actually occurred.
      let cacheLastAccessedAt: number | null = null;
      let cacheTtlMs: number | null = null;
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i]!;
        if (!e.hasUsage) continue;
        if (
          cacheLastAccessedAt === null &&
          e.timestamp !== undefined &&
          (e.cacheRead > 0 || e.cacheCreation > 0)
        ) {
          // Scan back to find the user entry that triggered this request.
          // Stop at the first user entry regardless of whether it has a
          // timestamp, so we never cross a turn boundary and latch onto a
          // user entry from a previous turn.
          let requestTs: number | undefined;
          for (let j = i - 1; j >= 0; j--) {
            const prev = entries[j]!;
            if (isUserEntry(prev)) {
              requestTs = prev.timestamp;
              break;
            }
          }
          cacheLastAccessedAt = requestTs ?? e.timestamp;
        }
        if (cacheTtlMs === null && e.cacheCreation > 0) {
          cacheTtlMs = e.cacheCreation1h > 0 ? 3600000 : 300000;
        }
        if (cacheLastAccessedAt !== null && cacheTtlMs !== null) break;
      }

      const attachTtl = (r: CacheHitInfo | null) =>
        r ? { ...r, cacheLastAccessedAt, cacheTtlMs } : null;

      // Try from the last user entry, fall back to previous if no assistant entries
      for (let u = userIndices.length - 1; u >= 0; u--) {
        const turnStart = userIndices[u]! + 1;
        const turnEnd =
          u < userIndices.length - 1 ? userIndices[u + 1]! : entries.length;

        const result = calcTurnHitRate(entries, turnStart, turnEnd);
        if (result) return attachTtl(result);
      }

      // No user entries found, try all entries
      return attachTtl(calcTurnHitRate(entries, 0, entries.length));
    } catch (error) {
      debug("Error getting cache hit info:", error);
      return null;
    }
  }
}
