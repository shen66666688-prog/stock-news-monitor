/**
 * persistentCache.ts — 文件持久化缓存
 *
 * 解决服务器重启后内存缓存丢失 → 浪费 DeepSeek API 调用的问题。
 * 写入 .claude/cache/ 目录，启动时自动加载。
 */

import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".claude", "cache");

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

// ══════════════════════════════════════════════════════════
// Core operations
// ══════════════════════════════════════════════════════════

function getFilePath(namespace: string, key: string): string {
  // Sanitize key for filesystem
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(CACHE_DIR, namespace, `${safe}.json`);
}

/**
 * Get a value from persistent cache.
 * Returns null if missing or expired.
 */
export function getPersistent<T>(namespace: string, key: string): T | null {
  try {
    const fp = getFilePath(namespace, key);
    if (!fs.existsSync(fp)) return null;

    const raw = fs.readFileSync(fp, "utf-8");
    const entry: CacheEntry<T> = JSON.parse(raw);

    if (Date.now() - entry.timestamp > entry.ttlMs) {
      // Expired — clean up
      try { fs.unlinkSync(fp); } catch { /* ignore */ }
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Store a value in persistent cache.
 */
export function setPersistent<T>(
  namespace: string,
  key: string,
  data: T,
  ttlMs: number = 30 * 60_000, // default 30 min
): void {
  try {
    const fp = getFilePath(namespace, key);
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttlMs,
    };

    fs.writeFileSync(fp, JSON.stringify(entry, null, 2), "utf-8");
  } catch { /* ignore write errors silently */ }
}

/**
 * Remove a specific cache entry.
 */
export function deletePersistent(namespace: string, key: string): void {
  try {
    const fp = getFilePath(namespace, key);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch { /* ignore */ }
}

/**
 * List all cache keys in a namespace.
 */
export function listKeys(namespace: string): string[] {
  try {
    const dir = path.join(CACHE_DIR, namespace);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", "").replace(/_/g, (c) => c === "_" ? "-" : c));
  } catch {
    return [];
  }
}

/**
 * Get cache stats for a namespace.
 */
export function cacheStats(namespace: string): {
  entries: number;
  totalSize: number;
  oldest: string | null;
  newest: string | null;
} {
  try {
    const dir = path.join(CACHE_DIR, namespace);
    if (!fs.existsSync(dir)) return { entries: 0, totalSize: 0, oldest: null, newest: null };

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    let totalSize = 0;
    let oldestTime = Infinity;
    let newestTime = 0;
    let oldestFile: string | null = null;
    let newestFile: string | null = null;

    for (const f of files) {
      const fp = path.join(dir, f);
      const stat = fs.statSync(fp);
      totalSize += stat.size;
      if (stat.mtimeMs < oldestTime) { oldestTime = stat.mtimeMs; oldestFile = f; }
      if (stat.mtimeMs > newestTime) { newestTime = stat.mtimeMs; newestFile = f; }
    }

    return {
      entries: files.length,
      totalSize,
      oldest: oldestFile,
      newest: newestFile,
    };
  } catch {
    return { entries: 0, totalSize: 0, oldest: null, newest: null };
  }
}

/**
 * Clean expired cache entries in a namespace.
 */
export function cleanExpired(namespace: string): number {
  let cleaned = 0;
  try {
    const dir = path.join(CACHE_DIR, namespace);
    if (!fs.existsSync(dir)) return 0;

    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const fp = path.join(dir, f);
      try {
        const raw = fs.readFileSync(fp, "utf-8");
        const entry: CacheEntry<unknown> = JSON.parse(raw);
        if (Date.now() - entry.timestamp > entry.ttlMs) {
          fs.unlinkSync(fp);
          cleaned++;
        }
      } catch { /* corrupt file — delete it */ try { fs.unlinkSync(fp); cleaned++; } catch { /* ignore */ } }
    }
  } catch { /* ignore */ }
  return cleaned;
}
