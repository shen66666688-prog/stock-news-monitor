/* eslint-disable no-console */
/**
 * kuaJingPoster.js — 跨境电商行业海报硬编码注入脚本 (空转测试)
 *
 * 绕过数据抓取和 DeepSeek API，直接使用硬编码的跨境数据结构，
 * 注入原有的黑金视觉海报渲染流程，输出 P1-P4 四张封面 PNG。
 *
 * Usage: node scripts/kuaJingPoster.js
 */

const fs = require("fs-extra");
const path = require("path");
const { renderSlideSet, closeBrowser } = require("./screenshotService");

// ═══════════════════════════════════════════════════════════════
// Hardcoded 跨境电商 data
// ═══════════════════════════════════════════════════════════════
const DATA = {
  title: "持有特斯拉的人，最近都在纠结什么？",
  subTitle: "现价 $391 | 市值 1.47万亿 | 静态PE 358倍",
  p1_metrics: [
    { label: "FSD进度", status: "V15未到，奥斯汀仅20辆无人车，Waymo有577辆", color: "red", value: 30 },
    { label: "Robotaxi", status: "全域覆盖官宣，但投运规模是Waymo的1/28", color: "orange", value: 35 },
    { label: "毛利率", status: "环比改善，Cybertruck亏损收窄，但CapEx在吞噬", color: "green", value: 65 },
    { label: "交付量", status: "Q1略低于预期，中国FSD入华能否拉动需求待观察", color: "gray", value: 50 },
  ],
  p2_stance: "市场已经开始讲2030年的故事，但2026年的账还没算清楚。",
  p2_checks: [
    { label: "核心逻辑", status: "Robotaxi进入运营阶段，但规模太小，商业模型未验证", icon: "⚠️" },
    { label: "安全边际", status: "$391 × 358倍PE，买的是2030年的特斯拉，不是2026年的", icon: "❌" },
    { label: "短期催化", status: "FSD入华是好事，但落地速度和本地化效果未知", icon: "⚠️" },
    { label: "中长期趋势", status: "市场越来越愿意用AI公司的逻辑给特斯拉估值，但Robotaxi商业化仍需要验证", icon: "✅" },
  ],
  p3_questions: [
    {
      q: "FSD入华能拉动多少交付量？",
      a: "中国市场辅助驾驶竞争白热化，小鹏/华为/理想已大量上路。FSD进中国是补齐短板，不是建立壁垒。对交付的拉动，短期可能不如预期。",
    },
    {
      q: "Robotaxi的商业模型到底能不能跑通？",
      a: "奥斯汀20辆 vs Waymo 577辆——不在一个量级。特斯拉的逻辑是低成本硬件规模化摊薄，但前提是FSD达到L4。Robotaxi运营时间仍然较短，目前公开数据有限，安全性和规模化能力还需要时间验证。",
    },
    {
      q: "毛利率回升是可持续的，还是会计反弹？",
      a: "Q1改善来自原料降价+Cybertruck上量。但全年CapEx超$250亿，下半年负自由现金流几乎确定。毛利率改善被资本开支吞噬，这是当前最核心的矛盾。",
    },
  ],
  p4_actions: {
    do: [
      "关注FSD V15推送节点——比Q2交付数据更影响长期逻辑",
      "跟踪Robotaxi月度运营数据（里程、车队规模、事故率）",
      "留意FSD中国用户反馈——检验泛化能力最真实的样本",
    ],
    dont: [
      "JPMorgan翻多了所以应该没问题——翻多不等于看好，是Neutral不是Buy",
      "马斯克说了Robotaxi会很大——他说过很多没按时间表兑现的事",
      "PE高是因为特斯拉是AI公司——这个叙事正在被定价，不是免费午餐",
    ],
  },
  footer: "数据来源：特斯拉Q1财报 + Reuters + Washington Post + JPMorgan研报 · 个人记录",
};

// ═══════════════════════════════════════════════════════════════
// Accent & theme
// ═══════════════════════════════════════════════════════════════
const ACCENT = "#D4A843"; // 黑金风格主色

// ═══════════════════════════════════════════════════════════════
// Color helpers
// ═══════════════════════════════════════════════════════════════
function colorHex(c) {
  const map = {
    red: "#ef4444",
    orange: "#f59e0b",
    green: "#22c55e",
    gray: "#94a3b8",
  };
  return map[c] || "#94a3b8";
}

function colorLabel(c) {
  const map = { red: "严重过热", orange: "横盘整理", green: "逻辑成立", gray: "持续观察" };
  return map[c] || "待评估";
}

// ═══════════════════════════════════════════════════════════════
// Shared CSS foundation (matches ctrOptimizer dark theme)
// ═══════════════════════════════════════════════════════════════
function cssBase() {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1440px;overflow:hidden;position:relative;
  font-family:-apple-system,"PingFang SC","MiSans","Microsoft YaHei",sans-serif;
  font-weight:700;display:flex;flex-direction:column;justify-content:space-between;
  background:#080c12}
.bg-grid{position:absolute;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px);
  background-size:72px 72px}
.bg-glow{position:absolute;width:600px;height:600px;border-radius:50%;
  background:radial-gradient(circle at center,${ACCENT}12 0%,transparent 70%);
  top:10%;left:50%;transform:translate(-50%,0);filter:blur(90px);pointer-events:none;z-index:0}
`.replace(/\n/g, " ");
}

// ═══════════════════════════════════════════════════════════════
// Title font calculator (match existing logic)
// ═══════════════════════════════════════════════════════════════
function calcTitleFont(title, maxWidth, maxSize) {
  const cjkRe = /[一-鿿]/g;
  const cjk = (title.match(cjkRe) || []).length;
  const ascii = title.length - cjk;
  const estWidth = cjk * 1.0 + ascii * 0.55;
  return Math.floor(Math.min(maxSize, maxWidth / Math.max(estWidth, 1)) * 0.95);
}

// ═══════════════════════════════════════════════════════════════
// P1 — 数据仪表盘 (Data Dashboard)
// ═══════════════════════════════════════════════════════════════
function buildP1(data) {
  const { title, subTitle, p1_metrics, footer } = data;
  const fs2 = calcTitleFont(title, 880, 88);

  const rows = p1_metrics.map((m) => {
    const hex = colorHex(m.color);
    const valLabel = colorLabel(m.color);
    const iconMap = { red: "🔴", orange: "🟠", green: "🟢", gray: "⚪" };
    const icon = iconMap[m.color] || "⚪";
    return `
    <div class="drow">
      <div class="dicon">${icon}</div>
      <div class="dlabel">${m.label}</div>
      <div class="dbar-wrap"><div class="dbar-fill" style="width:${m.value}%;background:${hex}"></div></div>
      <div class="dval" style="color:${hex}">${valLabel}</div>
      <div class="ddetail">${m.status}</div>
    </div>`;
  }).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.title-block{position:relative;z-index:2;padding:90px 72px 0;text-align:left}
.title-tag{display:inline-block;padding:8px 24px;border:1px solid ${ACCENT}55;border-radius:6px;
  font-size:24px;font-weight:700;color:${ACCENT};letter-spacing:4px;margin-bottom:24px}
.title-main{font-size:${fs2}px;font-weight:900;line-height:1.08;color:#fff;letter-spacing:1px;
  text-shadow:0 0 60px ${ACCENT}33;max-width:920px}
.title-sub{font-size:36px;font-weight:700;color:rgba(255,255,255,0.55);margin-top:16px;letter-spacing:1px}
.title-bar{width:80px;height:4px;background:${ACCENT};margin-top:28px;border-radius:2px;opacity:0.7}

.dash{position:relative;z-index:2;padding:28px 72px 0;display:flex;flex-direction:column;gap:14px}
.drow{display:flex;align-items:center;gap:16px;padding:26px 28px;
  background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);
  border-radius:14px;border-left:3px solid ${ACCENT}44}
.dicon{font-size:34px;min-width:48px;text-align:center}
.dlabel{font-size:28px;font-weight:700;color:rgba(255,255,255,0.85);min-width:150px}
.dbar-wrap{flex:1;height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden}
.dbar-fill{height:100%;border-radius:4px;transition:width 0.3s}
.dval{font-size:24px;font-weight:800;min-width:110px;text-align:right}
.ddetail{font-size:21px;color:rgba(255,255,255,0.4);min-width:240px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.footer-block{position:relative;z-index:2;padding:0 72px 80px}
.footer-tag{display:flex;align-items:center;gap:14px;padding:22px 36px;
  background:${ACCENT}0f;border:1px solid ${ACCENT}33;border-radius:16px}
.footer-dot{width:10px;height:10px;border-radius:50%;background:${ACCENT};box-shadow:0 0 10px ${ACCENT}66}
.footer-text{font-size:28px;font-weight:700;color:${ACCENT};letter-spacing:2px}
.footer-sub{font-size:22px;color:rgba(255,255,255,0.35);margin-left:auto}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="title-block">
  <div class="title-tag">特斯拉 · 投研诊断</div>
  <div class="title-main">${title}</div>
  <div class="title-sub">${subTitle}</div>
  <div class="title-bar"></div>
</div>
<div class="dash">${rows}</div>
<div class="footer-block">
  <div class="footer-tag">
    <span class="footer-dot"></span>
    <span class="footer-text">特斯拉 · 投研避坑指南</span>
    <span class="footer-sub">${footer}</span>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P2 — 多空诊断 (Verdict Scorecard)
// ═══════════════════════════════════════════════════════════════
function buildP2(data) {
  const { p2_stance, p2_checks, footer } = data;

  // Determine overall verdict
  const failCount = p2_checks.filter((c) => c.icon === "❌").length;
  const warnCount = p2_checks.filter((c) => c.icon === "⚠️").length;
  const passCount = p2_checks.filter((c) => c.icon === "✅").length;

  let verdictEmoji, verdictLabel, verdictSub;
  if (failCount >= 2) {
    verdictEmoji = "🔴"; verdictLabel = "防御观望"; verdictSub = "核心逻辑受损严重，多看少动";
  } else if (warnCount >= 2 || failCount >= 1) {
    verdictEmoji = "🟡"; verdictLabel = "谨慎观察"; verdictSub = "部分逻辑存疑，等待信号确认";
  } else {
    verdictEmoji = "🟢"; verdictLabel = "逻辑成立"; verdictSub = "多头逻辑占优，可适度参与";
  }

  const rows = p2_checks.map((item, i) => `
    <div class="sc-row">
      <div class="sc-num">${["①","②","③","④"][i]}</div>
      <div class="sc-label">${item.label}</div>
      <div class="sc-status">${item.icon}</div>
      <div class="sc-detail">${item.status}</div>
    </div>`).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.verdict-top{position:relative;z-index:2;padding:120px 72px 0;display:flex;align-items:center;gap:24px}
.verdict-emoji{font-size:72px}
.verdict-text{font-size:64px;font-weight:900;color:#fff;letter-spacing:1px}
.verdict-sub{font-size:30px;color:rgba(255,255,255,0.45);margin-top:12px;padding-left:96px;position:relative;z-index:2}

.scorecard{position:relative;z-index:2;padding:48px 72px 0;display:flex;flex-direction:column;gap:12px}
.sc-row{display:flex;align-items:center;gap:20px;padding:28px 32px;
  background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);
  border-radius:14px}
.sc-num{font-size:32px;font-weight:800;color:${ACCENT};min-width:44px}
.sc-label{font-size:30px;font-weight:700;color:rgba(255,255,255,0.85);min-width:200px}
.sc-status{font-size:36px;min-width:60px;text-align:center}
.sc-detail{font-size:26px;color:rgba(255,255,255,0.5);flex:1}

.one-liner{position:relative;z-index:2;padding:48px 72px 120px}
.one-liner-box{display:flex;align-items:center;gap:16px;padding:28px 36px;
  border:1px solid ${ACCENT}44;border-radius:16px;background:${ACCENT}08}
.one-liner-icon{font-size:36px}
.one-liner-text{font-size:34px;font-weight:700;color:#fff}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="verdict-top">
  <div class="verdict-emoji">${verdictEmoji}</div>
  <div class="verdict-text">${verdictLabel}</div>
</div>
<div class="verdict-sub">${verdictSub}</div>
<div class="scorecard">${rows}</div>
<div class="one-liner">
  <div class="one-liner-box">
    <span class="one-liner-icon">💡</span>
    <span class="one-liner-text">一句话：${p2_stance}</span>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P3 — 深度拆解 (Deep Dive Q&A Cards)
// ═══════════════════════════════════════════════════════════════
function buildP3(data) {
  const { p3_questions, footer } = data;

  const cards = p3_questions.map((qa, i) => `
    <div class="card">
      <div class="card-q">${qa.q}</div>
      <div class="card-a">${qa.a}</div>
      <div class="card-bar"><div class="card-bar-fill" style="width:${90 - i * 15}%;background:${ACCENT}"></div></div>
      <div class="card-verdict" style="color:${i < 2 ? "#22c55e" : "#f59e0b"}">${i < 2 ? "信号偏积极" : "需要警惕"}</div>
    </div>`).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.section-head{position:relative;z-index:2;padding:100px 72px 0}
.section-tag{display:inline-block;padding:8px 24px;border:1px solid ${ACCENT}55;border-radius:6px;
  font-size:24px;font-weight:700;color:${ACCENT};letter-spacing:4px;margin-bottom:20px}
.section-title{font-size:52px;font-weight:900;color:#fff;letter-spacing:1px}

.cards{position:relative;z-index:2;padding:32px 72px 0;display:flex;flex-direction:column;gap:16px}
.card{padding:36px 36px;background:rgba(255,255,255,0.025);
  border:1px solid rgba(255,255,255,0.05);border-radius:18px;border-left:4px solid ${ACCENT}55}
.card-q{font-size:36px;font-weight:800;color:#fff;margin-bottom:14px}
.card-a{font-size:30px;font-weight:600;color:rgba(255,255,255,0.7);line-height:1.45;margin-bottom:20px}
.card-bar{height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:12px}
.card-bar-fill{height:100%;border-radius:3px}
.card-verdict{font-size:26px;font-weight:700}

.bottom-note{position:relative;z-index:2;padding:32px 72px 100px;
  font-size:26px;color:rgba(255,255,255,0.3);text-align:center}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="section-head">
  <div class="section-tag">特斯拉 · 深度拆解</div>
  <div class="section-title">3个关键问题</div>
</div>
<div class="cards">${cards}</div>
<div class="bottom-note">${footer}</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P4 — 操作指南 (Action Guide)
// ═══════════════════════════════════════════════════════════════
function buildP4(data) {
  const { p4_actions, footer } = data;

  const doHtml = p4_actions.do.map((d) =>
    `<div class="guide-row do"><span class="guide-icon">✅</span><span>${d}</span></div>`
  ).join("");

  const dontHtml = p4_actions.dont.map((d) =>
    `<div class="guide-row dont"><span class="guide-icon">❌</span><span>${d}</span></div>`
  ).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.guide-top{position:relative;z-index:2;padding:100px 72px 0}
.guide-tag{display:inline-block;padding:8px 24px;border:1px solid ${ACCENT}55;border-radius:6px;
  font-size:24px;font-weight:700;color:${ACCENT};letter-spacing:4px;margin-bottom:20px}
.guide-title{font-size:52px;font-weight:900;color:#fff;letter-spacing:1px}

.guide-section{position:relative;z-index:2;padding:36px 72px 0}
.guide-section-title{font-size:32px;font-weight:800;color:${ACCENT};margin-bottom:16px;letter-spacing:2px}
.guide-row{display:flex;align-items:center;gap:16px;padding:22px 28px;
  margin-bottom:10px;border-radius:12px;font-size:30px;font-weight:600;line-height:1.4}
.guide-row.do{background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.12);color:rgba(255,255,255,0.82)}
.guide-row.dont{background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.12);color:rgba(255,255,255,0.82)}
.guide-icon{font-size:32px;min-width:48px;text-align:center}

.poll{position:relative;z-index:2;padding:36px 72px 100px}
.poll-q{font-size:40px;font-weight:800;color:#fff;text-align:center;margin-bottom:28px}
.poll-btns{display:flex;gap:24px;justify-content:center}
.poll-btn{flex:1;max-width:380px;padding:28px 0;text-align:center;
  border:2px solid ${ACCENT}55;border-radius:18px;font-size:32px;font-weight:700;
  color:#fff;background:${ACCENT}08}
.poll-cta{text-align:center;margin-top:24px;font-size:28px;color:rgba(255,255,255,0.3)}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="guide-top">
  <div class="guide-tag">特斯拉 · 操作指南</div>
  <div class="guide-title">避坑 & 行动清单</div>
</div>
<div class="guide-section">
  <div class="guide-section-title">📊 胜率较高的策略</div>
  ${doHtml}
</div>
<div class="guide-section">
  <div class="guide-section-title">⚠️ 常见的亏损来源</div>
  ${dontHtml}
</div>
<div class="poll">
  <div class="poll-q">Robotaxi会成为特斯拉第二增长曲线吗？</div>
  <div class="poll-btns">
    <div class="poll-btn">🛡️ Robotaxi被吹过头了</div>
    <div class="poll-btn">💎 5年后回头看，现在还是太便宜</div>
  </div>
  <div class="poll-cta">评论区聊聊你的看法</div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════
(async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  特斯拉 TSLA 投研海报渲染             ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log("📋 数据来源: 特斯拉Q1财报 + 2026年6月最新新闻");
  console.log("🎨 视觉风格: 黑金主题 (Bloomberg × 小红书)");
  console.log("🖥️  渲染引擎: Puppeteer (deviceScaleFactor:2)\n");

  const OUT_DIR = path.join(process.cwd(), "covers", "TSLA_20260607");
  await fs.ensureDir(OUT_DIR);

  const slides = {
    p1: { html: buildP1(DATA) },
    p2: { html: buildP2(DATA) },
    p3: { html: buildP3(DATA) },
    p4: { html: buildP4(DATA) },
  };

  console.log("🎨 开始渲染 4 张特斯拉投研海报…\n");
  const results = await renderSlideSet("TSLA", slides, OUT_DIR);

  console.log("\n──────────────────────────────────────");
  let successCount = 0;
  for (const r of results) {
    if (!r.error) {
      console.log(`✅ ${r.name}  (${r.sizeKB} KB)  →  ${r.path}`);
      successCount++;
    } else {
      console.log(`❌ ${r.name}  失败: ${r.error}`);
    }
  }
  console.log("──────────────────────────────────────");

  // Also save the structured data for reference
  const jsonPath = path.join(OUT_DIR, "kuaJing_data.json");
  await fs.writeJson(jsonPath, DATA, { spaces: 2 });
  console.log(`📋 数据结构已保存: ${jsonPath}`);

  await closeBrowser();

  console.log(`\n🎉 渲染完成: ${successCount}/4 张海报已生成`);
  console.log(`📁 输出目录: ${OUT_DIR}\n`);
})().catch((err) => {
  console.error("❌ 渲染失败:", err);
  process.exit(1);
});
