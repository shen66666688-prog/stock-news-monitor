/**
 * Full Agent Pipeline endpoint
 *
 * Flow:
 *   Alpha Vantage news → collectNewsSignals → scoringEngine → ranker
 *     → DeepSeek AI → validator → retryPipeline → ranked posts
 *
 * POST /api/pipeline  (or GET)
 * Returns top-ranked stock summaries ready to publish
 */

import { NextResponse } from "next/server";
import { fetchStockNews } from "@/lib/news";
import { runPipeline } from "@/core/pipeline";
import type { RankedTopic } from "@/core/dataCollector/types";
import type { PipelineResult } from "@/core/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META"];
  const TOP_N = 3;

  try {
    // ── Layer 1: Fetch all news ──
    console.log("\n═══ [PIPELINE API] Fetching news for all tickers ═══");
    const preFetchedNews: Record<string, Array<{ title: string; publisher: string; link: string }>> = {};

    for (const t of tickers) {
      const { news } = await fetchStockNews(t, 5);
      if (news.length > 0) {
        preFetchedNews[t] = news.map((n) => ({
          title: n.title,
          publisher: n.source,
          link: n.url,
        }));
      }
      console.log(`  ${t}: ${news.length} articles`);
    }

    // ── Layer 2-4: Run full pipeline (scoring + ranking) ──
    console.log("\n[PIPELINE API] Running scoring + ranking engine…");
    const pipeline: PipelineResult = await runPipeline(tickers, preFetchedNews);

    // ── Layer 5: Generate AI summaries for top picks ──
    console.log("\n[PIPELINE API] Generating AI summaries for top picks…");
    const { generateSummary } = await import("@/lib/summary");

    const rankedResults = await Promise.all(
      pipeline.topics.slice(0, TOP_N).map(async (topic) => {
        const summary = await generateSummary(topic.ticker);
        return {
          ticker: topic.ticker,
          score: topic.score,
          rank: topic.rank,
          coreNarrative: topic.coreNarrative,
          recommendedAngle: topic.recommendedAngle,
          rationale: topic.rationale,
          summary,
        };
      })
    );

    // ── Response ──
    return NextResponse.json({
      pipeline: {
        totalSignals: pipeline.diag.signalsCount,
        scoredCount: pipeline.diag.scoredCount,
        avgScore: pipeline.diag.avgScore,
        topScore: pipeline.diag.topScore,
        health: pipeline.diag.layers,
      },
      ranked: rankedResults,
      allTopics: pipeline.topics.map((t) => ({
        ticker: t.ticker,
        score: t.score,
        rank: t.rank,
        coreNarrative: t.coreNarrative,
        rationale: t.rationale,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[PIPELINE API] Failed:", error);
    return NextResponse.json({ error: "Pipeline failed", detail: String(error) }, { status: 500 });
  }
}
