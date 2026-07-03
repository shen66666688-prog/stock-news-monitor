/* eslint-disable no-console */
/**
 * generateCustomReport.js — Generate US stock report with web-sourced news data
 *
 * Uses web-search-collected news data to generate a comprehensive report
 * when Yahoo Finance is blocked from mainland China.
 *
 * Usage: node scripts/generateCustomReport.js
 */

const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// ── Load .env.local ──────────────────────────────────────────
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
      if (!process.env[key]) process.env[key] = value;
    }
    console.log("📋 已加载 .env.local 环境变量");
  }
})();

// ── Config ───────────────────────────────────────────────────
const WATCHLIST = ["NVDA", "AAPL", "TSLA", "MSFT", "META", "AMZN", "GOOGL"];

const STOCK_NAMES = {
  NVDA: "英伟达", AAPL: "苹果", TSLA: "特斯拉", MSFT: "微软",
  META: "Meta", AMZN: "亚马逊", GOOGL: "谷歌",
};

const DESKTOP_DIR = path.join(os.homedir(), "Desktop", "US_Stock_AI_Daily");
const OUTPUT_BASE = path.join(process.cwd(), "output", "daily");
const METRICS_DIR = path.join(process.cwd(), "output", "metrics");
const METRICS_FILE = path.join(METRICS_DIR, "metrics.json");

function getDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── News data collected from web search on 2026-06-30 ────────
const ALL_NEWS = {
  NVDA: [
    { title: "黄仁勋：英伟达计划将50%自由现金流返还给股东", publisher: "21经济网" },
    { title: "NVIDIA宣布Vera Rubin平台，黄仁勋称其为公司史上最重要产品", publisher: "Yahoo Finance" },
    { title: "英伟达股价接近熊市区域，从5月高点下跌近20%", publisher: "Benzinga" },
    { title: "Jamendo起诉英伟达涉嫌滥用音频数据训练AI模型", publisher: "Yahoo Finance" },
    { title: "黄仁勋：国家安全优先于商业机会，中国市场仍存不确定性", publisher: "Insider Monkey" },
  ],
  AAPL: [
    { title: "苹果WWDC 2026发布AI驱动Siri和Apple Intelligence平台", publisher: "Nasdaq" },
    { title: "华尔街对苹果AI战略重置转为支持，分析师上调目标价", publisher: "Yahoo Finance" },
    { title: "苹果Mac和iPad全球涨价17-25%，因AI数据中心需求推高存储成本", publisher: "Bloomberg" },
    { title: "苹果计划M7芯片转向AI优先，跳过M6 Pro/Max", publisher: "Yahoo Finance" },
    { title: "苹果遭遇勒索软件攻击，已启动调查", publisher: "Yahoo Finance" },
  ],
  TSLA: [
    { title: "特斯拉FSD V14 Lite推送给350万辆旧款HW3车型，股价大涨8.4%", publisher: "Morningstar" },
    { title: "特斯拉Cybercab在奥斯汀开始无方向盘/踏板测试", publisher: "Benzinga" },
    { title: "分析师预计Q2交付量40-42万辆，Barclays预计超预期", publisher: "Investing.com" },
    { title: "特斯拉与Sunrun宣布16GW分布式能源合作框架", publisher: "Benzinga" },
    { title: "Baird分析师推测特斯拉与SpaceX可能在12-18个月内合并", publisher: "Yahoo Finance" },
  ],
  MSFT: [
    { title: "微软遭遇26年来最惨月份，AI支出激增引发担忧，市值蒸发5700亿美元", publisher: "金融界" },
    { title: "微软Azure增长40%但AI基础设施支出引发云毛利率压缩担忧", publisher: "Nasdaq" },
    { title: "微软股价跌至一年低点，投资者对1900亿美元AI资本支出表示质疑", publisher: "Quartz" },
    { title: "Michael Burry披露持有微软2028年到期看涨期权", publisher: "Benzinga" },
    { title: "高盛预计AI基础设施支出超级周期，2026年达7570亿美元", publisher: "Goldman Sachs" },
  ],
  META: [
    { title: "Meta考虑数十亿美元股票增发以资助AI建设，股价大跌6%", publisher: "Nasdaq" },
    { title: "Meta 2026年AI资本支出提升至1250-1450亿美元，较2025年近乎翻倍", publisher: "Financial Times" },
    { title: "Meta CTO称员工士气接近20年最低点，AI高管离职", publisher: "Nasdaq" },
    { title: "Meta推出Muse Spark AI模型，性能大幅超越Llama 4", publisher: "AI Analysis" },
    { title: "高盛和UBS双双下调Meta评级至卖出/中性", publisher: "Goldman Sachs/UBS" },
  ],
  AMZN: [
    { title: "亚马逊Prime Day创纪录：美国在线消费达264亿美元，同比增长9.3%", publisher: "Benzinga" },
    { title: "AWS宣布GPU云实例涨价约20%，分析师称看好AI需求强劲", publisher: "Investor's Business Daily" },
    { title: "分析师预测亚马逊可能成为首家年收入达1万亿美元的公司", publisher: "Benzinga" },
    { title: "亚马逊2026年计划资本支出约2000亿美元，含OpenAI承诺1000亿+", publisher: "Bloomberg" },
    { title: "亚马逊DSP整合Comscore定向广告解决方案", publisher: "Yahoo Finance" },
  ],
  GOOGL: [
    { title: "谷歌晋升道琼斯工业平均指数成分股，取代Verizon", publisher: "东方财富" },
    { title: "Alphabet完成美国史上最大股权融资847.5亿美元，巴菲特旗下伯克希尔参投100亿", publisher: "Yahoo Finance" },
    { title: "谷歌AI人才流失：Gemini联创Noam Shazeer加盟OpenAI，诺奖得主John Jumper跳槽Anthropic", publisher: "Benzinga" },
    { title: "谷歌因算力短缺对Gemini实施使用配额限制，拒绝向Meta提供算力", publisher: "东方财富" },
    { title: "Alphabet Q1暂停股票回购为10年来首次，现金储备收缩", publisher: "Morningstar" },
  ],
};

const MACRO_NEWS = [
  "美国贸易代表提议对60个经济体加征10-12.5%新关税，取代即将到期的临时关税",
  "中美贸易战升级：美国对华关税升至125%，中国反制84%关税",
  "特朗普暂停对多数国家关税90天，但集中对中国施压",
  "6月CPI同比上涨2.7%，高于美联储2%目标，滞胀担忧升温",
  "纳斯达克100指数6月5日单日大跌5%，就业数据超预期推动加息预期",
  "美联储面临滞胀困境：通胀高企但经济放缓，市场定价2026年可能加息25基点",
  "欧盟警告可能动用反胁迫工具限制美国科技巨头广告收入",
  "高盛预计AI基础设施超级周期：2026年行业总支出7570亿美元，2030年累计5.3万亿美元",
];

// ── Build DeepSeek prompt ─────────────────────────────────────
function buildPrompt(dateStr) {
  const stockSections = WATCHLIST.map((ticker) => {
    const news = ALL_NEWS[ticker] || [];
    const name = STOCK_NAMES[ticker] || ticker;
    const newsBlock = news.map((n, i) => `  ${i + 1}. [${n.publisher}] ${n.title}`).join("\n");
    return `【${ticker} ${name}】\n${newsBlock}`;
  }).join("\n\n");

  const macroBlock = MACRO_NEWS.map((n, i) => `  ${i + 1}. ${n}`).join("\n");

  return `你是一位华尔街资深风险管理分析师，拥有20年以上经验。

今天是 ${dateStr}。以下是今日美股市场宏观新闻和7只核心科技股的最新新闻数据：

━━━━━━━━━━━━━━━━━━━━━━━━━━━
【宏观环境】
${macroBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
【个股新闻】
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
      "priceAction": "该股近期价格走势（1句话，如：从5月高点$236回落近20%至$192）",
      "newsSummary": "2-3句话总结该股票今日最重要的新闻动态",
      "sentiment": "利好" | "利空" | "中性",
      "riskLevel": "高" | "中" | "低"
    },
    ...（每只股票都要有）
  },
  "marketSummary": {
    "mainRiskThemes": ["风险主题1（1句话）", "风险主题2", "风险主题3", "风险主题4", "风险主题5"],
    "marketFocusPoints": ["关注焦点1（1句话）", "关注焦点2", "关注焦点3", "关注焦点4", "关注焦点5"]
  }
}

重要约束：
- marketRiskEvents 必须包含5-7条风险事件，基于真实新闻
- 每条风险事件必须来自实际新闻数据，不能凭空编造
- riskLevel 的判断标准：高=可能引发5%以上波动的系统性风险，中=行业级影响，低=个股级或短期影响
- 每只股票必须包含 priceAction 字段，反映近期价格走势
- 严格禁止任何买入建议、卖出建议、目标价、涨跌预测、收益承诺
- 语言使用中文
- 只输出JSON，不要任何其他文字`;
}

// ── Call DeepSeek API ─────────────────────────────────────────
async function callDeepSeek(prompt) {
  const mod = await import("openai");
  const OpenAI = mod.default || mod;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("❌ DEEPSEEK_API_KEY not configured");
    return null;
  }

  const client = new OpenAI({ baseURL: "https://api.deepseek.com", apiKey });

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
      max_tokens: 8192,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    let jsonStr = raw;
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("❌ DeepSeek API 调用失败:", e.message);
    return null;
  }
}

// ── Enrich with per-stock sentiment ───────────────────────────
async function enrichWithSentiment(data) {
  const mod = await import("openai");
  const OpenAI = mod.default || mod;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return data;

  const client = new OpenAI({ baseURL: "https://api.deepseek.com", apiKey });
  const enriched = JSON.parse(JSON.stringify(data));
  enriched.enrichedStockData = {};

  for (const ticker of WATCHLIST) {
    const news = ALL_NEWS[ticker] || [];
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

// ── Format report ─────────────────────────────────────────────
function formatReport(data, dateStr) {
  const lines = [];

  lines.push("╔══════════════════════════════════════════════════╗");
  lines.push("║    美股风险结构化日报 (US Stock AI Daily)        ║");
  lines.push(`║    日期: ${dateStr}                               ║`);
  lines.push("║    数据源: Web Search + DeepSeek AI 分析          ║");
  lines.push("╚══════════════════════════════════════════════════╝");
  lines.push("");
  lines.push("⚠️ 免责声明：本日报仅供研究参考，不构成任何投资建议。");
  lines.push("   严格禁止依据本报告做出买入/卖出决策。市场有风险，投资需谨慎。");
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  // Section 1: Macro Overview
  lines.push("# 宏观环境速览");
  lines.push("");
  lines.push("## 近期宏观新闻");
  MACRO_NEWS.forEach((n, i) => {
    lines.push(`  ${i + 1}. ${n}`);
  });
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  // Section 2: Market Risk Events
  lines.push("# 今日市场风险事件");
  lines.push("");

  const events = data.marketRiskEvents || [];
  if (events.length === 0) {
    lines.push("（今日未检测到显著风险事件）");
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
      lines.push(`❓ 不确定性说明：${event.uncertaintyNote || "信息不足"}`);
      lines.push("");
      lines.push("---");
      lines.push("");
    });
  }

  // Section 3: Stock Monitoring
  lines.push("# 自选股监控");
  lines.push("");

  const monitoring = data.stockMonitoring || {};
  WATCHLIST.forEach((ticker) => {
    const stock = monitoring[ticker];
    if (!stock) {
      lines.push(`## ${ticker}（${STOCK_NAMES[ticker] || ticker}）`);
      lines.push("- 数据缺失");
      lines.push("");
      return;
    }

    const riskEmoji = stock.riskLevel === "高" ? "🔴" : stock.riskLevel === "中" ? "🟡" : "🟢";
    const sentEmoji = stock.sentiment === "利好" ? "📈" : stock.sentiment === "利空" ? "📉" : "➡️";

    lines.push(`## ${ticker}（${STOCK_NAMES[ticker] || ticker}）`);
    lines.push("");
    if (stock.priceAction) {
      lines.push(`- 📊 价格动态：${stock.priceAction}`);
    }
    lines.push(`- 新闻更新：${stock.hasNewsUpdate ? "✅ Yes" : "❌ No"}`);
    lines.push(`- 重大事件：${stock.hasMajorEvent ? "⚠️ Yes" : "✅ No"}`);
    lines.push(`- 情绪判断：${sentEmoji} ${stock.sentiment || "待评估"}`);
    lines.push(`- 新闻摘要：${stock.newsSummary || "暂无"}`);
    lines.push(`- 风险等级：${riskEmoji} ${stock.riskLevel || "待评估"}`);
    lines.push("");
  });

  // Section 4: Market Summary
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

  // Per-stock sentiment analysis
  const enriched = data.enrichedStockData || {};
  if (Object.keys(enriched).length > 0) {
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
    lines.push("# 单股情绪深度分析");
    lines.push("");

    WATCHLIST.forEach((ticker) => {
      const ed = enriched[ticker];
      if (!ed) return;
      const sentEmoji = ed.sentiment === "利好" ? "📈" : ed.sentiment === "利空" ? "📉" : "➡️";
      lines.push(`## ${ticker} ${STOCK_NAMES[ticker] || ticker} ${sentEmoji} ${ed.sentiment}`);
      lines.push("");
      lines.push("### 关键要点");
      (ed.keyPoints || []).forEach((kp) => {
        lines.push(`  - ${kp}`);
      });
      lines.push("");
      lines.push("### 风险提示");
      (ed.risks || []).forEach((r) => {
        lines.push(`  - ⚠️ ${r}`);
      });
      lines.push("");
    });
  }

  // Footer
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push(`📅 生成时间：${dateStr} (AI 自动生成)`);
  lines.push("📊 数据来源：Web Search (Yahoo Finance/Bloomberg/Reuters) + DeepSeek AI");
  lines.push("");
  lines.push("⚠️ 风险提示：");
  lines.push("   本报告由 AI 基于公开新闻数据自动生成，内容仅供参考。");
  lines.push("   不构成任何形式的投资建议、买入建议、卖出建议、");
  lines.push("   目标价预测、涨跌预测或收益承诺。");
  lines.push("   投资者应独立判断，自行承担投资风险。");
  lines.push("");

  return lines.join("\n");
}

// ── Save outputs ──────────────────────────────────────────────
async function saveOutputs(reportText, enrichedData, dateStr) {
  const filename = `US_AI_Daily_${dateStr}.txt`;
  const outDir = path.join(OUTPUT_BASE, dateStr);

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

  // 3) Structured JSON
  const jsonPath = path.join(outDir, "dailyReport.json");
  await fs.writeJson(jsonPath, enrichedData, { spaces: 2 });
  console.log(`✅ 结构化数据已保存：${jsonPath}`);

  return { desktopPath, projectPath, jsonPath, outDir };
}

// ── Update metrics ────────────────────────────────────────────
async function updateMetrics(enrichedData, dateStr) {
  await fs.ensureDir(METRICS_DIR);

  let metrics = { records: [] };
  if (await fs.pathExists(METRICS_FILE)) {
    metrics = await fs.readJson(METRICS_FILE);
  }

  const existingIdx = metrics.records.findIndex((r) => r.date === dateStr);
  const record = {
    date: dateStr,
    stocks: WATCHLIST,
    generationCount: WATCHLIST.length,
    dataSource: "web-search",
    views: 0, likes: 0, favorites: 0, comments: 0, followers: 0,
  };

  if (existingIdx >= 0) {
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

  metrics.records = metrics.records.slice(-90);
  await fs.writeJson(METRICS_FILE, metrics, { spaces: 2 });
  console.log(`✅ 指标已更新：${METRICS_FILE}`);
}

// ── Main ──────────────────────────────────────────────────────
(async function main() {
  const dateStr = getDateStr();
  console.log(`\n📅 生成日期：${dateStr}`);
  console.log("📊 数据来源：Web Search (多源采集)");
  console.log("══════════════════════════════════════\n");

  // Count total news
  const totalNews = Object.values(ALL_NEWS).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`📡 已加载 ${totalNews} 条个股新闻 + ${MACRO_NEWS.length} 条宏观新闻\n`);

  // 1) Generate structured risk report via DeepSeek
  const prompt = buildPrompt(dateStr);
  const data = await callDeepSeek(prompt);

  if (!data) {
    console.error("❌ 无法生成日报：DeepSeek API 调用失败");
    process.exit(1);
  }

  console.log(`✅ 风险事件数：${(data.marketRiskEvents || []).length} 条\n`);

  // 2) Enrich with per-stock sentiment
  console.log("📈 补充单股情绪分析…");
  const enrichedData = await enrichWithSentiment(data);

  // 3) Format and save
  const reportText = formatReport(enrichedData, dateStr);
  await saveOutputs(reportText, enrichedData, dateStr);

  // 4) Update metrics
  await updateMetrics(enrichedData, dateStr);

  console.log(`\n🎉 美股风险结构化日报生成完成！`);
  console.log(`   日期：${dateStr}`);
  console.log(`   监控股票：${WATCHLIST.length} 只`);
  console.log(`   风险事件：${(data.marketRiskEvents || []).length} 条`);
  console.log(`   数据来源：Web Search 多源采集`);
  console.log("");
})().catch((err) => {
  console.error("❌ 日报生成失败：", err);
  process.exit(1);
});
