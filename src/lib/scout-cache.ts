/**
 * In-memory + filesystem scout-note cache.
 *
 * In production (Vercel), we use the /tmp directory for a lightweight
 * JSON file cache that persists within a single function instance lifecycle.
 * A proper Redis/KV store is the upgrade path; swap out the two functions below.
 *
 * Cache key: player ID (number → string).
 * Cache value: the one-sentence scouting phrase.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const CACHE_PATH = join("/tmp", "scout-cache.json");

function loadCache(): Record<string, string> {
  try {
    if (existsSync(CACHE_PATH)) {
      return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
    }
  } catch {
    // corrupt cache → start fresh
  }
  return {};
}

function saveCache(cache: Record<string, string>): void {
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf8");
  } catch {
    // /tmp write failure is non-fatal
  }
}

export function getCachedNote(playerId: number): string | undefined {
  const cache = loadCache();
  return cache[String(playerId)];
}

export function setCachedNote(playerId: number, note: string): void {
  const cache = loadCache();
  cache[String(playerId)] = note;
  saveCache(cache);
}

export function getCachedNotes(playerIds: number[]): Record<number, string> {
  const cache = loadCache();
  const result: Record<number, string> = {};
  for (const id of playerIds) {
    if (cache[String(id)]) result[id] = cache[String(id)];
  }
  return result;
}
