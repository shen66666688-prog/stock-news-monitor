import { NextRequest, NextResponse } from "next/server";
import { generateSummary } from "@/lib/summary";
import type { AISummary } from "@/types";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// In-memory cache — prevents billing attacks & saves API quota
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  data: AISummary;
  timestamp: number;
}

const summaryCache = new Map<string, CacheEntry>();

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
    if (age < CACHE_TTL_MS) {
      console.log(`[Cache Hit] ${sym} (age: ${Math.round(age / 1000)}s)`);
      return NextResponse.json({ symbol: sym, summary: cached.data });
    }
    // Expired — remove it
    summaryCache.delete(sym);
  }
  console.log(`[Cache Miss] ${sym}`);

  // 2) Generate fresh summary
  try {
    const summary = await generateSummary(sym);

    // 3) Only cache real (non-mock) responses to avoid storing "no key" placeholders
    if (!summary.mock) {
      summaryCache.set(sym, { data: summary, timestamp: Date.now() });
      console.log(`[Cache Set] ${sym} (TTL: 10min)`);
    }

    return NextResponse.json({ symbol: sym, summary });
  } catch (error) {
    console.error(`/api/stocks/${sym}/summary error:`, error);
    return NextResponse.json(
      { error: "AI 总结生成失败，请稍后重试" },
      { status: 500 },
    );
  }
}
