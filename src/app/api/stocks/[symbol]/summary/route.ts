import { NextRequest, NextResponse } from "next/server";
import { generateSummary } from "@/lib/summary";
import { trackCacheHit } from "@/lib/apiTracker";
import { getPersistent, setPersistent } from "@/lib/persistentCache";
import type { AISummary } from "@/types";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Two-layer cache: memory (fast) + disk (survives restart)
// ---------------------------------------------------------------------------
const MEMORY_TTL_MS = 10 * 60 * 1000; // 10 minutes in-memory
const DISK_TTL_MS = 30 * 60 * 1000;   // 30 minutes on disk

interface CacheEntry {
  data: AISummary;
  timestamp: number;
}

const summaryCache = new Map<string, CacheEntry>();

// Load persisted cache entries into memory on startup
function warmCache(): void {
  try {
    const knownTickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META"];
    for (const t of knownTickers) {
      const data = getPersistent<AISummary>("summary", t);
      if (data && !data.mock) {
        summaryCache.set(t, { data, timestamp: Date.now() - 60000 }); // pretend 1min old
      }
    }
    if (summaryCache.size > 0) {
      console.log(`[PersistentCache] 从磁盘恢复了 ${summaryCache.size} 条缓存`);
    }
  } catch { /* ignore */ }
}
warmCache();

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const sym = symbol.trim().toUpperCase();

  if (!/^[A-Z0-9.\-]{1,10}$/.test(sym)) {
    return NextResponse.json({ error: "无效的股票代码" }, { status: 400 });
  }

  // 1) Check cache
  const cached = summaryCache.get(sym);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < MEMORY_TTL_MS) {
      console.log(`[Cache Hit] ${sym} (age: ${Math.round(age / 1000)}s)`);
      trackCacheHit("deepseek");
      const cachedV2 = cached.data.v2 || null;
      return NextResponse.json({ symbol: sym, summary: cached.data, v2: cachedV2 });
    }
    // Expired — remove it
    summaryCache.delete(sym);
  }
  console.log(`[Cache Miss] ${sym}`);

  // 2) Generate fresh summary
  try {
    const summary = await generateSummary(sym);

    // 3) Save to both memory + disk (survives restart, avoids re-calling DeepSeek)
    if (!summary.mock) {
      const entry = { data: summary, timestamp: Date.now() };
      summaryCache.set(sym, entry);
      setPersistent("summary", sym, summary, DISK_TTL_MS);
      console.log(`[Cache Set] ${sym} (memory:10min, disk:30min)`);
    }

    // V2: Include content control layer validation metadata
    const v2Meta = summary.v2
      ? {
          validationPassed: summary.v2.validationPassed,
          factCount: summary.v2.factCount,
          warnings: summary.v2.warnings,
          validatedAt: summary.v2.validatedAt,
        }
      : null;

    return NextResponse.json({ symbol: sym, summary, v2: v2Meta });
  } catch (error) {
    console.error(`/api/stocks/${sym}/summary error:`, error);
    return NextResponse.json(
      { error: "AI 总结生成失败，请稍后重试" },
      { status: 500 },
    );
  }
}
