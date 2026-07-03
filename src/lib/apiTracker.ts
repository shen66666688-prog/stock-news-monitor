/**
 * apiTracker.ts — API 命中率追踪器
 *
 * 追踪每层 API 的调用次数、成功/失败/缓存命中，
 * 暴露 /api/health 仪表盘 + CLI 脚本查看。
 */

import fs from "fs";
import path from "path";

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

export type ApiName = "yahoo_search" | "yahoo_chart" | "yahoo_html" | "deepseek" | "article_scrape";

export interface ApiStats {
  calls: number;
  success: number;
  failed: number;
  cacheHits: number;
  lastError?: string;
  lastErrorAt?: string;
}

export interface TrackerSnapshot {
  updatedAt: string;
  services: Record<ApiName, ApiStats>;
  totals: { calls: number; success: number; failed: number; cacheHits: number };
}

// ══════════════════════════════════════════════════════════
// In-memory counters (survive within one server lifetime)
// ══════════════════════════════════════════════════════════

const stats: Record<ApiName, ApiStats> = {
  yahoo_search:  { calls: 0, success: 0, failed: 0, cacheHits: 0 },
  yahoo_chart:   { calls: 0, success: 0, failed: 0, cacheHits: 0 },
  yahoo_html:    { calls: 0, success: 0, failed: 0, cacheHits: 0 },
  deepseek:      { calls: 0, success: 0, failed: 0, cacheHits: 0 },
  article_scrape:{ calls: 0, success: 0, failed: 0, cacheHits: 0 },
};

// ══════════════════════════════════════════════════════════
// Persist counters to disk so they survive restarts
// ══════════════════════════════════════════════════════════

const STATS_FILE = path.join(process.cwd(), ".claude", "api-stats.json");

function loadStats(): void {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
      for (const key of Object.keys(stats)) {
        if (saved[key]) {
          stats[key as ApiName] = { ...stats[key as ApiName], ...saved[key] };
        }
      }
    }
  } catch { /* ignore corrupt file */ }
}

function saveStats(): void {
  try {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf-8");
  } catch { /* ignore write errors */ }
}

// Load persisted counters on import
loadStats();

// ══════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════

export function trackCall(api: ApiName): void {
  stats[api].calls++;
  saveStats();
}

export function trackSuccess(api: ApiName): void {
  stats[api].success++;
  saveStats();
}

export function trackFail(api: ApiName, errorMsg?: string): void {
  stats[api].failed++;
  if (errorMsg) {
    stats[api].lastError = errorMsg.slice(0, 200);
    stats[api].lastErrorAt = new Date().toISOString();
  }
  saveStats();
}

export function trackCacheHit(api: ApiName): void {
  stats[api].cacheHits++;
  saveStats();
}

/**
 * Wrap an async function with tracking.
 * Usage: const data = await tracked("deepseek", () => deepseekCall());
 */
export async function tracked<T>(
  api: ApiName,
  fn: () => Promise<T>,
): Promise<T> {
  trackCall(api);
  try {
    const result = await fn();
    trackSuccess(api);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    trackFail(api, msg);
    throw e;
  }
}

/**
 * Wrap a sync function with tracking.
 */
export function trackedSync<T>(api: ApiName, fn: () => T): T {
  trackCall(api);
  try {
    const result = fn();
    trackSuccess(api);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    trackFail(api, msg);
    throw e;
  }
}

export function getSnapshot(): TrackerSnapshot {
  const services = { ...stats };
  const totals = {
    calls: 0, success: 0, failed: 0, cacheHits: 0,
  };
  for (const s of Object.values(services)) {
    totals.calls += s.calls;
    totals.success += s.success;
    totals.failed += s.failed;
    totals.cacheHits += s.cacheHits;
  }
  return { updatedAt: new Date().toISOString(), services, totals };
}

/**
 * Print human-readable stats to console.
 */
export function printStats(): string {
  const snap = getSnapshot();
  const lines: string[] = [
    "═══════════════════════════════════════",
    "  API 命中率仪表盘",
    "═══════════════════════════════════════",
    "",
  ];

  const labels: Record<ApiName, string> = {
    yahoo_search:  "Yahoo 新闻搜索  ",
    yahoo_chart:   "Yahoo 图表 API  ",
    yahoo_html:    "Yahoo HTML 解析 ",
    deepseek:      "DeepSeek AI    ",
    article_scrape:"文章抓取       ",
  };

  for (const [key, label] of Object.entries(labels)) {
    const s = snap.services[key as ApiName];
    const total = s.calls || 1;
    const hitRate = s.calls > 0 ? `${((s.success / s.calls) * 100).toFixed(0)}%` : "—";
    const cacheRate = s.calls > 0 ? `${((s.cacheHits / s.calls) * 100).toFixed(0)}%` : "—";
    lines.push(
      `${label} | 调用:${s.calls.toString().padStart(3)} | 成功:${hitRate.padStart(3)} | 失败:${s.failed.toString().padStart(2)} | 缓存命中:${cacheRate.padStart(3)}`,
    );
    if (s.lastError) {
      lines.push(`  ↳ 最近错误: ${s.lastError.slice(0, 80)}`);
    }
  }

  lines.push("");
  lines.push("───────────────────────────────────────");
  const totSuccess = snap.totals.calls > 0
    ? `${((snap.totals.success / snap.totals.calls) * 100).toFixed(0)}%`
    : "—";
  lines.push(`  总计: ${snap.totals.calls} 调用 | ${totSuccess} 成功率 | ${snap.totals.cacheHits} 缓存命中`);
  lines.push("═══════════════════════════════════════");

  return lines.join("\n");
}

/**
 * Reset all counters (for debugging / fresh start).
 */
export function resetStats(): void {
  for (const key of Object.keys(stats)) {
    stats[key as ApiName] = { calls: 0, success: 0, failed: 0, cacheHits: 0 };
  }
  saveStats();
}
