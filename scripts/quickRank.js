/**
 * quickRank.js — 快速选题排名（基于今天的 dailyReport）
 */
const fs = require("fs-extra");
const path = require("path");
const { runPipeline, formatTopPicks, checkPipelineHealth } = require("../core/pipeline");

async function main() {
  const reportPath = path.join(process.cwd(), "output", "daily", "2026-06-13", "dailyReport.json");
  if (!fs.existsSync(reportPath)) {
    console.log("❌ 今天的日报还没生成，先跑 node scripts/dailyReportGenerator.js");
    return;
  }

  const dailyReportData = fs.readJsonSync(reportPath);

  // Light news fetch
  const YahooFinance = require("yahoo-finance2").default;
  const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
  const tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META"];
  const preFetchedNews = {};
  for (const t of tickers) {
    try {
      const data = await yf.search(t, { newsCount: 3 });
      preFetchedNews[t] = (data.news || []).slice(0, 3).map((n) => ({
        title: n.title, publisher: n.publisher, link: n.link,
      }));
    } catch (e) {
      preFetchedNews[t] = [];
    }
  }

  const result = await runPipeline(tickers, preFetchedNews, dailyReportData);
  console.log(formatTopPicks(result.topics));
  console.log(`Health: ${checkPipelineHealth(result.diag).status}`);
  console.log(JSON.stringify(result.topics.map((t) => ({
    ticker: t.ticker,
    score: t.score,
    narrative: t.coreNarrative,
    angle: t.recommendedAngle,
    dataPoints: t.keyDataPoints,
  })), null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
