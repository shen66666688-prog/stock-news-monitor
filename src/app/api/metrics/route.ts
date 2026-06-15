import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MetricsRecord {
  date: string;
  stocks: string[];
  generationCount: number;
  contentCount?: number;
  views: number;
  likes: number;
  favorites: number;
  comments: number;
  followers: number;
}

interface MetricsData {
  records: MetricsRecord[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const METRICS_FILE = path.join(process.cwd(), "output", "metrics", "metrics.json");

async function loadMetrics(): Promise<MetricsData> {
  try {
    const raw = await fs.readFile(METRICS_FILE, "utf-8");
    return JSON.parse(raw) as MetricsData;
  } catch {
    return { records: [] };
  }
}

// ---------------------------------------------------------------------------
// GET /api/metrics — returns last N days of metrics
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7", 10);

  try {
    const metrics = await loadMetrics();

    // Sort by date descending, take last N
    const records = [...metrics.records]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, days)
      .reverse();

    // Compute summary stats
    const totalGenerations = records.reduce((sum, r) => sum + r.generationCount, 0);
    const totalContent = records.reduce((sum, r) => sum + (r.contentCount || 0), 0);
    const uniqueStocks = [...new Set(records.flatMap((r) => r.stocks || []))];

    return NextResponse.json({
      records,
      summary: {
        totalDays: records.length,
        totalGenerations,
        totalContent,
        uniqueStocks: uniqueStocks.length,
        stockList: uniqueStocks,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to load metrics:", error);
    return NextResponse.json(
      { error: "Failed to load metrics data" },
      { status: 500 },
    );
  }
}
