/**
 * test-pipeline.ts — End-to-end pipeline verification script
 *
 * Usage:
 *   npx tsx scripts/test-pipeline.ts
 *
 * This script:
 *   1. Fetches real Yahoo Finance news for all 7 watchlist tickers
 *   2. Runs the full V1 pipeline (collect → normalize → score → rank)
 *   3. Prints per-layer diagnostics
 *   4. Runs health check
 *   5. Tells you if the system is "real" or "fake"
 */

import YahooFinance from "yahoo-finance2";
import { runPipeline, checkPipelineHealth } from "../core/pipeline";
import { collectRedditSignals } from "../core/dataCollector/socialCollector";

// ═══════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════

const WATCHLIST = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META"];

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   AI美股内容工厂 — 系统健康检测器 v1.0     ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`\n📅 检测时间: ${new Date().toISOString()}`);
  console.log(`📊 自选股: ${WATCHLIST.join(", ")}\n`);

  // ── Step 1: Fetch real news from Yahoo Finance ──
  console.log("═══ [PRE-FETCH] Yahoo Finance News ═══");
  const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

  const preFetchedNews: Record<string, Array<{ title: string; publisher: string; link: string }>> = {};
  let totalNewsTitles = 0;

  for (const ticker of WATCHLIST) {
    try {
      const data = await yf.search(ticker, { newsCount: 5 });
      const news = (data.news || []).slice(0, 5).map((n: { title: string; publisher: string; link: string }) => ({
        title: n.title || "无标题",
        publisher: n.publisher || "Yahoo Finance",
        link: n.link || "",
      }));
      preFetchedNews[ticker] = news;
      totalNewsTitles += news.length;
      console.log(`  ✅ ${ticker}: ${news.length} news`);
    } catch (e) {
      console.warn(`  ⚠️ ${ticker}: FAILED — ${e}`);
      preFetchedNews[ticker] = [];
    }
  }

  console.log(`  📰 Total news fetched: ${totalNewsTitles}\n`);

  if (totalNewsTitles === 0) {
    console.log("❌ FATAL: Zero news fetched. Cannot run pipeline.");
    console.log("   Check: Internet connection? Yahoo Finance accessible?");
    process.exit(1);
  }

  // ── Step 2: Try Reddit for social signals ──
  console.log("═══ [PRE-FETCH] Reddit Social Signals ═══");
  try {
    const redditSignals = await collectRedditSignals(WATCHLIST, 10);
    console.log(`  💬 Reddit signals matching watchlist: ${redditSignals.length}`);
  } catch (e) {
    console.log(`  ⚠️ Reddit unavailable (expected): ${e}`);
  }
  console.log("");

  // ── Step 3: Load dailyReport for strong signal fusion ──
  console.log("═══ [PRE-FETCH] Daily Report Strong Signals ═══");
  let dailyReportData: Record<string, unknown> | undefined;
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    // Find latest dailyReport
    const outputDir = path.join(process.cwd(), "output", "daily");
    const dirs = (await fs.readdir(outputDir, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map((d) => d.name)
      .sort()
      .reverse();
    if (dirs.length > 0) {
      const latestReport = path.join(outputDir, dirs[0], "dailyReport.json");
      try {
        const raw = await fs.readFile(latestReport, "utf8");
        dailyReportData = JSON.parse(raw);
        const enriched = dailyReportData?.enrichedStockData as Record<string, unknown> | undefined;
        const riskEvents = dailyReportData?.marketRiskEvents as unknown[] | undefined;
        console.log(`  ✅ Loaded: ${latestReport}`);
        console.log(`     Tickers: ${enriched ? Object.keys(enriched).join(", ") : "N/A"}`);
        console.log(`     Risk events: ${riskEvents?.length || 0}`);
      } catch {
        console.log(`  ⚠️ No dailyReport found at ${latestReport}`);
      }
    }
  } catch (e) {
    console.log(`  ⚠️ Cannot load dailyReport: ${e}`);
  }
  console.log("");

  // ── Step 4: Run the pipeline WITH strong signal fusion ──
  console.log("═══ RUNNING FULL PIPELINE (FUSION MODE) ═══\n");

  const result = await runPipeline(WATCHLIST, preFetchedNews, dailyReportData);

  // ── Step 4: Health check ──
  console.log("═══ HEALTH CHECK ═══\n");

  const health = checkPipelineHealth(result.diag);

  const statusIcon = health.status === "healthy" ? "🟢" : health.status === "degraded" ? "🟡" : "🔴";
  console.log(`${statusIcon} System Status: ${health.status.toUpperCase()}`);

  if (health.issues.length > 0) {
    console.log("Issues:");
    for (const issue of health.issues) {
      console.log(`  - ${issue}`);
    }
  }
  console.log("");

  // ── Step 5: Verdict ──
  console.log("═══ VERDICT ═══\n");

  const diag = result.diag;

  console.log("📊 Data Flow Summary:");
  console.log(`   Raw signals:     ${diag.signalsCount}`);
  console.log(`     ├─ News:       ${diag.newsCount}`);
  console.log(`     ├─ Video:      ${diag.videoCount} (stub)`);
  console.log(`     ├─ Social:     ${diag.socialCount}`);
  console.log(`     └─ Strong:     ${diag.strongSignalCount} 🔥`);
  console.log(`   Normalized:      ${diag.normalizedCount}`);
  console.log(`   Scored:          ${diag.scoredCount} (avg: ${diag.avgScore}, top: ${diag.topScore})`);
  console.log(`   Top Picks:       ${diag.topPicks.length}`);
  console.log(`   Cross-source:    ${diag.crossSourceMatches}`);

  console.log("");
  console.log("⏱ Timing:");
  for (const [layer, ms] of Object.entries(diag.timings)) {
    console.log(`   ${layer}: ${ms}ms`);
  }

  console.log("");
  console.log("📋 Layer Status:");
  for (const [name, info] of Object.entries(diag.layers)) {
    const icon = info.status === "ok" ? "✅" : info.status === "empty" ? "⚠️" : "❌";
    console.log(`   ${icon} ${name}: ${info.detail}`);
  }

  // ── Step 6: The critical judgment ──
  console.log("");
  console.log("═══ REAL vs FAKE DETECTION ═══\n");

  const checks: Array<{ label: string; pass: boolean; detail: string }> = [];

  // Check 1: Multi-source?
  const activeSources = [diag.newsCount > 0, diag.videoCount > 0, diag.socialCount > 0, diag.strongSignalCount > 0].filter(Boolean).length;
  checks.push({
    label: "多源数据",
    pass: diag.newsCount > 0 && diag.strongSignalCount > 0,
    detail: `${activeSources} active sources (news=${diag.newsCount > 0 ? "✓" : "✗"}, video=${diag.videoCount > 0 ? "✓" : "✗"}, social=${diag.socialCount > 0 ? "✓" : "✗"}, strong=${diag.strongSignalCount > 0 ? "✓" : "✗"})`,
  });

  // Check 2: Score distribution looks real?
  checks.push({
    label: "评分分布",
    pass: diag.avgScore > 0 && diag.topScore < 100,
    detail: `avg=${diag.avgScore}, top=${diag.topScore}, scorable=${diag.scoredCount}`,
  });

  // Check 3: Top picks have rationale?
  const hasRationale = diag.topPicks.every((t) => t.rationale.length > 0);
  checks.push({
    label: "选题有理据",
    pass: hasRationale && diag.topPicks.length > 0,
    detail: diag.topPicks.length > 0
      ? diag.topPicks.map((t) => `${t.ticker}(${t.score}): ${t.rationale}`).join(" | ")
      : "NO TOPICS — broken",
  });

  // Check 4: Signal to topic ratio
  const ratioOk = diag.topPicks.length > 0 && diag.signalsCount >= diag.topPicks.length * 3;
  checks.push({
    label: "信号/选题比",
    pass: ratioOk,
    detail: `${diag.signalsCount} signals → ${diag.topPicks.length} topics (ratio ${(diag.signalsCount / Math.max(1, diag.topPicks.length)).toFixed(1)}:1)`,
  });

  // Check 5: No fake-heavy patterns
  const noFakePattern = !(diag.topScore > 90 && diag.signalsCount < 5);
  checks.push({
    label: "无反假模式",
    pass: noFakePattern,
    detail: noFakePattern ? "OK" : "WARNING: high score with very few signals",
  });

  for (const check of checks) {
    console.log(`   ${check.pass ? "✅" : "❌"} ${check.label}: ${check.detail}`);
  }

  const allPassed = checks.every((c) => c.pass);
  console.log("");
  if (allPassed) {
    console.log("🟢 VERDICT: 系统数据流动真实，选题引擎正常工作。");
  } else {
    const failed = checks.filter((c) => !c.pass);
    console.log(`🔴 VERDICT: ${failed.length} 项检查未通过。系统存在数据流问题。`);
    console.log(`   失败项: ${failed.map((c) => c.label).join(", ")}`);
  }

  console.log("");
  console.log("═══ TEST COMPLETE ═══");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
