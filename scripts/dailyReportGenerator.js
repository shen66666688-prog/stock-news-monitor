/* eslint-disable no-console */
/**
 * dailyReportGenerator.js — US Stock AI Daily Risk Report Generator
 *
 * Generates a structured daily risk report covering:
 *   1. 今日市场风险事件 (macro risk events)
 *   2. 自选股监控 (watchlist monitoring)
 *   3. 今日市场总结 (market summary)
 *
 * Outputs:
 *   - Desktop/US_Stock_AI_Daily/US_AI_Daily_YYYY-MM-DD.txt
 *   - output/daily/YYYY-MM-DD/US_AI_Daily_YYYY-MM-DD.txt
 *   - output/daily/YYYY-MM-DD/dailyReport.json (structured data)
 *
 * Usage: node scripts/dailyReportGenerator.js [--date YYYY-MM-DD]
 */

const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const YahooFinance = require("yahoo-finance2").default;

// openai is ESM-only — dynamic import
let OpenAI = null;

// ── Load .env.local for plain Node.js scripts ──────────────────────
(function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
    console.log("📋 已加载 .env.local 环境变量");
  }
})();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WATCHLIST = ["NVDA", "AAPL", "TSLA", "MSFT", "META", "AMZN", "GOOGL"];

const STOCK_NAMES = {
  NVDA: "英伟达", AAPL: "苹果", TSLA: "特斯拉", MSFT: "微软",
  META: "Meta", AMZN: "亚马逊", GOOGL: "谷歌",
};

const DESKTOP_DIR = path.join(os.homedir(), "Desktop", "US_Stock_AI_Daily");
const OUTPUT_BASE = path.join(process.cwd(), "output", "daily");
const METRICS_DIR = path.join(process.cwd(), "output", "metrics");
const METRICS_FILE = path.join(METRICS_DIR, "metrics.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getDateStr(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getOutDirName(dateStr) {
  return path.join(OUTPUT_BASE, dateStr);
}

// ---------------------------------------------------------------------------
// DeepSeek client
// ---------------------------------------------------------------------------
async function getDeepSeekClient() {
  if (!OpenAI) {
    const mod = await import("openai");
    OpenAI = mod.default || mod;
  }
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === "your-deepseek-api-key-here") {
    console.error("❌ DEEPSEEK_API_KEY not configured");
    return null;
  }
  return new OpenAI({ baseURL: "https://api.deepseek.com", apiKey });
}

// ---------------------------------------------------------------------------
// Yahoo Finance client
// ---------------------------------------------------------------------------
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// ---------------------------------------------------------------------------
// Step 1: Fetch news for all watchlist stocks
// ---------------------------------------------------------------------------
async function fetchAllNews() {
  console.log("📡 正在获取自选股新闻…");
  const results = {};

  for (const ticker of WATCHLIST) {
    try {
      const data = await yf.search(ticker, { newsCount: 5 });
      const news = (data.news || []).slice(0, 5).map((n) => ({
        title: n.title || "无标题",
        publisher: n.publisher || "未知来源",
        link: n.link || "",
      }));
      results[ticker] = news;
      console.log(`   ✅ ${ticker}: ${news.length} 条新闻`);
    } catch (e) {
      console.warn(`   ⚠️ ${ticker}: 获取失败 — ${e.message}`);
      results[ticker] = [];
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Step 2: Build DeepSeek prompt for structured risk report
// ---------------------------------------------------------------------------
function buildPrompt(allNews, dateStr) {
  const stockSections = WATCHLIST.map((ticker) => {
    const news = allNews[ticker] || [];
    const name = STOCK_NAMES[ticker] || ticker;
    const newsBlock = news.length > 0
      ? news.map((n, i) => `  ${i + 1}. [${n.publisher}] ${n.title}`).join("\n")
      : "  暂无新闻数据";
    return `【${ticker} ${name}】\n${newsBlock}`;
  }).join("\n\n");

  return `你是一位华尔街资深风险管理分析师，拥有20年以上经验。

今天是 ${dateStr}。以下是今日美股市场7只核心科技股的最新新闻数据：

${stockSections}

请基于以上新闻数据，生成一份完整的《美股风险结构化日报》。

你必须严格以JSON格式输出（不要包含任何Markdown标记），JSON结构如下：

{
  "marketRiskEvents": [
    {
      "title": "事件标题（简洁有力，不超过20字）",
      "summary": "事件摘要（2-3句话，说清楚发生了什么、为什么重要）",
      "affectedIndustries": ["行业1", "行业2"],
      "riskLevel": "高" | "中" | "低",
      "uncertaintyNote": "不确定性说明（1句话，说清楚最大的未知因素是什么）"
    }
  ],
  "stockMonitoring": {
    "NVDA": {
      "hasNewsUpdate": true/false,
      "hasMajorEvent": true/false,
      "newsSummary": "2-3句话总结该股票今日最重要的新闻动态",
      "riskLevel": "高" | "中" | "低"
    },
    ...（每只股票都要有）
  },
  "marketSummary": {
    "mainRiskThemes": ["风险主题1（1句话）", "风险主题2", "风险主题3"],
    "marketFocusPoints": ["关注焦点1（1句话）", "关注焦点2", "关注焦点3"]
  }
}

重要约束：
- marketRiskEvents 必须包含3-5条风险事件
- 每条风险事件必须来自实际新闻数据，不能凭空编造
- riskLevel 的判断标准：高=可能引发5%以上波动的系统性风险，中=行业级影响，低=个股级或短期影响
- 严格禁止任何买入建议、卖出建议、目标价、涨跌预测、收益承诺
- 语言使用中文
- 如果某只股票确实没有新闻更新，hasNewsUpdate 设为 false

只输出JSON，不要任何其他文字。`;
}

// ---------------------------------------------------------------------------
// Step 3: Call DeepSeek API
// ---------------------------------------------------------------------------
async function callDeepSeek(prompt) {
  const client = await getDeepSeekClient();
  if (!client) return null;

  console.log("🤖 正在调用 DeepSeek 生成风险日报…");

  try {
    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "你是一个专业的金融风险管理分析师。你的回答必须始终是严格的JSON格式，不包含任何其他文字。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    // Parse — handle potential markdown code fences
    let jsonStr = raw;
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("❌ DeepSeek API 调用失败:", e.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 4: Format the structured JSON into the daily report text
// ---------------------------------------------------------------------------
function formatReport(data, dateStr) {
  const lines = [];

  // Header
  lines.push(`╔══════════════════════════════════════════════════╗`);
  lines.push(`║    美股风险结构化日报 (US Stock AI Daily)        ║`);
  lines.push(`║    日期: ${dateStr}                               ║`);
  lines.push(`║    数据源: Yahoo Finance + DeepSeek AI 分析       ║`);
  lines.push(`╚══════════════════════════════════════════════════╝`);
  lines.push("");
  lines.push("⚠️ 免责声明：本日报仅供研究参考，不构成任何投资建议。");
  lines.push("   严格禁止依据本报告做出买入/卖出决策。市场有风险，投资需谨慎。");
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  // Section 1: 今日市场风险事件
  lines.push("# 今日市场风险事件");
  lines.push("");

  const events = data.marketRiskEvents || [];
  if (events.length === 0) {
    lines.push("（今日未检测到显著风险事件）");
    lines.push("");
  } else {
    events.forEach((event, i) => {
      const riskEmoji = event.riskLevel === "高" ? "🔴" : event.riskLevel === "中" ? "🟡" : "🟢";
      lines.push(`## 风险事件 ${i + 1}：${event.title || "未命名"}`);
      lines.push("");
      lines.push(`📋 事件摘要：${event.summary || "暂无摘要"}`);
      lines.push("");
      lines.push(`🏭 影响行业：${(event.affectedIndustries || ["待评估"]).join("、")}`);
      lines.push("");
      lines.push(`${riskEmoji} 风险等级：${event.riskLevel || "待评估"}`);
      lines.push("");
      lines.push(`❓ 不确定性说明：${event.uncertaintyNote || "信息不足，持续关注中"}`);
      lines.push("");
      lines.push("---");
      lines.push("");
    });
  }

  // Section 2: 自选股监控
  lines.push("# 自选股监控");
  lines.push("");

  const monitoring = data.stockMonitoring || {};
  WATCHLIST.forEach((ticker) => {
    const stock = monitoring[ticker];
    if (!stock) {
      lines.push(`## ${ticker}（${STOCK_NAMES[ticker] || ticker}）`);
      lines.push("");
      lines.push("- 新闻更新：❓ 数据缺失");
      lines.push("- 重大事件：❓ 数据缺失");
      lines.push("- 新闻摘要：无数据");
      lines.push("- 风险等级：待评估");
      lines.push("");
      return;
    }

    const riskEmoji = stock.riskLevel === "高" ? "🔴" : stock.riskLevel === "中" ? "🟡" : "🟢";
    lines.push(`## ${ticker}（${STOCK_NAMES[ticker] || ticker}）`);
    lines.push("");
    lines.push(`- 新闻更新：${stock.hasNewsUpdate ? "✅ Yes" : "❌ No"}`);
    lines.push(`- 重大事件：${stock.hasMajorEvent ? "⚠️ Yes" : "✅ No"}`);
    lines.push(`- 新闻摘要：${stock.newsSummary || "暂无"}`);
    lines.push(`- 风险等级：${riskEmoji} ${stock.riskLevel || "待评估"}`);
    lines.push("");
  });

  // Section 3: 今日市场总结
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push("# 今日市场总结");
  lines.push("");

  const summary = data.marketSummary || {};
  const themes = summary.mainRiskThemes || [];
  const focuses = summary.marketFocusPoints || [];

  lines.push("## 今日主要风险主题");
  lines.push("");
  if (themes.length === 0) {
    lines.push("（暂无）");
  } else {
    themes.forEach((t, i) => {
      lines.push(`${i + 1}. ${t}`);
    });
  }
  lines.push("");

  lines.push("## 今日市场关注焦点");
  lines.push("");
  if (focuses.length === 0) {
    lines.push("（暂无）");
  } else {
    focuses.forEach((f, i) => {
      lines.push(`${i + 1}. ${f}`);
    });
  }
  lines.push("");

  // Footer
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push(`📅 生成时间：${dateStr} (AI 自动生成)`);
  lines.push("📊 数据来源：Yahoo Finance + DeepSeek AI");
  lines.push("");
  lines.push("⚠️ 风险提示：");
  lines.push("   本报告由 AI 基于公开新闻数据自动生成，内容仅供参考。");
  lines.push("   不构成任何形式的投资建议、买入建议、卖出建议、");
  lines.push("   目标价预测、涨跌预测或收益承诺。");
  lines.push("   投资者应独立判断，自行承担投资风险。");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Step 5: Enrich with per-stock sentiment for downstream content generation
// ---------------------------------------------------------------------------
async function enrichWithSentiment(data, allNews) {
  // Add per-stock sentiment and key points for content generation integration
  // We'll do a lighter per-stock analysis to supplement the macro report
  const client = await getDeepSeekClient();
  if (!client) return data;

  const enriched = JSON.parse(JSON.stringify(data));
  enriched.enrichedStockData = {};

  for (const ticker of WATCHLIST) {
    const news = allNews[ticker] || [];
    if (news.length === 0) {
      enriched.enrichedStockData[ticker] = {
        sentiment: "中性",
        keyPoints: ["暂无足够新闻数据进行分析"],
        risks: ["信息不足，无法评估风险"],
      };
      continue;
    }

    const titles = news.map((n) => n.title);
    const sources = news.map((n) => n.publisher);

    const prompt = `基于以下 ${ticker} 的新闻标题，进行简短分析：

${titles.map((t, i) => `${i + 1}. ${t}（来源：${sources[i]}）`).join("\n")}

请以JSON格式输出（不要Markdown标记）：
{
  "sentiment": "利好" | "利空" | "中性",
  "keyPoints": ["要点1（不超过30字）", "要点2", "要点3"],
  "risks": ["风险1（不超过30字）", "风险2"]
}

只输出JSON。`;

    try {
      const completion = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "你是一个专业金融分析师。只输出JSON，不要其他文字。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 600,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      let jsonStr = raw;
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();

      const parsed = JSON.parse(jsonStr);
      enriched.enrichedStockData[ticker] = {
        sentiment: parsed.sentiment || "中性",
        keyPoints: parsed.keyPoints || [],
        risks: parsed.risks || [],
      };
      console.log(`   ✅ ${ticker} 情绪: ${parsed.sentiment}`);
    } catch (e) {
      console.warn(`   ⚠️ ${ticker} 情绪分析失败: ${e.message}`);
      enriched.enrichedStockData[ticker] = {
        sentiment: "中性",
        keyPoints: ["AI分析暂不可用"],
        risks: ["无法评估当前风险"],
      };
    }
  }

  return enriched;
}

// ---------------------------------------------------------------------------
// Step 6: Save all output files
// ---------------------------------------------------------------------------
async function saveOutputs(reportText, enrichedData, dateStr) {
  const filename = `US_AI_Daily_${dateStr}.txt`;
  const outDir = getOutDirName(dateStr);

  // 1) Desktop
  await fs.ensureDir(DESKTOP_DIR);
  const desktopPath = path.join(DESKTOP_DIR, filename);
  await fs.writeFile(desktopPath, reportText, "utf8");
  console.log(`✅ 日报已保存：${desktopPath}`);

  // 2) Project output/daily/
  await fs.ensureDir(outDir);
  const projectPath = path.join(outDir, filename);
  await fs.writeFile(projectPath, reportText, "utf8");
  console.log(`✅ 日报已保存：${projectPath}`);

  // 3) Structured JSON for downstream consumption
  const jsonPath = path.join(outDir, "dailyReport.json");
  await fs.writeJson(jsonPath, enrichedData, { spaces: 2 });
  console.log(`✅ 结构化数据已保存：${jsonPath}`);

  return { desktopPath, projectPath, jsonPath, outDir };
}

// ---------------------------------------------------------------------------
// Step 7: Update metrics
// ---------------------------------------------------------------------------
async function updateMetrics(enrichedData, dateStr) {
  await fs.ensureDir(METRICS_DIR);

  let metrics = { records: [] };
  if (await fs.pathExists(METRICS_FILE)) {
    metrics = await fs.readJson(METRICS_FILE);
  }

  // Check if today's record already exists
  const existingIdx = metrics.records.findIndex((r) => r.date === dateStr);
  const generationCount = WATCHLIST.length; // One per stock

  const record = {
    date: dateStr,
    stocks: WATCHLIST,
    generationCount,
    // Reserved engagement fields
    views: 0,
    likes: 0,
    favorites: 0,
    comments: 0,
    followers: 0,
  };

  if (existingIdx >= 0) {
    // Preserve existing engagement data
    const existing = metrics.records[existingIdx];
    record.views = existing.views || 0;
    record.likes = existing.likes || 0;
    record.favorites = existing.favorites || 0;
    record.comments = existing.comments || 0;
    record.followers = existing.followers || 0;
    metrics.records[existingIdx] = record;
  } else {
    metrics.records.push(record);
  }

  // Keep last 90 days of records
  metrics.records = metrics.records.slice(-90);

  await fs.writeJson(METRICS_FILE, metrics, { spaces: 2 });
  console.log(`✅ 指标已更新：${METRICS_FILE}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  let dateStr = getDateStr();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) {
      dateStr = args[i + 1];
    }
  }

  console.log(`\n📅 生成日期：${dateStr}`);
  console.log("══════════════════════════════════════\n");

  // 1) Fetch all news
  const allNews = await fetchAllNews();

  const totalNews = Object.values(allNews).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`\n📊 共获取 ${totalNews} 条新闻\n`);

  if (totalNews === 0) {
    console.warn("⚠️ 未获取到任何新闻，将生成空报告");
  }

  // 2) Generate structured risk report
  const prompt = buildPrompt(allNews, dateStr);
  const data = await callDeepSeek(prompt);

  if (!data) {
    console.error("❌ 无法生成日报：DeepSeek API 调用失败");
    process.exit(1);
  }

  // 3) Enrich with per-stock sentiment data
  console.log("\n📈 补充单股情绪分析…");
  const enrichedData = await enrichWithSentiment(data, allNews);

  // 4) Format and save
  const reportText = formatReport(enrichedData, dateStr);
  await saveOutputs(reportText, enrichedData, dateStr);

  // 5) Update metrics
  await updateMetrics(enrichedData, dateStr);

  console.log(`\n🎉 美股风险结构化日报生成完成！`);
  console.log(`   日期：${dateStr}`);
  console.log(`   监控股票：${WATCHLIST.length} 只`);
  console.log(`   风险事件：${(data.marketRiskEvents || []).length} 条`);
  console.log("");
})().catch((err) => {
  console.error("❌ 日报生成失败：", err);
  process.exit(1);
});
