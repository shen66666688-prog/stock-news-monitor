import { NextResponse } from "next/server";
import { getSnapshot, printStats } from "@/lib/apiTracker";

export const dynamic = "force-dynamic";

export async function GET() {
  const snap = getSnapshot();

  // If ?format=text, return human-readable
  const url = new URL(import.meta.url);
  // Default: JSON dashboard
  return NextResponse.json({
    status: "ok",
    ...snap,
    summary: {
      totalCalls: snap.totals.calls,
      successRate: snap.totals.calls > 0
        ? `${((snap.totals.success / snap.totals.calls) * 100).toFixed(1)}%`
        : "N/A",
      cacheHitRate: snap.totals.calls > 0
        ? `${((snap.totals.cacheHits / snap.totals.calls) * 100).toFixed(1)}%`
        : "N/A",
      deepseekCalls: snap.services.deepseek.calls,
      deepseekFailures: snap.services.deepseek.failed,
    },
    text: printStats(),
  });
}
