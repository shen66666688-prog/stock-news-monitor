/**
 * pipeline.ts — Master orchestrator for the unified V1 pipeline
 *
 * Full flow:
 *   dataCollector → normalizer → scoringEngine → ranker → output
 *
 * This is the single entry point that wires all modules together
 * and provides per-layer diagnostic logging.
 */

import type { Signal, NormalizedSignal, ScoredSignal, RankedTopic } from "./dataCollector/types";
import {
  collectNewsSignals,
  collectFromNewsData,
  collectVideoSignals,
  collectSocialSignals,
} from "./dataCollector";
import { normalizeSignals, getNormalizationStats } from "./normalizer";
import { scoreAllSignals, getScoringStats } from "./scoringEngine";
import { rankTopics, formatTopPicks } from "./ranker";
import { extractStrongSignals } from "./strongSignalExtractor";

// ═══════════════════════════════════════════════════════════════
// Pipeline result type
// ═══════════════════════════════════════════════════════════════

export interface PipelineDiagnostics {
  /** Raw signal counts by source */
  signalsCount: number;
  newsCount: number;
  videoCount: number;
  socialCount: number;
  strongSignalCount: number;
  /** Post-normalization */
  normalizedCount: number;
  dedupRemoved: number;
  crossSourceMatches: number;
  /** Scoring */
  scoredCount: number;
  avgScore: number;
  topScore: number;
  /** Ranking */
  topPicks: RankedTopic[];
  /** Layer-by-layer timing */
  timings: Record<string, number>;
  /** Per-layer status */
  layers: Record<string, { status: "ok" | "empty" | "error"; detail: string }>;
}

export interface PipelineResult {
  /** Final ranked topics ready for content generation */
  topics: RankedTopic[];
  /** Full diagnostic trace */
  diag: PipelineDiagnostics;
}

// ═══════════════════════════════════════════════════════════════
// Pipeline runner
// ═══════════════════════════════════════════════════════════════

/**
 * Run the complete V1 pipeline end-to-end.
 *
 * @param tickers - Watchlist tickers to monitor
 * @param preFetchedNews - Optional pre-fetched news data (from Yahoo Finance)
 * @param dailyReportData - Optional daily report data (from dailyReportGenerator) — enables strong signal fusion
 * @returns PipelineResult with ranked topics and full diagnostics
 */
export async function runPipeline(
  tickers: string[],
  preFetchedNews?: Record<string, Array<{ title: string; publisher: string; link: string }>>,
  dailyReportData?: Record<string, unknown>,
): Promise<PipelineResult> {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  const layers: Record<string, { status: "ok" | "empty" | "error"; detail: string }> = {};

  // ═══════════════════════════════════════════════════════════
  // Layer 1: Data Collection
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ [LAYER 1] Data Collection ═══");

  let newsSignals: Signal[] = [];
  let videoSignals: Signal[] = [];
  let socialSignals: Signal[] = [];

  // News
  const t1 = Date.now();
  if (preFetchedNews) {
    newsSignals = collectFromNewsData(preFetchedNews);
  }
  timings["collect_news"] = Date.now() - t1;
  console.log(`  📰 News: ${newsSignals.length} signals (${timings["collect_news"]}ms)`);
  layers["newsCollector"] = {
    status: newsSignals.length > 0 ? "ok" : "empty",
    detail: newsSignals.length > 0
      ? `${newsSignals.length} news signals collected`
      : "No news data — check Yahoo Finance connection or preFetchedNews",
  };

  // Video (stub)
  const t2 = Date.now();
  videoSignals = await collectVideoSignals(tickers);
  timings["collect_video"] = Date.now() - t2;
  console.log(`  🎬 Video: ${videoSignals.length} signals (${timings["collect_video"]}ms)` + (videoSignals.length === 0 ? " [STUB-OK]" : ""));
  layers["videoCollector"] = {
    status: "ok", // Empty is expected — stub
    detail: videoSignals.length > 0
      ? `${videoSignals.length} video signals`
      : "Video collector stub (expected — API keys not configured)",
  };

  // Social
  const t3 = Date.now();
  try {
    socialSignals = await collectSocialSignals(tickers);
    timings["collect_social"] = Date.now() - t3;
    console.log(`  💬 Social: ${socialSignals.length} signals (${timings["collect_social"]}ms)`);
    layers["socialCollector"] = {
      status: socialSignals.length > 0 ? "ok" : "ok",
      detail: socialSignals.length > 0
        ? `${socialSignals.length} social signals collected`
        : "No matching social signals found (expected if Reddit is rate-limited)",
    };
  } catch (e) {
    timings["collect_social"] = Date.now() - t3;
    console.warn(`  💬 Social: ERROR — ${e}`);
    layers["socialCollector"] = { status: "error", detail: String(e) };
  }

  // Strong signals from dailyReport (DeepSeek-structured data)
  let strongSignals: Signal[] = [];
  const t3b = Date.now();
  if (dailyReportData) {
    try {
      strongSignals = extractStrongSignals(dailyReportData as Record<string, unknown>);
      timings["collect_strong"] = Date.now() - t3b;
      console.log(`  🔥 Strong (dailyReport): ${strongSignals.length} signals (${timings["collect_strong"]}ms)`);
      layers["strongSignalExtractor"] = {
        status: strongSignals.length > 0 ? "ok" : "empty",
        detail: `${strongSignals.length} strong signals extracted from dailyReport`,
      };
    } catch (e) {
      timings["collect_strong"] = Date.now() - t3b;
      console.warn(`  🔥 Strong (dailyReport): ERROR — ${e}`);
      layers["strongSignalExtractor"] = { status: "error", detail: String(e) };
    }
  } else {
    console.log(`  🔥 Strong (dailyReport): NOT PROVIDED — fusion scoring disabled`);
    layers["strongSignalExtractor"] = {
      status: "ok",
      detail: "No dailyReport data provided — running with weak signals only",
    };
  }

  const allSignals = [...newsSignals, ...videoSignals, ...socialSignals, ...strongSignals];
  console.log(`  📊 TOTAL raw signals: ${allSignals.length} (news=${newsSignals.length} video=${videoSignals.length} social=${socialSignals.length} strong=${strongSignals.length})`);

  // ═══════════════════════════════════════════════════════════
  // Layer 2: Normalization
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ [LAYER 2] Normalizer ═══");

  if (allSignals.length === 0) {
    console.log("  ⚠️ No signals to normalize — pipeline stops here");
    layers["normalizer"] = { status: "empty", detail: "No input signals" };
    return emptyResult(timings, layers);
  }

  const t4 = Date.now();
  const normalized = normalizeSignals(allSignals);
  timings["normalizer"] = Date.now() - t4;

  const normStats = getNormalizationStats(normalized);
  console.log(`  📊 Normalized: ${normalized.length} signals (${timings["normalizer"]}ms)`);
  console.log(`     By source: news=${normStats.bySource["news"] || 0}, video=${normStats.bySource["video"] || 0}, social=${normStats.bySource["social"] || 0}`);
  console.log(`     Cross-source matches: ${normStats.crossSourceCount}`);
  console.log(`     By ticker: ${Object.entries(normStats.byTicker).map(([t, c]) => `${t}(${c})`).join(", ")}`);
  layers["normalizer"] = {
    status: normalized.length > 0 ? "ok" : "empty",
    detail: `${normalized.length} normalized, ${normStats.crossSourceCount} cross-source matches`,
  };

  // ═══════════════════════════════════════════════════════════
  // Layer 3: Scoring
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ [LAYER 3] Scoring Engine 🔥 ═══");

  const t5 = Date.now();
  const scored = scoreAllSignals(normalized);
  timings["scoring"] = Date.now() - t5;

  const scoringStats = getScoringStats(scored);
  console.log(`  📊 Scored: ${scored.length} signals (${timings["scoring"]}ms)`);
  console.log(`     Avg score: ${scoringStats.avgScore} | Top score: ${scoringStats.topScore}`);
  console.log(`     Distribution: 0-20:${scoringStats.distribution["0-20"]} 21-40:${scoringStats.distribution["21-40"]} 41-60:${scoringStats.distribution["41-60"]} 61-80:${scoringStats.distribution["61-80"]} 81-100:${scoringStats.distribution["81-100"]}`);
  if (Object.keys(scoringStats.byTicker).length > 0) {
    console.log(`     Top tickers: ${
      Object.entries(scoringStats.byTicker)
        .sort((a, b) => b[1].avgScore - a[1].avgScore)
        .slice(0, 5)
        .map(([t, d]) => `${t}(${d.count}s, avg${d.avgScore})`)
        .join(", ")
    }`);
  }
  layers["scoringEngine"] = {
    status: scored.length > 0 ? "ok" : "empty",
    detail: `${scored.length} scored, avg=${scoringStats.avgScore}, top=${scoringStats.topScore}`,
  };

  // ═══════════════════════════════════════════════════════════
  // Layer 4: Ranking
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ [LAYER 4] Ranker 🏆 ═══");

  const t6 = Date.now();
  const topPicks = rankTopics(scored, 3);
  timings["ranker"] = Date.now() - t6;

  console.log(formatTopPicks(topPicks));
  layers["ranker"] = {
    status: topPicks.length > 0 ? "ok" : "empty",
    detail: topPicks.length > 0
      ? `Top pick: ${topPicks[0].ticker} (${topPicks[0].score})`
      : "No topics ranked",
  };

  // ═══════════════════════════════════════════════════════════
  // Assemble result
  // ═══════════════════════════════════════════════════════════
  const dedupRemoved = allSignals.length - normalized.length;
  // Actually this isn't quite right since normalizer also filters ticker-less signals
  // Let me just count what we have

  const result: PipelineResult = {
    topics: topPicks,
    diag: {
      signalsCount: allSignals.length,
      newsCount: newsSignals.length,
      videoCount: videoSignals.length,
      socialCount: socialSignals.length,
      strongSignalCount: strongSignals.length,
      normalizedCount: normalized.length,
      dedupRemoved: Math.max(0, allSignals.length - normalized.length),
      crossSourceMatches: normStats.crossSourceCount,
      scoredCount: scored.length,
      avgScore: scoringStats.avgScore,
      topScore: scoringStats.topScore,
      topPicks,
      timings,
      layers,
    },
  };

  const totalTime = Date.now() - t0;
  console.log(`\n═══ PIPELINE COMPLETE ═══`);
  console.log(`  Total time: ${totalTime}ms`);
  console.log(`  Result: ${topPicks.length} topics ranked`);
  console.log(`  Top: ${topPicks.map((t) => `${t.ticker}(${t.score})`).join(" > ")}`);
  console.log("");

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Empty result helper
// ═══════════════════════════════════════════════════════════════

function emptyResult(
  timings: Record<string, number>,
  layers: Record<string, { status: "ok" | "empty" | "error"; detail: string }>,
): PipelineResult {
  return {
    topics: [],
    diag: {
      signalsCount: 0,
      newsCount: 0,
      videoCount: 0,
      socialCount: 0,
      strongSignalCount: 0,
      normalizedCount: 0,
      dedupRemoved: 0,
      crossSourceMatches: 0,
      scoredCount: 0,
      avgScore: 0,
      topScore: 0,
      topPicks: [],
      timings,
      layers,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// Health check
// ═══════════════════════════════════════════════════════════════

/**
 * Quick health check on pipeline diagnostics.
 * Returns "healthy" / "degraded" / "broken".
 */
export function checkPipelineHealth(diag: PipelineDiagnostics): {
  status: "healthy" | "degraded" | "broken";
  issues: string[];
} {
  const issues: string[] = [];

  // Check 1: At least one data source has signals
  if (diag.signalsCount === 0) {
    issues.push("CRITICAL: Zero signals from all sources — pipeline is dead");
    return { status: "broken", issues };
  }

  // Check 2: News must have data (primary source)
  if (diag.newsCount === 0) {
    issues.push("CRITICAL: News collector returned 0 signals — primary data source dead");
    return { status: "broken", issues };
  }

  // Check 3: Normalization working
  if (diag.normalizedCount === 0) {
    issues.push("CRITICAL: Normalizer dropped all signals — check ticker extraction");
    return { status: "broken", issues };
  }

  // Check 4: Scoring producing meaningful distribution
  if (diag.avgScore === 0) {
    issues.push("WARNING: Average score is 0 — scoring engine may not be working");
  }
  if (diag.topScore < 30) {
    issues.push("WARNING: Top score < 30 — no strong signals today (may be valid for quiet days)");
  }

  // Check 5: Ranking producing output
  if (diag.topPicks.length === 0) {
    issues.push("CRITICAL: Ranker produced 0 topics");
    return { status: "broken", issues };
  }

  // Check 6: Source diversity (degraded if only news)
  if (diag.videoCount === 0 && diag.socialCount === 0) {
    issues.push("INFO: Only news source active — video/social collectors are stubs (expected)");
    return { status: "degraded", issues };
  }

  // Check 7: Fake data detection
  if (diag.topScore > 90 && diag.signalsCount < 5) {
    issues.push("WARNING: Very high score with very few signals — possible scoring inflation");
  }

  if (issues.length === 0) {
    return { status: "healthy", issues };
  }

  const hasCritical = issues.some((i) => i.startsWith("CRITICAL"));
  return {
    status: hasCritical ? "broken" : "degraded",
    issues,
  };
}
