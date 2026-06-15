/* eslint-disable no-console */
/**
 * aaplFullPoster.js — AAPL 投研海报 P1-P4
 *
 * Baseline: GOOGL 黑金仪表盘 (googlPoster.js) — 30%+ CTR 验证模板
 * 策略: 像素级克隆 GOOGL P1 结构 → 仅替换 AAPL 数据
 *
 * 禁止: 手机线框 / 抽象剪影 / 极简留白 / Apple发布会风
 */

const fs = require("fs-extra");
const path = require("path");
const { renderSlideSet, closeBrowser } = require("./screenshotService");

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ═══════════════════════════════════════
// AAPL Data
// ═══════════════════════════════════════
const AAPL = {
  ticker: "AAPL",
  name: "苹果",
  title: "苹果最大的危机，可能不是AI落后",
  subTitle: "现价 $245  |  市值 $3.72T  |  PE 33×  /  远期 28×",

  // P1: 4-row dashboard — EXACT googlPoster.js structure
  p1_metrics: [
    { label: "估值水位", status: "PE 33×，远期28×——在Mag 7中处于中位。但若AI逻辑被证伪，硬件公司估值对标是15-20×", color: "orange", value: 55 },
    { label: "AI 缺口",  status: "Apple Intelligence落后GPT-5约18个月。WWDC更新力度将决定差距是缩小还是扩大",               color: "red",    value: 30 },
    { label: "硬件底盘", status: "25亿活跃设备构成全球最大付费用户基础。服务收入年化$108B，但增速从14%降至7%",               color: "green",  value: 72 },
    { label: "换机周期", status: "iPhone换机周期从3.2年延长至4.2年。AI功能尚未证明能成为换机催化剂",                         color: "orange", value: 40 },
  ],

  // P2
  p2_stance: "苹果的核心问题不是AI技术落后，而是AI时代「硬件分发」这个护城河是否仍然有效。当AI服务可以通过任何设备访问时，25亿设备的生态壁垒可能从护城河变成围墙。",
  p2_checks: [
    { label: "核心逻辑", status: "25亿设备+$108B服务收入构建了深厚的护城河。但在AI时代，硬件分发的优势正在边际递减——用户可以通过任何设备使用AI服务。", icon: "⚠️" },
    { label: "安全边际", status: "PE 33×在Mag 7中不算极端。但若AI追赶失败且换机周期继续拉长，估值可能向硬件公司均值（15-20×）回归。", icon: "⚠️" },
    { label: "短期催化", status: "WWDC 2026 AI更新是近期最关键催化剂。Q3中国区指引和iPhone 17发布也将影响市场情绪。", icon: "⚠️" },
    { label: "中长期趋势", status: "Apple历史上多次「后发先至」——iPod、iPhone、Apple Watch都不是先发者。端侧AI对隐私和芯片集成度的要求恰好是Apple的强项。", icon: "✅" },
  ],

  // P3 — 精简答案，每个控制在3-4行以内
  p3_questions: [
    {
      q: "Apple Intelligence 落后 18 个月，窗口期还有多久？",
      a: "Apple 历史上多次后发先至——iPod、iPhone、Apple Watch 都不是先发者。端侧 AI 对隐私和芯片集成的要求恰好是 Apple 强项。但 AI 竞争范式已变：GPT-5 和 Gemini 以「月」为单位迭代，Apple Intelligence 以「年」为单位。WWDC 2026 更新力度是判断窗口期的最直接指标。",
    },
    {
      q: "中国市场：华为回归 + 本土品牌崛起，影响多大？",
      a: "中国区营收占比已从 25% 降至 18%，Q2 出货量同比 -8%，同期华为 +34%。高端市场（$800+）Apple 仍占 60%+，但消费者对「国产高端」的接受度正从「尝试」变成「习惯」。一旦品牌心智迁移完成，结构性影响比 AI 落后更值得警惕。",
    },
    {
      q: "服务增速放缓，第二曲线还能撑多久？",
      a: "服务收入年化 $108B，但增速从 14% 降至 7%。App Store 面临欧盟 DMA 和美国反垄断双重夹击——30% 抽成若被迫降至 15%，毛利将直接受损。服务是 Apple 估值中最被低估的部分，也是监管风险最集中的部分。",
    },
  ],

  // P4
  p4_actions: {
    do: [
      "跟踪 WWDC AI 功能落地节奏——验证 Apple AI 能力的最直接窗口",
      "关注 Services 毛利率——若 App Store 抽成下调，影响立即体现在财报",
      "监控中国区季度出货量——华为回归的冲击程度决定估值下限",
    ],
    dont: [
      "\"PE 33× 在 Mag 7 里不算贵所以安全\"——如果 AI 逻辑被证伪，硬件公司估值对标是 15-20×",
      "\"25 亿设备是无敌护城河\"——Nokia 在 2007 年也有 10 亿用户，Nokia 在 2007 年也有 10 亿用户",
      "\"Apple 历史上总是后发先至\"——AI 时代的竞争范式已经变了，历史不一定重演",
    ],
  },
  footer: "数据来源：Apple Q2 FY26 · Bloomberg · IDC · Counterpoint · 公开研报汇总",
};

// ═══════════════════════════════════════
// Accent — AAPL: 银灰 (#A8A8AE)
// ═══════════════════════════════════════
const ACCENT = "#A8A8AE";

function colorHex(c) {
  const map = { red: "#ef4444", orange: "#f59e0b", green: "#22c55e", gray: "#94a3b8" };
  return map[c] || "#94a3b8";
}

function colorLabel(c) {
  const map = { red: "严重预警", orange: "需要关注", green: "逻辑成立", gray: "持续观察" };
  return map[c] || "待评估";
}

// ═══════════════════════════════════════
// Shared CSS — EXACT googlPoster.js baseline
// ═══════════════════════════════════════
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

function calcTitleFont(title, maxWidth, maxSize) {
  const cjkRe = /[一-鿿]/g;
  const cjk = (title.match(cjkRe) || []).length;
  const ascii = title.length - cjk;
  const estWidth = cjk * 1.0 + ascii * 0.55;
  return Math.floor(Math.min(maxSize, maxWidth / Math.max(estWidth, 1)) * 0.95);
}

// ═══════════════════════════════════════
// P1 — DATA DASHBOARD (googlPoster.js 克隆)
// ═══════════════════════════════════════
function buildP1(data) {
  const { title, subTitle, p1_metrics, footer } = data;
  const fs2 = calcTitleFont(title, 880, 78);

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
      <div class="ddetail">${esc(m.status)}</div>
    </div>`;
  }).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.title-block{position:relative;z-index:2;padding:80px 72px 0;text-align:left}
.title-tag{display:inline-block;padding:8px 24px;border:1px solid ${ACCENT}55;border-radius:6px;
  font-size:24px;font-weight:700;color:${ACCENT};letter-spacing:4px;margin-bottom:24px}
.title-main{font-size:${fs2}px;font-weight:900;line-height:1.08;color:#fff;letter-spacing:1px;
  text-shadow:0 0 60px ${ACCENT}33;max-width:920px}
.title-sub{font-size:34px;font-weight:700;color:rgba(255,255,255,0.55);margin-top:16px;letter-spacing:1px}
.title-bar{width:80px;height:4px;background:${ACCENT};margin-top:24px;border-radius:2px;opacity:0.7}

.dash{position:relative;z-index:2;padding:24px 72px 0;display:flex;flex-direction:column;gap:12px}
.drow{display:flex;align-items:center;gap:14px;padding:22px 24px;
  background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);
  border-radius:14px;border-left:3px solid ${ACCENT}44}
.dicon{font-size:32px;min-width:44px;text-align:center}
.dlabel{font-size:26px;font-weight:700;color:rgba(255,255,255,0.85);min-width:130px}
.dbar-wrap{flex:1;height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden}
.dbar-fill{height:100%;border-radius:4px;transition:width 0.3s}
.dval{font-size:22px;font-weight:800;min-width:100px;text-align:right}
.ddetail{font-size:19px;color:rgba(255,255,255,0.4);min-width:260px;max-width:340px;text-align:right;white-space:normal;line-height:1.3}

.footer-block{position:relative;z-index:2;padding:0 72px 80px}
.footer-tag{display:flex;align-items:center;gap:14px;padding:22px 36px;
  background:${ACCENT}0f;border:1px solid ${ACCENT}33;border-radius:16px}
.footer-dot{width:10px;height:10px;border-radius:50%;background:${ACCENT};box-shadow:0 0 10px ${ACCENT}66}
.footer-text{font-size:28px;font-weight:700;color:${ACCENT};letter-spacing:2px}
.footer-sub{font-size:20px;color:rgba(255,255,255,0.35);margin-left:auto}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="title-block">
  <div class="title-tag">${esc(data.ticker)} · 投研诊断</div>
  <div class="title-main">${esc(title)}</div>
  <div class="title-sub">${esc(subTitle)}</div>
  <div class="title-bar"></div>
</div>
<div class="dash">${rows}</div>
<div class="footer-block">
  <div class="footer-tag">
    <span class="footer-dot"></span>
    <span class="footer-text">${esc(data.ticker)} · 投研避坑指南</span>
    <span class="footer-sub">${esc(footer)}</span>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════
// P2 — VERDICT SCORECARD (googlPoster.js 克隆)
// ═══════════════════════════════════════
function buildP2(data) {
  const { p2_stance, p2_checks, footer } = data;

  const failCount = p2_checks.filter((c) => c.icon === "❌").length;
  const warnCount = p2_checks.filter((c) => c.icon === "⚠️").length;

  let verdictEmoji, verdictLabel, verdictSub;
  if (failCount >= 2) {
    verdictEmoji = "🔴"; verdictLabel = "防御观望"; verdictSub = "核心逻辑受损，等待风险释放";
  } else if (warnCount >= 3) {
    verdictEmoji = "🟡"; verdictLabel = "中性观察"; verdictSub = "多空逻辑同时成立，方向未定";
  } else {
    verdictEmoji = "🟢"; verdictLabel = "谨慎看多"; verdictSub = "核心逻辑成立，但短期不追高";
  }

  const rows = p2_checks.map((item, i) => `
    <div class="sc-row">
      <div class="sc-num">${["①","②","③","④"][i]}</div>
      <div class="sc-label">${item.label}</div>
      <div class="sc-status">${item.icon}</div>
      <div class="sc-detail">${esc(item.status)}</div>
    </div>`).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.verdict-top{position:relative;z-index:2;padding:64px 72px 0;display:flex;align-items:center;gap:24px}
.verdict-emoji{font-size:72px}
.verdict-text{font-size:64px;font-weight:900;color:#fff;letter-spacing:1px}
.verdict-sub{font-size:30px;color:rgba(255,255,255,0.45);margin-top:12px;padding-left:96px;position:relative;z-index:2}

.scorecard{position:relative;z-index:2;padding:36px 72px 0;display:flex;flex-direction:column;gap:10px}
.sc-row{display:flex;align-items:center;gap:18px;padding:26px 28px;
  background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);
  border-radius:14px}
.sc-num{font-size:30px;font-weight:800;color:${ACCENT};min-width:40px}
.sc-label{font-size:28px;font-weight:700;color:rgba(255,255,255,0.85);min-width:180px}
.sc-status{font-size:34px;min-width:56px;text-align:center}
.sc-detail{font-size:22px;color:rgba(255,255,255,0.5);flex:1;line-height:1.4}

.one-liner{position:relative;z-index:2;padding:24px 72px 48px}
.one-liner-box{display:flex;align-items:center;gap:16px;padding:28px 36px;
  border:1px solid ${ACCENT}44;border-radius:16px;background:${ACCENT}08}
.one-liner-icon{font-size:36px}
.one-liner-text{font-size:34px;font-weight:700;color:#fff;line-height:1.4}
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
    <span class="one-liner-text">${esc(p2_stance)}</span>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════
// P3 — DEEP DIVE (googlPoster.js 克隆)
// ═══════════════════════════════════════
function buildP3(data) {
  const { p3_questions, footer } = data;

  const cards = p3_questions.map((qa, i) => `
    <div class="card">
      <div class="card-q">${esc(qa.q)}</div>
      <div class="card-a">${esc(qa.a)}</div>
      <div class="card-bar"><div class="card-bar-fill" style="width:${90-i*15}%;background:${ACCENT}"></div></div>
      <div class="card-verdict" style="color:${i<2?"#f59e0b":"#22c55e"}">${i<2?"需要深度验证":"长期逻辑偏积极"}</div>
    </div>`).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.section-head{position:relative;z-index:2;padding:60px 72px 0}
.section-tag{display:inline-block;padding:6px 20px;border:1px solid ${ACCENT}55;border-radius:6px;
  font-size:22px;font-weight:700;color:${ACCENT};letter-spacing:4px;margin-bottom:16px}
.section-title{font-size:44px;font-weight:900;color:#fff;letter-spacing:1px}

.cards{position:relative;z-index:2;padding:18px 72px 0;display:flex;flex-direction:column;gap:10px}
.card{padding:22px 28px;background:rgba(255,255,255,0.025);
  border:1px solid rgba(255,255,255,0.05);border-radius:14px;border-left:4px solid ${ACCENT}55}
.card-q{font-size:28px;font-weight:800;color:#fff;margin-bottom:8px;line-height:1.25}
.card-a{font-size:22px;font-weight:600;color:rgba(255,255,255,0.62);line-height:1.40;margin-bottom:12px}
.card-bar{height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-bottom:8px}
.card-bar-fill{height:100%;border-radius:2px}
.card-verdict{font-size:20px;font-weight:700}

.bottom-note{position:relative;z-index:2;padding:20px 72px 60px;
  font-size:18px;color:rgba(255,255,255,0.20);text-align:center}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="section-head">
  <div class="section-tag">${esc(data.ticker)} · 深度拆解</div>
  <div class="section-title">3个关键问题</div>
</div>
<div class="cards">${cards}</div>
<div class="bottom-note">${esc(footer)}</div>
</body></html>`;
}

// ═══════════════════════════════════════
// P4 — ACTION GUIDE (googlPoster.js 克隆)
// ═══════════════════════════════════════
function buildP4(data) {
  const { p4_actions } = data;

  const doHtml = p4_actions.do.map((d) =>
    `<div class="guide-row do"><span class="guide-icon">✅</span><span>${esc(d)}</span></div>`
  ).join("");

  const dontHtml = p4_actions.dont.map((d) =>
    `<div class="guide-row dont"><span class="guide-icon">❌</span><span>${esc(d)}</span></div>`
  ).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.guide-top{position:relative;z-index:2;padding:72px 72px 0}
.guide-tag{display:inline-block;padding:8px 24px;border:1px solid ${ACCENT}55;border-radius:6px;
  font-size:24px;font-weight:700;color:${ACCENT};letter-spacing:4px;margin-bottom:20px}
.guide-title{font-size:50px;font-weight:900;color:#fff;letter-spacing:1px}

.guide-section{position:relative;z-index:2;padding:28px 72px 0}
.guide-section-title{font-size:30px;font-weight:800;color:${ACCENT};margin-bottom:14px;letter-spacing:2px}
.guide-row{display:flex;align-items:center;gap:14px;padding:16px 22px;
  margin-bottom:8px;border-radius:10px;font-size:24px;font-weight:600}
.guide-row.do{background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.12);color:rgba(255,255,255,0.82)}
.guide-row.dont{background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.12);color:rgba(255,255,255,0.82)}
.guide-icon{font-size:28px;min-width:42px;text-align:center}

.poll{position:relative;z-index:2;padding:32px 72px 52px}
.poll-q{font-size:38px;font-weight:800;color:#fff;text-align:center;margin-bottom:28px}
.poll-btns{display:flex;gap:24px;justify-content:center}
.poll-btn{flex:1;max-width:380px;padding:28px 0;text-align:center;
  border:2px solid ${ACCENT}55;border-radius:16px;font-size:30px;font-weight:700;
  color:#fff;background:${ACCENT}08}
.poll-cta{text-align:center;margin-top:22px;font-size:26px;color:rgba(255,255,255,0.3)}

.disclaimer-block{position:relative;z-index:2;padding:0 72px 60px;text-align:center;margin-top:auto}
.disclaimer-text{font-size:20px;font-weight:500;color:rgba(255,255,255,0.22);line-height:1.6}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="guide-top">
  <div class="guide-tag">${esc(data.ticker)} · 操作指南</div>
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
  <div class="poll-q">你怎么看苹果的 AI 困局？</div>
  <div class="poll-btns">
    <div class="poll-btn">▲ 差距会缩小</div>
    <div class="poll-btn">▼ 差距继续扩大</div>
  </div>
  <div class="poll-cta">评论区聊聊你的判断</div>
</div>
<div class="disclaimer-block">
  <div class="disclaimer-text">
    风险提示：本文仅为公开数据整理与AI投研模型诊断，不构成任何投资建议。<br/>
    市场有风险，入市需谨慎。投资决策请基于个人独立判断。
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════
// Main
// ═══════════════════════════════════════
(async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  AAPL P1-P4 — GOOGL 仪表盘克隆      ║");
  console.log("║  Baseline: googlPoster.js (30% CTR)  ║");
  console.log("║  0 剪影 / 0 线框 / 0 抽象装饰       ║");
  console.log("╚══════════════════════════════════════╝\n");

  const OUT_DIR = path.join(process.cwd(), "covers", "AAPL_FINAL");
  await fs.ensureDir(OUT_DIR);

  const slides = {
    p1: { html: buildP1(AAPL) },
    p2: { html: buildP2(AAPL) },
    p3: { html: buildP3(AAPL) },
    p4: { html: buildP4(AAPL) },
  };

  console.log("🎨 渲染 4 张 AAPL 投研海报…\n");
  const results = await renderSlideSet("AAPL", slides, OUT_DIR);

  console.log("\n──────────────────────────────────────");
  let ok = 0;
  for (const r of results) {
    if (!r.error) { console.log("✅ " + r.name + "  (" + r.sizeKB + " KB)"); ok++; }
    else { console.log("❌ " + r.name + "  失败: " + r.error); }
  }
  console.log("──────────────────────────────────────");

  // Audit report
  console.log("\n📋 清理审计报告:");
  console.log("  Baseline: googlPoster.js (commit 195938d)");
  console.log("  已删除: silhouette / sil-phone / sil-macbook / sil-head / sil-shoulders / hero-line");
  console.log("  已删除: Apple极简布局 / 大面积留白 / 抽象人物剪影");
  console.log("  已恢复: 4-row progress bar dashboard (googlPoster.js 克隆)");
  console.log("  模板结构: title-block → dash(icon+label+bar+val+detail) → footer-block");
  console.log("  背景层: 仅 bg-grid + bg-glow (0个装饰DOM元素)");

  // Caption
  const caption =
    AAPL.title + "  " + AAPL.subTitle + "\n\n" +
    "最近很多人讨论苹果的AI困局。\n\n" +
    "但我仔细翻了数据之后发现——\n\n" +
    "苹果真正的问题可能不是AI落后。\n\n" +
    "PE 33×，市值$3.72T，25亿活跃设备。\n" +
    "Apple Intelligence落后GPT-5约18个月。\n" +
    "iPhone换机周期从3.2年延长到4.2年。\n\n" +
    "我把多头最硬的逻辑和空头最狠的质疑\n" +
    "都拆成了4张图。\n\n" +
    "不一定对。\n\n" +
    "只是把自己每天看的东西记下来。\n" +
    "以后回来验证。\n\n" +
    "投资有风险，请独立判断。\n\n" +
    "你怎么看苹果的AI困局？\n" +
    "评论区聊聊你的判断。\n\n" +
    "#苹果 #AAPL #美股 #AppleIntelligence #AI #投资复盘 #每日复盘";

  await fs.writeFile(path.join(OUT_DIR, "post_caption.txt"), caption, "utf8");
  console.log("✅ 小红书文案已保存");

  await closeBrowser();
  console.log("\n🎉 " + ok + "/4 张渲染完成 → " + OUT_DIR + "\n");
})().catch((err) => { console.error("❌", err); process.exit(1); });
