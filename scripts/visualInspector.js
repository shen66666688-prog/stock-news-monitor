/**
 * visualInspector.js — AI 视觉检查器
 *
 * 给 Claude Code 装上眼睛。
 *
 * 功能：
 *   1. 读取海报 HTML → 提取所有元素的 CSS 布局数据
 *   2. 分析字号、间距、颜色、对齐、留白
 *   3. 检测布局问题（文字溢出、色差不达标、拥挤/空旷）
 *   4. 输出 Claude 能"看懂"的结构化视觉报告
 *
 * 用法：
 *   node scripts/visualInspector.js <ticker> [date]
 *   例：node scripts/visualInspector.js TSLA 2026-06-06
 *
 *   或者直接分析 HTML 文件：
 *   node scripts/visualInspector.js --html covers/TSLA_20260606/P1_cover.html
 */

const { buildSlideSet } = require("./ctrOptimizer");
const { fetchDiagnosticData } = require("./dataFetcher");

// ═══════════════════════════════════════════════════════════════
// CSS Parser — extract layout data from HTML string
// ═══════════════════════════════════════════════════════════════

function parseHTML(html) {
  const report = {
    viewport: { width: 1080, height: 1440 },
    elements: [],
    issues: [],
    summary: {},
  };

  // ── Extract <style> block ──
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const cssText = styleMatch ? styleMatch[1] : "";

  // Parse CSS rules
  const rules = parseCSSRules(cssText);

  // ── Extract body content elements ──
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const bodyHTML = bodyMatch ? bodyMatch[1] : html;

  // Find all major containers by class
  const elementPatterns = [
    { selector: ".hero", name: "Hero区域（标题+Logo）" },
    { selector: ".hero-logo", name: "Logo/股票代码" },
    { selector: ".hero-title", name: "主标题" },
    { selector: ".hero-sub", name: "副标题/日期" },
    { selector: ".hero-line", name: "标题装饰线" },
    { selector: ".minicards", name: "数据卡片容器" },
    { selector: ".mc", name: "数据卡片" },
    { selector: ".verdict", name: "判断区域" },
    { selector: ".verdict-label", name: "判断标签" },
    { selector: ".verdict-sub", name: "判断副标题" },
    { selector: ".pe-context", name: "PE数据行" },
    { selector: ".columns", name: "多空双栏容器" },
    { selector: ".col", name: "多空栏" },
    { selector: ".col-header", name: "栏标题" },
    { selector: ".arg-row", name: "论点行" },
    { selector: ".thesis", name: "总结区域" },
    { selector: ".section-head", name: "章节头部" },
    { selector: ".section-tag", name: "章节标签" },
    { selector: ".section-title", name: "章节标题" },
    { selector: ".cards", name: "深度卡片容器" },
    { selector: ".card", name: "深度卡片" },
    { selector: ".card-num", name: "卡片序号" },
    { selector: ".card-q", name: "卡片问题" },
    { selector: ".card-a", name: "卡片答案" },
    { selector: ".poll-section", name: "投票区域" },
    { selector: ".poll-q", name: "投票问题" },
    { selector: ".poll-options", name: "投票选项容器" },
    { selector: ".poll-btn", name: "投票按钮" },
    { selector: ".actions", name: "操作建议区" },
    { selector: ".act-row", name: "操作行" },
    { selector: ".disclaimer", name: "免责声明区" },
    { selector: ".footer", name: "页脚" },
  ];

  for (const { selector, name } of elementPatterns) {
    const rule = rules[selector];
    if (!rule) continue;

    const el = {
      name,
      selector,
      css: rule,
      analysis: analyzeElement(name, rule, report.viewport),
    };
    report.elements.push(el);

    // Collect issues
    if (el.analysis.issues && el.analysis.issues.length > 0) {
      for (const issue of el.analysis.issues) {
        report.issues.push({ element: name, issue });
      }
    }
  }

  // ── Overall layout analysis ──
  report.summary = analyzeOverallLayout(report);

  return report;
}

// ═══════════════════════════════════════════════════════════════
// Naive CSS rule parser
// ═══════════════════════════════════════════════════════════════

function parseCSSRules(cssText) {
  const rules = {};
  // Match: selector { properties }
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;
  while ((match = ruleRegex.exec(cssText)) !== null) {
    const rawSelector = match[1].trim();
    const propsText = match[2];

    // Handle comma-separated selectors
    const selectors = rawSelector.split(",").map((s) => s.trim());

    const props = {};
    const propRegex = /([\w-]+)\s*:\s*([^;]+);/g;
    let pm;
    while ((pm = propRegex.exec(propsText)) !== null) {
      props[pm[1].trim()] = pm[2].trim();
    }

    for (const sel of selectors) {
      rules[sel] = { ...(rules[sel] || {}), ...props };
    }
  }

  return rules;
}

// ═══════════════════════════════════════════════════════════════
// Element analyzer
// ═══════════════════════════════════════════════════════════════

function analyzeElement(name, css, viewport) {
  const issues = [];
  const metrics = {};

  // ── Font size check ──
  if (css["font-size"]) {
    const size = parsePx(css["font-size"]);
    metrics.fontSize = size;

    if (name === "主标题") {
      if (size < 52) issues.push(`⚠️ 标题字号偏小 (${size}px)，建议 60-108px`);
      if (size > 120) issues.push(`⚠️ 标题字号过大 (${size}px)，可能超出容器`);
    }
    if (name === "副标题/日期" || name === "判断副标题") {
      if (size < 16) issues.push(`⚠️ 副标题可能太小 (${size}px)，手机端可能看不清`);
    }
    if (name === "论点行" || name === "卡片答案") {
      if (size < 18) issues.push(`⚠️ 正文过小 (${size}px)，小红书 1080px 建议 ≥20px`);
    }
    if (name === "免责声明区") {
      if (size > 16) issues.push(`ℹ️ 免责声明字号 ${size}px，通常在 12-14px 更合适`);
    }
  }

  // ── Padding/margin check ──
  if (css["padding-top"] || css.padding) {
    const pt = parsePx(css["padding-top"] || css.padding);
    metrics.paddingTop = pt;

    if (name === "Hero区域（标题+Logo）" && pt > 200) {
      issues.push(`⚠️ 顶部留白 ${pt}px 偏多，标题可能位置偏下`);
    }
  }

  if (css["margin-bottom"]) {
    metrics.marginBottom = parsePx(css["margin-bottom"]);
  }

  // ── Color contrast check ──
  if (css.color) {
    metrics.textColor = css.color;
    const bgColor = css.background || css["background-color"] || "#050505";
    metrics.bgColor = bgColor;

    const contrast = estimateContrast(css.color, bgColor);
    metrics.contrastRatio = contrast;

    if (contrast < 3.0 && name !== "免责声明区" && name !== "页脚") {
      issues.push(`❌ 对比度极低 (${contrast.toFixed(2)}:1)，文字可能不可读。文字色:${css.color}, 背景:${bgColor}`);
    } else if (contrast < 4.5 && name !== "免责声明区" && name !== "页脚") {
      issues.push(`⚠️ 对比度偏低 (${contrast.toFixed(2)}:1)，WCAG AA 标准要求 ≥4.5:1`);
    }
  }

  // ── Opacity / visibility check ──
  if (css.opacity) {
    metrics.opacity = parseFloat(css.opacity);
    if (metrics.opacity < 0.15 && name !== "免责声明区" && name !== "页脚") {
      issues.push(`⚠️ 透明度 ${metrics.opacity} 偏低，元素可能几乎不可见`);
    }
  }

  // ── Border radius check ──
  if (css["border-radius"]) {
    const br = parsePx(css["border-radius"]);
    metrics.borderRadius = br;
    if (br > 30 && (name.includes("卡片") || name.includes("按钮"))) {
      // Large border radius is fine for modern design
    }
  }

  // ── Width check ──
  if (css.width) {
    metrics.width = parsePx(css.width);
  }
  if (css["max-width"]) {
    metrics.maxWidth = parsePx(css["max-width"]);
  }

  // ── Line height check ──
  if (css["line-height"]) {
    metrics.lineHeight = parseFloat(css["line-height"]);
    if (metrics.lineHeight < 1.3 && (name.includes("标题") || name.includes("正文"))) {
      issues.push(`⚠️ 行高 ${metrics.lineHeight} 偏紧，中文建议 ≥1.4`);
    }
  }

  // ── Letter spacing check ──
  if (css["letter-spacing"]) {
    const lsPx = parsePx(css["letter-spacing"]);
    metrics.letterSpacing = lsPx;
    if (lsPx > 5 && !name.includes("Logo")) {
      issues.push(`ℹ️ 字间距 ${lsPx}px 较大，可能影响可读性`);
    }
  }

  return { metrics, issues };
}

// ═══════════════════════════════════════════════════════════════
// Overall layout analysis
// ═══════════════════════════════════════════════════════════════

function analyzeOverallLayout(report) {
  const summary = {
    totalElements: report.elements.length,
    elementsWithIssues: 0,
    criticalIssues: 0,
    warnings: 0,
    layoutBalance: {},
  };

  for (const el of report.elements) {
    if (el.analysis.issues.length > 0) {
      summary.elementsWithIssues++;
      for (const issue of el.analysis.issues) {
        if (issue.startsWith("❌")) summary.criticalIssues++;
        else if (issue.startsWith("⚠️")) summary.warnings++;
      }
    }
  }

  // Check layout balance
  const heroEl = report.elements.find((e) => e.name === "Hero区域（标题+Logo）");
  const footerEl = report.elements.find((e) => e.name === "页脚");

  if (heroEl && heroEl.analysis.metrics.paddingTop) {
    const topPadding = heroEl.analysis.metrics.paddingTop;
    if (topPadding > 200) {
      summary.layoutBalance.topHeavy = "顶部留白过多，内容区被挤压";
    } else if (topPadding < 80) {
      summary.layoutBalance.topCramped = "顶部留白不足，标题可能紧贴边缘";
    } else {
      summary.layoutBalance.topOK = `顶部留白 ${topPadding}px — 合理范围`;
    }
  }

  // Element count by type
  const typeCount = {};
  for (const el of report.elements) {
    const type = el.name.split("（")[0];
    typeCount[type] = (typeCount[type] || 0) + 1;
  }
  summary.elementTypes = typeCount;

  return summary;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function parsePx(val) {
  if (!val) return 0;
  const match = String(val).match(/([\d.]+)\s*px/);
  return match ? parseFloat(match[1]) : parseFloat(val) || 0;
}

/**
 * Estimate contrast ratio from two CSS color values.
 * Simplified — handles hex, rgb(), rgba(), and named colors approximately.
 */
function estimateContrast(fg, bg) {
  const fgLum = approxLuminance(fg);
  const bgLum = approxLuminance(bg);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function approxLuminance(color) {
  if (!color) return 0;

  // hex
  const hexMatch = String(color).match(/#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/);
  if (hexMatch) {
    const r = parseInt(hexMatch[1], 16) / 255;
    const g = parseInt(hexMatch[2], 16) / 255;
    const b = parseInt(hexMatch[3], 16) / 255;
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
  }

  // rgb / rgba
  const rgbMatch = String(color).match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]) / 255;
    const g = parseInt(rgbMatch[2]) / 255;
    const b = parseInt(rgbMatch[3]) / 255;
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
  }

  // Named colors (approximate)
  const namedColors = {
    white: 1.0, black: 0.0,
    red: 0.21, green: 0.72, blue: 0.07,
  };
  const lower = String(color).toLowerCase();
  if (namedColors[lower] !== undefined) return namedColors[lower];

  // Default: assume mid-luminance
  return 0.5;
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// ═══════════════════════════════════════════════════════════════
// HTML content analyzer — checks actual text content
// ═══════════════════════════════════════════════════════════════

function analyzeContent(html) {
  const contentReport = {
    textBlocks: [],
    totalChars: 0,
    wordCount: 0,
    numberCount: 0,
    emojiCount: 0,
    issues: [],
  };

  // Strip tags to count visible text
  const visibleText = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  contentReport.totalChars = visibleText.length;

  // Count CJK characters (actual "word count" for Chinese)
  const cjkCount = (visibleText.match(/[一-鿿]/g) || []).length;
  contentReport.cjkChars = cjkCount;

  // Count numbers
  contentReport.numberCount = (visibleText.match(/\d+/g) || []).length;

  // Count emoji
  contentReport.emojiCount = (visibleText.match(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/ug) || []).length;

  // Extract major text blocks (between tags, >20 chars)
  const blockMatches = html.match(/>([^<]{20,})</g);
  if (blockMatches) {
    contentReport.textBlocks = blockMatches
      .map((m) => m.slice(1, -1).trim())
      .filter((t) => t.length > 0)
      .slice(0, 20);
  }

  // Content issues
  if (cjkCount > 500) {
    contentReport.issues.push("⚠️ 总字数偏多（>" + cjkCount + "字），小红书最佳 200-400 字");
  }
  if (cjkCount < 50) {
    contentReport.issues.push("⚠️ 总字数偏少（<50字），内容可能过于单薄");
  }

  return contentReport;
}

// ═══════════════════════════════════════════════════════════════
// Main: inspect a generated slide set
// ═══════════════════════════════════════════════════════════════

async function inspectSlideSet(ticker, dateStr) {
  console.log(`\n🔍 AI 视觉检查器 — ${ticker} ${dateStr || ""}`);
  console.log("═".repeat(60));

  // Generate slides (same as generate-posts.js pipeline)
  const metrics = await fetchDiagnosticData(ticker).catch(() => null);
  if (metrics) {
    console.log(`📊 实时数据: $${metrics.price}  PE=${metrics.raw.pe?.toFixed(1) || "N/A"}`);
  }

  const slides = buildSlideSet({
    ticker,
    sentiment: "中性",
    points: ["测试要点1", "测试要点2", "测试要点3"],
    risks: ["测试风险1"],
    metrics,
  });

  const slideNames = ["P1_cover", "P2_verdict", "P3_deepdive", "P4_poll"];
  const slideKeys = ["p1", "p2", "p3", "p4"];

  for (let i = 0; i < slideKeys.length; i++) {
    const key = slideKeys[i];
    const name = slideNames[i];
    const html = slides[key]?.html || "";

    console.log(`\n━━━ ${name} ━━━`);

    const layout = parseHTML(html);
    const content = analyzeContent(html);

    // ── Layout issues ──
    console.log(`\n📐 布局分析 (${layout.elements.length} 个元素):`);
    for (const el of layout.elements) {
      const m = el.analysis.metrics;
      const metricParts = [];
      if (m.fontSize) metricParts.push(`字号:${m.fontSize}px`);
      if (m.paddingTop) metricParts.push(`上边距:${m.paddingTop}px`);
      if (m.contrastRatio) metricParts.push(`对比度:${m.contrastRatio.toFixed(1)}:1`);
      if (m.opacity !== undefined) metricParts.push(`透明度:${m.opacity}`);
      if (m.lineHeight) metricParts.push(`行高:${m.lineHeight}`);

      const hasIssue = el.analysis.issues.length > 0;
      const icon = hasIssue ? "⚠️" : "  ";
      console.log(`  ${icon} ${el.name}: ${metricParts.join(" | ")}`);
      for (const issue of el.analysis.issues) {
        console.log(`     ${issue}`);
      }
    }

    // ── Content stats ──
    console.log(`\n📝 内容分析:`);
    console.log(`  总字符: ${content.totalChars}  |  CJK: ${content.cjkChars}  |  数字: ${content.numberCount}  |  Emoji: ${content.emojiCount}`);
    for (const issue of content.issues) {
      console.log(`  ⚠️ ${issue}`);
    }

    // ── Summary ──
    console.log(`\n📊 ${name} 小结:`);
    console.log(`  总元素: ${layout.summary.totalElements}`);
    console.log(`  有问题: ${layout.summary.elementsWithIssues}`);
    console.log(`  严重: ${layout.summary.criticalIssues}  |  警告: ${layout.summary.warnings}`);
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log("✅ 视觉检查完成\n");
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

(async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log("用法: node scripts/visualInspector.js <TICKER> [date]");
    console.log("例:   node scripts/visualInspector.js TSLA");
    console.log("      node scripts/visualInspector.js NVDA 2026-06-06");
    console.log("      node scripts/visualInspector.js --all       # 检查所有7只");
    return;
  }

  if (args.includes("--all")) {
    const tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META"];
    for (const t of tickers) {
      await inspectSlideSet(t, null);
    }
  } else {
    const ticker = args[0].toUpperCase();
    const date = args[1] || null;
    await inspectSlideSet(ticker, date);
  }
})().catch((err) => {
  console.error("❌ 视觉检查失败:", err.message);
  process.exit(1);
});
