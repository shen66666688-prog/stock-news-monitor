/**
 * 极简统计 API — 本地 JSON 文件，不依赖数据库
 *
 * POST /api/stats  { event, meta? }
 * GET  /api/stats  返回今日统计
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const STATS_FILE = path.join(process.cwd(), ".claude", "stats.json");

interface StatEntry {
  ts: string;
  event: string;
  meta?: Record<string, unknown>;
}

function readStats(): StatEntry[] {
  try {
    if (!fs.existsSync(STATS_FILE)) return [];
    return JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeStats(entries: StatEntry[]) {
  const dir = path.dirname(STATS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATS_FILE, JSON.stringify(entries, null, 2));
}

export async function POST(request: Request) {
  try {
    const { event, meta } = (await request.json()) as { event?: string; meta?: Record<string, unknown> };
    if (!event) return NextResponse.json({ error: "event required" }, { status: 400 });

    const entries = readStats();
    entries.push({ ts: new Date().toISOString(), event, meta });
    writeStats(entries);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  const entries = readStats();
  const today = new Date().toISOString().slice(0, 10);

  const todayEntries = entries.filter((e) => e.ts.startsWith(today));
  const counts: Record<string, number> = {};
  for (const e of todayEntries) {
    counts[e.event] = (counts[e.event] || 0) + 1;
  }

  return NextResponse.json({
    today: counts,
    totalEvents: entries.length,
    todayEvents: todayEntries.length,
    recent: entries.slice(-20).reverse(),
  });
}
