/* eslint-disable no-console */
const fs = require("fs-extra");
const path = require("path");
const {
  escapeHtml,
  pickSentimentStyle,
  clampShort,
  formatDateStr,
  normalizeApiResponse,
} = require("./post-utils");
const { buildSlideSet, buildPremiumSlideSet } = require("./ctrOptimizer");
const { renderSlideSet, closeBrowser, makeOutDirName } = require("./screenshotService");
const { fetchDiagnosticData } = require("./dataFetcher");

const TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META"];
const BASE_URL = process.env.LOCAL_BASE_URL || "http://localhost:3000";

// ── Daily report integration ──────────────────────────────────────────
const DAILY_REPORT_JSON_PATH = process.env.DAILY_REPORT_JSON || null;
// ──────────────────────────────────────────────────────────────────────

const OUT_TXT = path.join(process.cwd(), "今日发帖文案.txt");
const OUT_COVERS_DIR = path.join(process.cwd(), "covers");
const OUT_XHS_DIR = path.join(process.cwd(), "output", "xiaohongshu");
const OUT_ZH_DIR = path.join(process.cwd(), "output", "zhihu");

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
async function fetchJson(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
}

// ---------------------------------------------------------------------------
// Text post builder
// ---------------------------------------------------------------------------
function buildViralPost({ ticker, title, sentiment, points, risks, updatedAt }) {
  const st = pickSentimentStyle(sentiment);

  const hookMap = {
    good: `⚡${ticker} 这波可能不是"反弹"，更像新一轮启动信号？`,
    bad: `⚠️${ticker} 别急着抄底…这条新闻可能是短线拐点。`,
    neutral: `🧩${ticker} 现在最像"分岔路口"：看懂这3点才敢下手。`,
  };
  const hook = hookMap[st.theme] || `📌${ticker} 今天的关键变化：`;

  const conclusionMap = {
    good: `结论：偏【利好】📈，但要盯住"兑现压力"。`,
    bad: `结论：偏【利空】📉，短线优先"防回撤"。`,
    neutral: `结论：【中性】🟨，关键看下一条催化能否确认方向。`,
  };
  const conclusion = conclusionMap[st.theme] || `结论：${st.tag}`;

  const proof = (points || []).slice(0, 5).map((p) => clampShort(p, 34));
  const proofText = proof.length
    ? proof.map((p, i) => ["①", "②", "③", "④", "⑤"][i] + ` ${p}`).join("\n")
    : `① 主线叙事正在形成（资金重新定价）\n② 关键催化临近（财报/指引/产品）\n③ 关注量能与情绪是否延续`;

  const riskList = (risks || []).slice(0, 3).map((r) => clampShort(r, 36));
  const riskText = riskList.length
    ? riskList.map((r) => `- ${r}`).join("\n")
    : `- 利好可能被"获利了结"吞掉，波动会放大\n- 宏观/利率/监管任一变化都可能改叙事`;

  const actionMap = {
    good: `✅ 操作：不追高，等回踩确认；分批更稳。\n✅ 观察：量能是否放大 & 新闻是否持续发酵。`,
    bad: `✅ 操作：先减仓/控仓，等"坏消息出尽"再考虑。\n✅ 观察：是否出现止跌结构 & 风险偏好回暖。`,
    neutral: `✅ 操作：轻仓观望或网格；等突破/跌破再加码。\n✅ 观察：下一条催化是否确认方向。`,
  };
  const action = actionMap[st.theme];

  const timeLine = updatedAt ? `⏱ 生成时间：${updatedAt}` : "";

  return `${hook}

【${ticker}】${st.emoji} 情绪：${st.tag}
《${title}》
${conclusion}

📌 今天最重要的 3-5 条证据：
${proofText}

⚠️ 但我更担心的风险：
${riskText}

${action}
${timeLine}

👇 你觉得 ${ticker} 接下来是"继续上"还是"要回调"？评论区说下你的仓位打法
#美股 #AI投研 #${ticker} #美股新闻解读
`;
}

// ---------------------------------------------------------------------------
// HTML poster builder
// ---------------------------------------------------------------------------
function buildPosterHtml({ ticker, title, sentiment, points, risks, updatedAt }) {
  const st = pickSentimentStyle(sentiment);
  const dateStr = formatDateStr(updatedAt);

  const hookMap = {
    good: `⚡${ticker} 这波可能不是"反弹"，更像新一轮启动信号？`,
    bad: `⚠️${ticker} 别急着抄底…这条新闻可能是短线拐点。`,
    neutral: `🧩${ticker} 现在最像"分岔路口"：看懂这3点才敢下手。`,
  };
  const hook = hookMap[st.theme] || `📌${ticker} 今天的关键变化：`;

  const conclusionMap = {
    good: `结论：偏【利好】📈，但要盯住"兑现压力"。`,
    bad: `结论：偏【利空】📉，短线优先"防回撤"。`,
    neutral: `结论：【中性】🟨，关键看下一条催化能否确认方向。`,
  };
  const conclusion = conclusionMap[st.theme] || `结论：${st.tag}`;

  const bullets = (points || []).slice(0, 5);
  const risksList = (risks || []).slice(0, 3);

  const pointsHtml = bullets
    .map((b) => `<li>${escapeHtml(clampShort(b, 50))}</li>`)
    .join("\n          ");
  const risksHtml = risksList.length
    ? risksList
        .map((r) => `<div class="risk">⚠️ ${escapeHtml(clampShort(r, 60))}</div>`)
        .join("\n          ")
    : `<div class="risk">⚠️ 波动放大，注意"获利了结"</div>`;

  const actionMap = {
    good: `✅ 不追高，等回踩确认；分批更稳。<br/>✅ 观察：量能是否放大 & 新闻是否持续发酵。`,
    bad: `✅ 先减仓/控仓，等"坏消息出尽"再考虑。<br/>✅ 观察：止跌结构 & 风险偏好回暖。`,
    neutral: `✅ 轻仓观望或网格；等突破/跌破再加码。<br/>✅ 观察：下一条催化是否确认方向。`,
  };
  const action = actionMap[st.theme];

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(ticker)} Poster</title>
<style>
  :root{
    --bg1:#0b1220; --bg2:#0f172a;
    --card: rgba(255,255,255,0.06);
    --text:#e5e7eb; --muted: rgba(229,231,235,0.72);
    --line: rgba(255,255,255,0.10);
    --good:#22c55e; --bad:#ef4444; --neutral:#f59e0b;
    --yellow: rgba(245,158,11,0.18);
  }
  *{ box-sizing:border-box; }
  body{
    margin:0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", Arial, "Apple Color Emoji","Segoe UI Emoji";
    color:var(--text);
    background: radial-gradient(1200px 900px at 20% 10%, rgba(56,189,248,0.18), transparent 55%),
                radial-gradient(900px 700px at 80% 20%, rgba(167,139,250,0.18), transparent 55%),
                linear-gradient(180deg, var(--bg1), var(--bg2));
  }
  .wrap{ width:1080px; margin:0 auto; padding:58px 56px 64px; }
  .hook{
    font-size:52px; font-weight:900; line-height:1.1;
    letter-spacing:0.2px;
    margin:0 0 18px;
  }
  .row{
    display:flex; gap:12px; align-items:center; flex-wrap:wrap;
    margin-bottom:18px;
  }
  .pill{
    display:inline-flex; align-items:center; gap:10px;
    padding:10px 14px; border-radius:999px;
    border:1px solid var(--line);
    background: rgba(255,255,255,0.04);
    font-size:22px;
  }
  .dot{ width:10px; height:10px; border-radius:999px;
    background:${st.theme === "good" ? "var(--good)" : st.theme === "bad" ? "var(--bad)" : "var(--neutral)"};
  }
  .title{ font-size:30px; font-weight:800; margin:0 0 10px; color:rgba(255,255,255,0.92); }
  .meta{ font-size:18px; color:var(--muted); margin-bottom:18px; }
  .card{
    border:1px solid var(--line);
    background: var(--card);
    border-radius:28px;
    padding:26px 26px;
    backdrop-filter: blur(10px);
    margin-top:18px;
  }
  h2{ margin:0 0 12px; font-size:26px; }
  ul{ margin:0; padding-left: 26px; }
  li{ font-size:24px; line-height:1.55; margin:10px 0; color:rgba(255,255,255,0.92); }
  .riskbox{
    border:1px solid rgba(245,158,11,0.30);
    background: var(--yellow);
    border-radius:22px;
    padding:18px 18px;
    margin-top:14px;
  }
  .risk{ font-size:22px; line-height:1.5; margin:8px 0; color:rgba(255,255,255,0.92); }
  .action{ font-size:22px; line-height:1.55; color:rgba(255,255,255,0.92); }
  .bottom{
    margin-top:22px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:18px;
    padding:18px 22px;
    border-radius:22px;
    border:1px solid var(--line);
    background: rgba(255,255,255,0.03);
  }
  .cta{ font-size:22px; color:rgba(255,255,255,0.90); }
  .water{ font-size:18px; color:var(--muted); }
</style>
</head>
<body>
  <div class="wrap">
    <div class="hook">${escapeHtml(hook)}</div>

    <div class="row">
      <div class="pill"><span class="dot"></span><span>【${escapeHtml(ticker)}】${st.emoji} 情绪：${escapeHtml(st.tag)}</span></div>
      <div class="pill">🧾 ${escapeHtml(conclusion)}</div>
    </div>

    <div class="title">《${escapeHtml(title || "今日投研速览")}》</div>
    <div class="meta">数据源：Yahoo Finance 新闻 + DeepSeek 观点提炼 · ${escapeHtml(dateStr)}</div>

    <div class="card">
      <h2>📌 证据（3-5 条，直接当正文）</h2>
      <ul>${pointsHtml}</ul>

      <div class="riskbox">
        <h2 style="margin:0 0 10px;font-size:24px;">⚠️ 风险提示</h2>
        ${risksHtml}
      </div>
    </div>

    <div class="card">
      <h2>✅ 操作建议</h2>
      <div class="action">${action}</div>
    </div>

    <div class="bottom">
      <div class="cta">👇 你觉得 ${escapeHtml(ticker)} 接下来是"继续上"还是"要回调"？评论区说下你的打法</div>
      <div class="water">@your_handle · #美股 #AI投研</div>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async function main() {
  const { default: pLimit } = await import("p-limit");
  const limit = pLimit(3);

  // Ensure output directories
  await fs.ensureDir(OUT_COVERS_DIR);
  await fs.ensureDir(OUT_XHS_DIR);
  await fs.ensureDir(OUT_ZH_DIR);

  // ── Daily Report Integration ───────────────────────────────────────
  // MUST load BEFORE tasks execute — data flows into buildSlideSet()
  let dailyReportData = null;
  if (DAILY_REPORT_JSON_PATH) {
    try {
      dailyReportData = await fs.readJson(DAILY_REPORT_JSON_PATH);
      console.log(`📋 已加载日报结构化数据: ${DAILY_REPORT_JSON_PATH}`);
      if (dailyReportData.marketRiskEvents) {
        console.log(`   风险事件: ${dailyReportData.marketRiskEvents.length} 条`);
      }
    } catch (e) {
      console.warn(`⚠️ 无法加载日报数据: ${e.message}`);
    }
  }
  // ────────────────────────────────────────────────────────────────────

  const tasks = TICKERS.map((ticker) =>
    limit(async () => {
      // ── Fast path: daily report data = skip API, use structured data ──
      let opts;
      if (dailyReportData && dailyReportData.enrichedStockData?.[ticker]) {
        const enriched = dailyReportData.enrichedStockData[ticker];
        const monitoring = dailyReportData.stockMonitoring?.[ticker] || {};
        console.log(`📋 ${ticker}: 使用日报结构化数据 (sentiment=${enriched.sentiment}, risk=${monitoring.riskLevel})`);
        opts = {
          ticker,
          title: `${ticker} 今日投研速览（日报增强）`,
          sentiment: enriched.sentiment || "中性",
          points: enriched.keyPoints || [],
          risks: enriched.risks || [],
          updatedAt: new Date().toISOString(),
          // Daily report context
          dailyRiskLevel: monitoring.riskLevel || null,
          marketRiskEvents: dailyReportData.marketRiskEvents || [],
          marketSummary: dailyReportData.marketSummary || {},
          fromDailyReport: true,
        };
      } else {
        // ── Fallback: call API ──
        const url = `${BASE_URL}/api/stocks/${ticker}/summary`;
        try {
          console.log(`Fetching: ${url}`);
          const raw = await fetchJson(url);
          const norm = normalizeApiResponse(raw);
          opts = {
            ticker,
            title: norm.title,
            sentiment: norm.sentiment,
            points: norm.points,
            risks: norm.risks,
            updatedAt: norm.updatedAt,
            fromDailyReport: false,
          };
        } catch (e) {
          console.warn(`⚠️ ${ticker} API 不可用（服务器未运行？），使用最小数据生成`);
          opts = {
            ticker,
            title: `${ticker} 今日投研速览`,
            sentiment: "中性",
            points: ["数据暂不可用，请启动 Next.js 服务后重试"],
            risks: ["无法获取实时风险数据"],
            updatedAt: new Date().toISOString(),
            fromDailyReport: false,
          };
        }
      }

      // 1) Text post with daily report annotation
      let textAugment = "";
      if (opts.fromDailyReport) {
        textAugment = `\n📋 [日报风险等级] ${opts.dailyRiskLevel || "N/A"}`;
      }
      const text = buildViralPost(opts) + textAugment;

      // 2) Fetch real market data for diagnostic dashboard
      const metrics = await fetchDiagnosticData(ticker).catch(() => null);
      if (metrics) {
        console.log(`   📊 ${ticker} 实盘: $${metrics.price}  PE=${metrics.raw.pe.toFixed(1)}  vs50MA=${((metrics.price/metrics.ma50-1)*100).toFixed(1)}%`);
      }

      // 3) Build slide set — use premium template when metrics available
      const slideOpts = { ...opts, metrics };
      const slides = metrics
        ? buildPremiumSlideSet(slideOpts)
        : buildSlideSet(slideOpts);

      return {
        ticker,
        text,
        slides,
        dailyReportTrace: opts.fromDailyReport
          ? {
              riskLevel: opts.dailyRiskLevel,
              pointsCount: opts.points?.length || 0,
              risksCount: opts.risks?.length || 0,
              marketEventsCount: (opts.marketRiskEvents || []).length,
              fromDailyReport: true,
            }
          : { fromDailyReport: false },
      };
    })
  );

  const results = await Promise.all(tasks);

  // Write text file
  const textBlocks = results.map((r) => r.text);
  await fs.writeFile(OUT_TXT, textBlocks.join("\n--------------------------------\n\n"), "utf8");
  console.log(`✅ 文案已生成：${OUT_TXT}`);

  // ── 4-slide cover PNGs ───────────────────────────────────────────
  let coverCount = 0;
  console.log("\n🎨 生成4图封面序列…");
  for (const r of results) {
    if (r.slides && !r.error) {
      try {
        const folderName = makeOutDirName(r.ticker);
        const outDir = path.join(OUT_COVERS_DIR, folderName);
        const slideResults = await renderSlideSet(r.ticker, r.slides, outDir);
        for (const sr of slideResults) {
          if (!sr.error) console.log(`✅ ${sr.name}  (${sr.sizeKB}KB)`);
        }
        // Write post_caption.txt alongside PNGs
        if (r.slides.caption) {
          const captionPath = path.join(outDir, "post_caption.txt");
          await fs.writeFile(captionPath, r.slides.caption, "utf8");
          console.log(`✅ post_caption.txt`);
        }
        console.log(`   📁 ${outDir}`);
        coverCount++;
      } catch (e) {
        console.error(`❌ ${r.ticker} 封面失败: ${e.message}`);
      }
    }
  }

  await closeBrowser();

  console.log(`\n🎉 全部完成：${results.length} 只股票
   🎨 4图封面：${coverCount} 套（每套4张）`);
})().catch((err) => {
  console.error("❌ 生成失败：", err);
  process.exit(1);
});
