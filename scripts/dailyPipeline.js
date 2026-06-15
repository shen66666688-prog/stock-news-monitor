/* eslint-disable no-console */
/**
 * dailyPipeline.js — Full daily content pipeline orchestrator
 *
 * Workflow:
 *   1. Generate daily risk report (dailyReportGenerator)
 *   2. Generate posts enriched with daily report data
 *   3. Organize all output into output/daily/YYYY-MM-DD/
 *   4. Update verification metrics
 *
 * Usage: node scripts/dailyPipeline.js [--date YYYY-MM-DD]
 *
 * Prerequisites:
 *   - DEEPSEEK_API_KEY in .env.local
 *   - Next.js dev server running (for generate-posts API calls)
 */

const fs = require("fs-extra");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WATCHLIST = ["NVDA", "AAPL", "TSLA", "MSFT", "META", "AMZN", "GOOGL"];

const ROOT = process.cwd();
const OUTPUT_BASE = path.join(ROOT, "output", "daily");
const COVERS_DIR = path.join(ROOT, "covers");
const OUT_XHS_DIR = path.join(ROOT, "output", "xiaohongshu");
const OUT_ZH_DIR = path.join(ROOT, "output", "zhihu");
const OUT_TXT = path.join(ROOT, "今日发帖文案.txt");
const METRICS_DIR = path.join(ROOT, "output", "metrics");
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

// ---------------------------------------------------------------------------
// Step 1: Generate daily risk report
// ---------------------------------------------------------------------------
async function step1_dailyReport(dateStr) {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  Step 1: 生成风险结构化日报          ║");
  console.log("╚══════════════════════════════════════╝\n");

  // Run dailyReportGenerator.js as a child process
  // Actually, we'll require it directly since it's CommonJS
  // But to keep things clean, we run it as a function

  // Delete require cache to ensure fresh run
  const genPath = path.join(ROOT, "scripts", "dailyReportGenerator.js");
  delete require.cache[require.resolve(genPath)];

  // We won't exec a subprocess; instead we'll do the work inline
  // for the pipeline. But the daily report generator is already standalone.
  // For the pipeline, we call it directly.

  console.log("📋 调用日报生成器…");
  // The dailyReportGenerator.js is designed as a standalone script.
  // We run it via child process for isolation.
  const { execSync } = require("child_process");
  try {
    const cmd = `node "${genPath}" --date ${dateStr}`;
    console.log(`   执行: ${cmd}`);
    execSync(cmd, { stdio: "inherit", cwd: ROOT, env: { ...process.env } });
    console.log("✅ 日报生成完成\n");
  } catch (e) {
    console.error("❌ 日报生成失败:", e.message);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Step 2: Generate posts (optionally enriched with daily report)
// ---------------------------------------------------------------------------
async function step2_generatePosts(dateStr) {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  Step 2: 生成内容帖子 (P1-P4)         ║");
  console.log("╚══════════════════════════════════════╝\n");

  const dailyReportJson = path.join(OUTPUT_BASE, dateStr, "dailyReport.json");

  let dailyReportData = null;
  if (await fs.pathExists(dailyReportJson)) {
    dailyReportData = await fs.readJson(dailyReportJson);
    console.log("✅ 已加载日报结构化数据，将用于内容增强\n");
  } else {
    console.warn("⚠️ 未找到日报数据，将使用默认API流程\n");
  }

  // Run generate-posts.js with daily report context
  const genPostsPath = path.join(ROOT, "scripts", "generate-posts.js");

  // Pass daily report data path as env var
  const env = { ...process.env };
  if (dailyReportData) {
    env.DAILY_REPORT_JSON = dailyReportJson;
  }

  const { execSync } = require("child_process");
  try {
    const cmd = `node "${genPostsPath}"`;
    console.log(`   执行: ${cmd}`);
    execSync(cmd, { stdio: "inherit", cwd: ROOT, env });
    console.log("✅ 内容生成完成\n");
  } catch (e) {
    console.error("❌ 内容生成失败:", e.message);
    // Don't throw — daily report can succeed even if posts fail
    console.warn("⚠️ 继续执行后续步骤…\n");
  }
}

// ---------------------------------------------------------------------------
// Step 3: Organize output into daily directory
// ---------------------------------------------------------------------------
async function step3_organizeOutput(dateStr) {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  Step 3: 整理每日输出目录             ║");
  console.log("╚══════════════════════════════════════╝\n");

  const outDir = path.join(OUTPUT_BASE, dateStr);
  await fs.ensureDir(outDir);

  // 1) Copy daily report text (already saved by dailyReportGenerator)
  const dailyReportFile = path.join(outDir, `US_AI_Daily_${dateStr}.txt`);
  if (!(await fs.pathExists(dailyReportFile))) {
    console.log("   ⚠️ 日报文件已由日报生成器保存");
  } else {
    console.log(`   ✅ 日报文件: ${dailyReportFile}`);
  }

  // 2) Copy covers (P1-P4 PNGs) for each stock
  console.log("\n   📁 整理封面图片…");
  let coverCount = 0;
  for (const ticker of WATCHLIST) {
    // Find the most recent cover dir for this ticker
    if (!(await fs.pathExists(COVERS_DIR))) continue;

    const entries = await fs.readdir(COVERS_DIR);
    const tickerDirs = entries
      .filter((e) => e.startsWith(`${ticker}_`))
      .sort()
      .reverse();

    if (tickerDirs.length === 0) continue;

    const srcDir = path.join(COVERS_DIR, tickerDirs[0]);
    const dstDir = path.join(outDir, ticker);

    // Check if source files exist
    const files = ["P1_cover.png", "P2_conclusion.png", "P3_logic.png", "P4_action.png", "post_caption.txt"];
    let copied = 0;
    for (const f of files) {
      const src = path.join(srcDir, f);
      if (await fs.pathExists(src)) {
        await fs.ensureDir(dstDir);
        await fs.copyFile(src, path.join(dstDir, f));
        copied++;
      }
    }
    if (copied > 0) {
      console.log(`   ✅ ${ticker}: 复制 ${copied} 个文件`);
      coverCount++;
    }
  }
  console.log(`   📊 共整理 ${coverCount} 只股票的封面\n`);

  // 3) Copy post_caption.txt for each platform
  for (const ticker of WATCHLIST) {
    // Xiaohongshu
    const xhsSrc = path.join(OUT_XHS_DIR, `${ticker}.txt`);
    if (await fs.pathExists(xhsSrc)) {
      const xhsDst = path.join(outDir, `${ticker}_xiaohongshu.txt`);
      await fs.copyFile(xhsSrc, xhsDst);
    }

    // Zhihu
    const zhSrc = path.join(OUT_ZH_DIR, `${ticker}.txt`);
    if (await fs.pathExists(zhSrc)) {
      const zhDst = path.join(outDir, `${ticker}_zhihu.txt`);
      await fs.copyFile(zhSrc, zhDst);
    }
  }

  // 4) Copy master text file
  if (await fs.pathExists(OUT_TXT)) {
    await fs.copyFile(OUT_TXT, path.join(outDir, "post_caption.txt"));
    console.log("   ✅ 主文案已复制");
  }

  // 5) Copy platform summary files
  const summaryFiles = [
    { src: path.join(OUT_XHS_DIR, "今日发帖文案_小红书.txt"), dst: "今日发帖文案_小红书.txt" },
    { src: path.join(OUT_ZH_DIR, "今日发帖文案_知乎.txt"), dst: "今日发帖文案_知乎.txt" },
  ];
  for (const { src, dst } of summaryFiles) {
    if (await fs.pathExists(src)) {
      await fs.copyFile(src, path.join(outDir, dst));
      console.log(`   ✅ ${dst}`);
    }
  }

  console.log(`\n✅ 每日输出已整理至: ${outDir}\n`);
  return outDir;
}

// ---------------------------------------------------------------------------
// Step 4: Update verification metrics
// ---------------------------------------------------------------------------
async function step4_updateMetrics(dateStr) {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  Step 4: 更新验证指标                 ║");
  console.log("╚══════════════════════════════════════╝\n");

  await fs.ensureDir(METRICS_DIR);

  let metrics = { records: [] };
  if (await fs.pathExists(METRICS_FILE)) {
    metrics = await fs.readJson(METRICS_FILE);
  }

  // Count generated content
  const outDir = path.join(OUTPUT_BASE, dateStr);
  let contentCount = 0;
  if (await fs.pathExists(outDir)) {
    const files = await fs.readdir(outDir);
    contentCount = files.length;
  }

  const existingIdx = metrics.records.findIndex((r) => r.date === dateStr);
  const record = {
    date: dateStr,
    stocks: WATCHLIST,
    generationCount: WATCHLIST.length,
    contentCount,
    // Reserved engagement fields
    views: 0,
    likes: 0,
    favorites: 0,
    comments: 0,
    followers: 0,
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
  console.log(`   日期: ${dateStr}`);
  console.log(`   股票: ${WATCHLIST.length} 只`);
  console.log(`   生成数: ${WATCHLIST.length}`);
  console.log(`   文件数: ${contentCount}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async function main() {
  const args = process.argv.slice(2);
  let dateStr = getDateStr();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) {
      dateStr = args[i + 1];
    }
  }

  console.log("\n🚀 每日内容管线启动");
  console.log(`📅 日期: ${dateStr}`);
  console.log("══════════════════════════════════════");

  const startTime = Date.now();

  try {
    // Step 1: Generate daily risk report
    await step1_dailyReport(dateStr);

    // Step 2: Generate posts (with daily report enrichment)
    await step2_generatePosts(dateStr);

    // Step 3: Organize output
    await step3_organizeOutput(dateStr);

    // Step 4: Update metrics
    await step4_updateMetrics(dateStr);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("══════════════════════════════════════");
    console.log(`🎉 每日管线执行完成！耗时: ${elapsed}s`);
    console.log("══════════════════════════════════════\n");
  } catch (e) {
    console.error("\n❌ 管线执行失败:", e.message);
    process.exit(1);
  }
})().catch((err) => {
  console.error("❌ 管线崩溃:", err);
  process.exit(1);
});
