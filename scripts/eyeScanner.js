/**
 * eyeScanner.js — Claude 的眼睛
 *
 * 扫描桌面 "claude的眼睛" 文件夹，读取所有文件并输出结构化报告。
 * Claude Code 可以调用这个脚本来"看见"你放进去的任何东西。
 *
 * 支持格式：
 *   .xlsx / .xls  → Excel 表格（抖音/小红书导出的数据）
 *   .csv          → CSV 数据
 *   .txt / .md    → 文本内容
 *   .json         → JSON 数据
 *   .png / .jpg   → 图片（尝试读取，输出文件信息）
 *   .mp4 / .mov   → 视频（输出文件信息）
 *
 * 用法：
 *   node scripts/eyeScanner.js              # 列出所有文件
 *   node scripts/eyeScanner.js --full       # 完整内容（xlsx/csv/txt 全部展开）
 *   node scripts/eyeScanner.js --file xxx   # 只看指定文件
 */

const fs = require("fs-extra");
const path = require("path");
const os = require("os");

const EYE_DIR = path.join(os.homedir(), "Desktop", "claude的眼睛");

// ═══════════════════════════════════════════════════════════════
// Main scanner
// ═══════════════════════════════════════════════════════════════

async function scan(fullMode = false, targetFile = null) {
  if (!fs.existsSync(EYE_DIR)) {
    console.log(`❌ 文件夹不存在: ${EYE_DIR}`);
    console.log("   请先在桌面创建 'claude的眼睛' 文件夹");
    return;
  }

  const allFiles = await fs.readdir(EYE_DIR);
  const files = allFiles.filter((f) => !f.startsWith(".") && !f.startsWith("~"));

  if (files.length === 0) {
    console.log("👁️  文件夹是空的。把抖音/小红书导出的文件拖进来就行。");
    console.log(`   路径: ${EYE_DIR}`);
    return;
  }

  if (targetFile) {
    const match = files.find((f) => f.includes(targetFile));
    if (!match) {
      console.log(`❌ 未找到文件: ${targetFile}`);
      console.log(`   当前文件: ${files.join(", ")}`);
      return;
    }
    await processFile(match, true);
    return;
  }

  console.log("╔══════════════════════════════════════════╗");
  console.log("║       👁️  Claude 的眼睛 — 扫描报告      ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`\n📁 文件夹: ${EYE_DIR}`);
  console.log(`📊 文件数: ${files.length}\n`);

  const results = [];
  for (const file of files) {
    const result = await processFile(file, fullMode);
    results.push(result);
  }

  // ── Summary ──
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 扫描汇总");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const byType = {};
  for (const r of results) {
    byType[r.type] = (byType[r.type] || 0) + 1;
  }

  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count} 个`);
  }
  console.log(`\n💡 使用 --full 查看完整内容`);
  console.log(`💡 使用 --file <文件名> 聚焦单个文件`);
}

// ═══════════════════════════════════════════════════════════════
// File processor
// ═══════════════════════════════════════════════════════════════

async function processFile(filename, fullMode) {
  const filePath = path.join(EYE_DIR, filename);
  const stat = await fs.stat(filePath);
  const ext = path.extname(filename).toLowerCase();

  const result = {
    file: filename,
    type: "unknown",
    size: formatSize(stat.size),
    modified: stat.mtime.toISOString(),
    data: null,
    error: null,
  };

  console.log(`━━━ ${filename} (${result.size}) ━━━`);

  try {
    switch (ext) {
      case ".xlsx":
      case ".xls":
        result.type = "excel";
        result.data = await readExcel(filePath, fullMode);
        break;

      case ".csv":
        result.type = "csv";
        result.data = await readCSV(filePath, fullMode);
        break;

      case ".txt":
      case ".md":
        result.type = "text";
        result.data = await readText(filePath, fullMode);
        break;

      case ".json":
        result.type = "json";
        result.data = await readJSON(filePath, fullMode);
        break;

      case ".png":
      case ".jpg":
      case ".jpeg":
      case ".gif":
      case ".webp":
        result.type = "image";
        result.data = await readImageInfo(filePath, fullMode);
        break;

      case ".mp4":
      case ".mov":
      case ".avi":
        result.type = "video";
        result.data = await readVideoInfo(filePath);
        break;

      default:
        result.type = "other";
        console.log(`  ℹ️ 未知格式，无法解析内容`);
        console.log(`     文件大小: ${result.size}`);
    }
  } catch (e) {
    result.error = e.message;
    console.log(`  ❌ 读取失败: ${e.message}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Excel reader
// ═══════════════════════════════════════════════════════════════

function readExcel(filePath, fullMode) {
  const XLSX = require("xlsx");
  const workbook = XLSX.readFile(filePath);

  const result = {
    sheets: workbook.SheetNames,
    sheetData: {},
    summary: {},
  };

  console.log(`  📊 Excel 工作簿: ${workbook.SheetNames.length} 个工作表`);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const rows = jsonData.length;
    const cols = jsonData.length > 0 ? Object.keys(jsonData[0]).length : 0;

    console.log(`\n  ── ${sheetName} (${rows}行 × ${cols}列) ──`);

    // Column headers
    if (cols > 0) {
      console.log(`  列名: ${Object.keys(jsonData[0]).join(" | ")}`);
    }

    // Data sample
    const displayRows = fullMode ? rows : Math.min(10, rows);
    console.log(`  数据 (前${displayRows}行):`);

    for (let i = 0; i < displayRows; i++) {
      const row = jsonData[i];
      const values = Object.values(row).map((v) => String(v).slice(0, 40));
      console.log(`    [${i + 1}] ${values.join(" | ")}`);
    }

    if (!fullMode && rows > 10) {
      console.log(`    ... (还有 ${rows - 10} 行，使用 --full 查看全部)`);
    }

    // Numeric column stats
    if (rows > 0) {
      const numericCols = {};
      for (const [key, val] of Object.entries(jsonData[0])) {
        if (typeof val === "number") numericCols[key] = [];
      }
      if (Object.keys(numericCols).length > 0) {
        for (const row of jsonData) {
          for (const key of Object.keys(numericCols)) {
            if (typeof row[key] === "number") numericCols[key].push(row[key]);
          }
        }
        console.log(`\n  📈 数值列统计:`);
        for (const [key, vals] of Object.entries(numericCols)) {
          const sum = vals.reduce((a, b) => a + b, 0);
          const avg = sum / vals.length;
          const max = Math.max(...vals);
          const min = Math.min(...vals);
          console.log(`     ${key}: 合计=${sum.toFixed(1)}  均值=${avg.toFixed(1)}  最大=${max}  最小=${min}`);
        }
      }
    }

    result.sheetData[sheetName] = {
      rows,
      cols,
      headers: jsonData.length > 0 ? Object.keys(jsonData[0]) : [],
      sample: jsonData.slice(0, fullMode ? rows : 10),
    };
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// CSV reader
// ═══════════════════════════════════════════════════════════════

async function readCSV(filePath, fullMode) {
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split("\n").filter((l) => l.trim());
  const headers = lines[0]?.split(",").map((h) => h.trim()) || [];

  console.log(`  📄 CSV: ${lines.length} 行 × ${headers.length} 列`);
  console.log(`  列名: ${headers.join(" | ")}`);

  const displayLines = fullMode ? lines.length : Math.min(15, lines.length);
  for (let i = 0; i < displayLines; i++) {
    console.log(`  [${i}] ${lines[i].slice(0, 120)}`);
  }

  if (!fullMode && lines.length > 15) {
    console.log(`  ... (还有 ${lines.length - 15} 行)`);
  }

  return { rows: lines.length, cols: headers.length, headers, lines: lines.slice(0, fullMode ? lines.length : 15) };
}

// ═══════════════════════════════════════════════════════════════
// Text reader
// ═══════════════════════════════════════════════════════════════

async function readText(filePath, fullMode) {
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split("\n");

  console.log(`  📝 文本: ${content.length} 字符, ${lines.length} 行`);

  if (fullMode) {
    console.log(content);
  } else {
    // Show first 30 lines
    const preview = lines.slice(0, 30).join("\n");
    console.log(preview);
    if (lines.length > 30) {
      console.log(`  ... (还有 ${lines.length - 30} 行，使用 --full 查看全部)`);
    }
  }

  return { chars: content.length, lines: lines.length, content: fullMode ? content : lines.slice(0, 30).join("\n") };
}

// ═══════════════════════════════════════════════════════════════
// JSON reader
// ═══════════════════════════════════════════════════════════════

async function readJSON(filePath, fullMode) {
  const data = await fs.readJson(filePath);
  const keys = Object.keys(data);

  console.log(`  📋 JSON: ${keys.length} 个顶层键`);
  console.log(`  键名: ${keys.join(", ")}`);

  if (fullMode) {
    const str = JSON.stringify(data, null, 2);
    const preview = str.slice(0, 2000);
    console.log(preview);
    if (str.length > 2000) {
      console.log(`  ... (JSON 总长 ${str.length} 字符)`);
    }
  } else {
    // Show first level summary
    for (const key of keys.slice(0, 10)) {
      const val = data[key];
      const type = Array.isArray(val) ? `Array(${val.length})` : typeof val;
      const preview = typeof val === "string" ? val.slice(0, 60) : type;
      console.log(`  ${key}: ${preview}`);
    }
  }

  return { keys, data: fullMode ? data : null };
}

// ═══════════════════════════════════════════════════════════════
// Image info + pixel analysis
// ═══════════════════════════════════════════════════════════════

async function readImageInfo(filePath, fullMode = false) {
  const stat = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();

  let dimensions = "未知";
  let pixelReport = null;
  let ocrText = null;

  try {
    if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
      // ── OCR: extract actual text from image ──
      try {
        const { createWorker } = require("tesseract.js");
        console.log("  🔍 正在 OCR 识别文字...");
        const worker = await createWorker("chi_sim+eng", 1, {
          logger: (m) => {
            if (m.status === "recognizing text") {
              process.stdout.write(`\r  🔍 OCR 进度: ${Math.round(m.progress * 100)}%`);
            }
          },
        });
        const { data } = await worker.recognize(filePath);
        await worker.terminate();
        ocrText = data.text.trim();
        console.log(`\r  🔍 OCR 完成: ${ocrText.length} 字符识别成功`);
      } catch (ocrErr) {
        console.log(`  ⚠️ OCR 失败: ${ocrErr.message}`);
      }

      // ── Pixel analysis ──
      if (ext === ".png") {
        const { PNG } = require("pngjs");
        const buf = await fs.readFile(filePath);
        const png = PNG.sync.read(buf);
        dimensions = `${png.width}×${png.height}`;
        pixelReport = analyzePixels(png);
      }
    } else {
      // JPEG / other — basic header parsing only
      const buf = await fs.readFile(filePath);
      if (buf[0] === 0xFF && buf[1] === 0xD8) {
        let i = 2;
        while (i < buf.length - 9) {
          if (buf[i] === 0xFF) {
            const marker = buf[i + 1];
            if (marker === 0xC0 || marker === 0xC2) {
              const h = buf.readUInt16BE(i + 5);
              const w = buf.readUInt16BE(i + 7);
              dimensions = `${w}×${h}`;
              break;
            }
            i += 2 + buf.readUInt16BE(i + 2);
          } else { i++; }
        }
      }
    }
  } catch (e) {
    pixelReport = { error: e.message };
  }

  console.log(`  🖼️  图片: ${dimensions} | ${formatSize(stat.size)}`);

  if (ocrText) {
    console.log(`  ━━━ OCR 识别文字 ━━━`);
    // Print OCR text with line limit
    const lines = ocrText.split("\n").filter((l) => l.trim());
    const maxLines = fullMode ? lines.length : Math.min(40, lines.length);
    for (let i = 0; i < maxLines; i++) {
      console.log(`  ${lines[i].trim()}`);
    }
    if (!fullMode && lines.length > 40) {
      console.log(`  ... (还有 ${lines.length - 40} 行，使用 --full 查看全部)`);
    }
    console.log(`  ━━━━━━━━━━━━━━━━━━`);
  }

  if (pixelReport && !pixelReport.error) {
    console.log(`  🎨 主色调: ${pixelReport.dominantColors || "未知"}`);
    console.log(`  📐 布局: ${pixelReport.layoutType || "未知"}`);
    if (pixelReport.textRegions > 0) {
      console.log(`  📝 检测到 ${pixelReport.textRegions} 个文字区域`);
      console.log(`     文字占比: ${pixelReport.textCoverage}%`);
    }
    if (pixelReport.isScreenshot) {
      console.log(`  📱 类型: 截图 (${pixelReport.screenType || "未知"})`);
    }
  }

  return { dimensions, size: stat.size, modified: stat.mtime.toISOString(), pixelReport };
}

/**
 * Analyze PNG pixels to understand image structure.
 * No OCR — just color/layout/text-region detection.
 */
function analyzePixels(png) {
  const { width, height, data } = png; // data = RGBA array

  // ── 1. Dominant color detection ──
  const colorBuckets = {};
  const sampleStep = 10; // Every 10th pixel for performance

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Quantize to 32 levels
      const qr = Math.round(r / 32) * 32;
      const qg = Math.round(g / 32) * 32;
      const qb = Math.round(b / 32) * 32;
      const key = `${qr},${qg},${qb}`;
      colorBuckets[key] = (colorBuckets[key] || 0) + 1;
    }
  }

  // Top 5 colors
  const topColors = Object.entries(colorBuckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => {
      const [r, g, b] = key.split(",").map(Number);
      return `rgb(${r},${g},${b})`;
    });

  // ── 2. Text region detection ──
  // Text areas have: high contrast edges, mostly grayscale, smaller regions
  const regions = [];
  const visited = new Set();
  const regionSampleStep = 20;

  for (let y = 0; y < height; y += regionSampleStep) {
    for (let x = 0; x < width; x += regionSampleStep) {
      const key = `${x},${y}`;
      if (visited.has(key)) continue;

      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

      // Skip very dark or very light background pixels
      if (brightness < 20 || brightness > 240) continue;

      visited.add(key);
      regions.push({ x, y, brightness });
    }
  }

  // Count text-like regions (medium brightness = likely text on bg)
  const textRegions = regions.filter((r) => r.brightness > 30 && r.brightness < 220);

  // ── 3. Layout type detection ──
  const aspectRatio = width / height;
  let layoutType = "未知";
  let screenType = "未知";

  if (aspectRatio > 2.5) {
    layoutType = "宽横幅";
  } else if (aspectRatio > 1.5) {
    layoutType = "横屏";
  } else if (aspectRatio > 0.8) {
    layoutType = "接近正方形";
  } else {
    layoutType = "竖屏/手机截图";
  }

  // Detect if it's likely a phone screenshot (9:16 or similar)
  if (aspectRatio > 0.4 && aspectRatio < 0.7) {
    screenType = "手机竖屏截图（可能是小红书/抖音）";
  } else if (aspectRatio > 1.5 && aspectRatio < 2.5) {
    screenType = "桌面截图";
  }

  // ── 4. Is it a screenshot? ──
  // Screenshots typically have: white/light dominant + rectangular blocks
  const isScreenshot = topColors.some((c) =>
    c.includes("rgb(224,") || c.includes("rgb(240,") || c.includes("rgb(255,") ||
    c.includes("rgb(32,32") || c.includes("rgb(0,0,0"),
  );

  // ── 5. Text coverage estimate ──
  const textCoverage = regions.length > 0
    ? Math.round((textRegions.length / regions.length) * 100)
    : 0;

  return {
    dominantColors: topColors.slice(0, 3).join(", "),
    layoutType,
    screenType,
    textRegions: textRegions.length,
    totalRegions: regions.length,
    textCoverage,
    isScreenshot,
    aspectRatio: aspectRatio.toFixed(2),
    resolution: `${width}×${height}`,
  };
}

// ═══════════════════════════════════════════════════════════════
// Video info
// ═══════════════════════════════════════════════════════════════

async function readVideoInfo(filePath) {
  const stat = await fs.stat(filePath);

  console.log(`  🎬 视频: ${formatSize(stat.size)}`);
  console.log(`     修改时间: ${stat.mtime.toISOString()}`);
  console.log(`     ℹ️ 视频内容无法直接解析，但 Claude 可以看到文件存在`);

  return { size: stat.size, modified: stat.mtime.toISOString() };
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

(async function main() {
  const args = process.argv.slice(2);
  const fullMode = args.includes("--full");
  const fileIdx = args.indexOf("--file");
  const targetFile = fileIdx >= 0 ? args[fileIdx + 1] : null;

  await scan(fullMode, targetFile);
})().catch((err) => {
  console.error("❌ 扫描失败:", err.message);
  process.exit(1);
});
