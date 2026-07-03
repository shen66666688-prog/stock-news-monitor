/* eslint-disable no-console */
/**
 * api-stats.js — API 命中率查看器
 *
 * 用法：
 *   node scripts/api-stats.js          # 查看统计
 *   node scripts/api-stats.js --reset  # 重置计数器
 *   node scripts/api-stats.js --watch  # 每5秒刷新
 */

const fs = require("fs");
const path = require("path");

const STATS_FILE = path.join(process.cwd(), ".claude", "api-stats.json");

function load() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
    }
  } catch { /* ignore */ }
  return null;
}

function printStats(data) {
  if (!data) {
    console.log("📭 尚无 API 调用记录。启动服务器后会自动追踪。");
    return;
  }

  const labels = {
    yahoo_search:  "Yahoo 新闻搜索  ",
    yahoo_chart:   "Yahoo 图表 API  ",
    yahoo_html:    "Yahoo HTML 解析 ",
    deepseek:      "DeepSeek AI    ",
    article_scrape:"文章抓取       ",
  };

  console.log("");
  console.log("╔══════════════════════════════════════╗");
  console.log("║       API 命中率仪表盘               ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("");

  let totalCalls = 0, totalSuccess = 0, totalFailed = 0, totalCache = 0;

  for (const [key, label] of Object.entries(labels)) {
    const s = data[key] || { calls: 0, success: 0, failed: 0, cacheHits: 0 };
    totalCalls += s.calls;
    totalSuccess += s.success;
    totalFailed += s.failed;
    totalCache += s.cacheHits;

    const hitRate = s.calls > 0 ? `${((s.success / s.calls) * 100).toFixed(0)}%` : "  —";
    const cacheRate = s.calls > 0 ? `${((s.cacheHits / s.calls) * 100).toFixed(0)}%` : "  —";
    const barLen = Math.min(20, s.success);
    const bar = "█".repeat(barLen) + "░".repeat(20 - barLen);

    console.log(`${label} ${bar}`);
    console.log(`  调用:${String(s.calls).padStart(4)}  成功:${hitRate.padStart(4)}  失败:${String(s.failed).padStart(3)}  缓存:${cacheRate.padStart(4)}`);
    if (s.lastError) {
      console.log(`  ⚠️  ${s.lastError.slice(0, 90)}`);
    }
    console.log("");
  }

  const overallRate = totalCalls > 0 ? `${((totalSuccess / totalCalls) * 100).toFixed(0)}%` : "—";
  console.log("───────────────────────────────────────");
  console.log(`  总计: ${totalCalls} 调用 | ${overallRate} 成功率 | ${totalCache} 缓存命中`);
  console.log("");

  // DeepSeek cost estimate (¥0.001/1K tokens, ~800 tokens/call)
  const deepseekCalls = data.deepseek?.calls || 0;
  const deepseekSuccess = data.deepseek?.success || 0;
  const estCost = (deepseekSuccess * 800 / 1000 * 0.001).toFixed(3);
  console.log(`  💰 DeepSeek 估算费用: ¥${estCost} (${deepseekSuccess} 成功调用 × ~800 tokens)`);
  console.log("");
}

// ── Main ──
const args = process.argv.slice(2);

if (args.includes("--reset")) {
  if (fs.existsSync(STATS_FILE)) fs.unlinkSync(STATS_FILE);
  console.log("✅ 计数器已重置");
} else if (args.includes("--watch")) {
  console.log("🔄 每5秒刷新 (Ctrl+C 退出)...");
  setInterval(() => {
    console.clear();
    printStats(load());
  }, 5000);
} else {
  printStats(load());
}
