/* eslint-disable no-console */
/**
 * googlPoster.js — GOOGL 黑金投研海报 (2026.06.08)
 *
 * 核心矛盾：AI搜索是否正在威胁Google传统搜索业务
 * 拆解：Gemini商业化 / 搜索广告收入 / Cloud增长支撑
 *
 * 风格：深夜复盘 / 个人记录 / 非荐股 / 非机构
 * 禁止：买入建议 / 卖出建议 / 目标价 / 涨跌预测
 */

const fs = require("fs-extra");
const path = require("path");
const { renderSlideSet, closeBrowser } = require("./screenshotService");

// ═══════════════════════════════════════════════════════════════
// GOOGL 2026.06.08 硬编码数据
// ═══════════════════════════════════════════════════════════════
const DATA = {
  title: "Google最大的敌人，可能不是OpenAI",
  subTitle: "现价 $392 | 市值 2.02万亿 | PE 27.3倍",
  p1_metrics: [
    { label: "搜索广告", status: "AI Overviews扩张中，广告点击率短期未降，但长期变现有隐忧", color: "orange", value: 40 },
    { label: "Gemini生态", status: "2.5 Pro发布，TPU v7自研，但商业化仍滞后于OpenAI和微软", color: "orange", value: 45 },
    { label: "Google Cloud", status: "Q1营收$43B run-rate，AI工作负载占比提升，利润率改善中", color: "green", value: 65 },
    { label: "反垄断", status: "美国司法部搜索垄断案二审进行中，拆分风险虽低但施压不断", color: "red", value: 30 },
  ],
  p2_stance: "AI搜索的确在切走一部分蛋糕，但Google手里有刀也有盘子。关键不在于会不会被颠覆，而在于转型的速度能否跑赢侵蚀的速度。目前这个答案还不明确。",
  p2_checks: [
    { label: "核心逻辑", status: "Google拥有全球最大的搜索索引和用户习惯——这是竞对难以短期复制的护城河。但用户行为从搜索转向对话的趋势不可逆。", icon: "⚠️" },
    { label: "安全边际", status: "$392对应PE 27.3倍，在Mag 7中不算贵。但若搜索广告增速跌破5%，当前估值将重新定价。", icon: "⚠️" },
    { label: "短期催化", status: "Gemini 2.5 Pro刚发，Google Cloud增速超30%，但市场更关心的是搜索广告是否出现裂痕。Q2电话会将是关键节点。", icon: "⚠️" },
    { label: "中长期趋势", status: "AI搜索的终局不会是一家通吃。Google有分发优势，但必须在'保护旧业务'和'拥抱新范式'之间做出选择。", icon: "✅" },
  ],
  p3_questions: [
    {
      q: "问题1：Gemini的商业化落地，到底走到哪一步了？",
      a: "Gemini 2.5 Pro在MMLU等基准上追平了GPT-5，但开发者生态差距很大。OpenAI有ChatGPT的2亿周活，微软有Copilot嵌入Office全家桶。Google手里有15亿Gmail用户和30亿Android设备，但Gemini在这些场景里的货币化能力还没被验证——订阅收入仍是零头。TPU v7的自研优势是真实的，但硬件最终要服务于生态。",
    },
    {
      q: "问题2：搜索广告收入，究竟有没有受到AI冲击？",
      a: "Q1搜索广告收入同比增长8.3%，看起来不差。但隐忧是：AI Overviews覆盖的查询量在扩大，而这些摘要页面的广告位远少于传统搜索结果页。Google的说法是'AI概览页的广告点击率更高的'，但第三方数据还没大面积验证。真正的风险不是现在，而是18个月后——当用户习惯从Google跳到Perplexity或ChatGPT直接得到答案，广告主的预算会不会跟着迁移？",
    },
    {
      q: "问题3：Cloud业务能不能撑起估值？",
      a: "Google Cloud Q1增速30%+，年化营收接近$43B，运营利润率从几年前的亏损改善到现在的15%。问题是：AWS增速也在回升，Azure有OpenAI独家加持——Google Cloud虽然在AI训练负载上有TPU性价比优势，但推理市场才是更大的蛋糕，而推理更看生态绑定。Cloud能让估值有底，但想成为第二增长曲线，还需要更快。",
    },
  ],
  p4_actions: {
    do: [
      "关注Q2搜索广告增速——如果跌破5%，逻辑需要重新评估",
      "跟踪Gemini用户指标（MAU、付费转化率）——这是商业化最直接的信号",
      "留意Google Cloud利润率——增速30%的基础上利润率是否继续改善",
    ],
    dont: [
      "\"Google有搜索垄断地位所以没事\"——诺基亚也有过垄断地位",
      "\"PE 27倍在Mag 7里最便宜所以安全\"——便宜可能是因为市场在合理定价风险",
      "\"Google是AI研究最深的公司\"——研究深度不等于商业化速度，Transformer是Google发明的，但ChatGPT是OpenAI做的",
    ],
  },
  footer: "数据来源：Alphabet Q1财报 + 公开新闻汇总 + 行业分析 · 个人记录",
};

// ═══════════════════════════════════════════════════════════════
// Accent & theme — 黑金风格
// ═══════════════════════════════════════════════════════════════
const ACCENT = "#D4A843";

// ═══════════════════════════════════════════════════════════════
// Color helpers
// ═══════════════════════════════════════════════════════════════
function colorHex(c) {
  const map = { red: "#ef4444", orange: "#f59e0b", green: "#22c55e", gray: "#94a3b8" };
  return map[c] || "#94a3b8";
}

function colorLabel(c) {
  const map = { red: "严重过热", orange: "横盘整理", green: "逻辑成立", gray: "持续观察" };
  return map[c] || "待评估";
}

// ═══════════════════════════════════════════════════════════════
// Shared CSS foundation
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
// Title font calculator
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
      <div class="ddetail">${m.status}</div>
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
  <div class="title-tag">GOOGL · 投研诊断</div>
  <div class="title-main">${title}</div>
  <div class="title-sub">${subTitle}</div>
  <div class="title-bar"></div>
</div>
<div class="dash">${rows}</div>
<div class="footer-block">
  <div class="footer-tag">
    <span class="footer-dot"></span>
    <span class="footer-text">GOOGL · 投研避坑指南</span>
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

  // Overall verdict: all items are ⚠️ or ✅ → 🟡 cautious
  const failCount = p2_checks.filter((c) => c.icon === "❌").length;
  const warnCount = p2_checks.filter((c) => c.icon === "⚠️").length;

  let verdictEmoji, verdictLabel, verdictSub;
  if (failCount >= 2) {
    verdictEmoji = "🔴"; verdictLabel = "防御观望"; verdictSub = "核心逻辑受损严重，多看少动";
  } else if (warnCount >= 2 || failCount >= 1) {
    verdictEmoji = "🟡"; verdictLabel = "中性观察"; verdictSub = "多空逻辑同时成立，方向未定";
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
.verdict-top{position:relative;z-index:2;padding:100px 72px 0;display:flex;align-items:center;gap:24px}
.verdict-emoji{font-size:72px}
.verdict-text{font-size:60px;font-weight:900;color:#fff;letter-spacing:1px}
.verdict-sub{font-size:28px;color:rgba(255,255,255,0.45);margin-top:10px;padding-left:96px;position:relative;z-index:2}

.scorecard{position:relative;z-index:2;padding:36px 72px 0;display:flex;flex-direction:column;gap:10px}
.sc-row{display:flex;align-items:flex-start;gap:16px;padding:24px 28px;
  background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);
  border-radius:14px}
.sc-num{font-size:28px;font-weight:800;color:${ACCENT};min-width:40px;padding-top:2px}
.sc-label{font-size:26px;font-weight:700;color:rgba(255,255,255,0.85);min-width:150px}
.sc-status{font-size:32px;min-width:50px;text-align:center}
.sc-detail{font-size:22px;color:rgba(255,255,255,0.5);flex:1;line-height:1.4}

.one-liner{position:relative;z-index:2;padding:36px 72px 120px}
.one-liner-box{display:flex;align-items:center;gap:14px;padding:26px 32px;
  border:1px solid ${ACCENT}44;border-radius:16px;background:${ACCENT}08}
.one-liner-icon{font-size:32px}
.one-liner-text{font-size:30px;font-weight:700;color:#fff;line-height:1.35}
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
    <span class="one-liner-text">${p2_stance}</span>
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
      <div class="card-verdict" style="color:${i < 2 ? "#f59e0b" : "#22c55e"}">${i < 2 ? "持续跟踪" : "相对乐观"}</div>
    </div>`).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.section-head{position:relative;z-index:2;padding:80px 72px 0}
.section-tag{display:inline-block;padding:8px 24px;border:1px solid ${ACCENT}55;border-radius:6px;
  font-size:24px;font-weight:700;color:${ACCENT};letter-spacing:4px;margin-bottom:20px}
.section-title{font-size:50px;font-weight:900;color:#fff;letter-spacing:1px}

.cards{position:relative;z-index:2;padding:28px 72px 0;display:flex;flex-direction:column;gap:14px}
.card{padding:28px 32px;background:rgba(255,255,255,0.025);
  border:1px solid rgba(255,255,255,0.05);border-radius:18px;border-left:4px solid ${ACCENT}55}
.card-q{font-size:30px;font-weight:800;color:#fff;margin-bottom:10px}
.card-a{font-size:25px;font-weight:600;color:rgba(255,255,255,0.7);line-height:1.45;margin-bottom:16px}
.card-bar{height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:10px}
.card-bar-fill{height:100%;border-radius:3px}
.card-verdict{font-size:24px;font-weight:700}

.bottom-note{position:relative;z-index:2;padding:24px 72px 80px;
  font-size:24px;color:rgba(255,255,255,0.3);text-align:center}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="section-head">
  <div class="section-tag">GOOGL · 深度拆解</div>
  <div class="section-title">AI搜索时代的 3 个核心问题</div>
</div>
<div class="cards">${cards}</div>
<div class="bottom-note">${footer}</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P4 — 操作指南 + 多空投票 (Action Guide + Poll)
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
.guide-top{position:relative;z-index:2;padding:80px 72px 0}
.guide-tag{display:inline-block;padding:8px 24px;border:1px solid ${ACCENT}55;border-radius:6px;
  font-size:24px;font-weight:700;color:${ACCENT};letter-spacing:4px;margin-bottom:20px}
.guide-title{font-size:50px;font-weight:900;color:#fff;letter-spacing:1px}

.guide-section{position:relative;z-index:2;padding:24px 72px 0}
.guide-section-title{font-size:30px;font-weight:800;color:${ACCENT};margin-bottom:14px;letter-spacing:2px}
.guide-row{display:flex;align-items:center;gap:14px;padding:18px 24px;
  margin-bottom:8px;border-radius:12px;font-size:26px;font-weight:600;line-height:1.35}
.guide-row.do{background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.12);color:rgba(255,255,255,0.82)}
.guide-row.dont{background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.12);color:rgba(255,255,255,0.82)}
.guide-icon{font-size:28px;min-width:42px;text-align:center}

.poll{position:relative;z-index:2;padding:24px 72px 100px}
.poll-q{font-size:36px;font-weight:800;color:#fff;text-align:center;margin-bottom:24px}
.poll-btns{display:flex;gap:20px;justify-content:center}
.poll-btn{flex:1;max-width:380px;padding:26px 20px;text-align:center;
  border:2px solid ${ACCENT}55;border-radius:18px;font-size:26px;font-weight:700;
  color:#fff;background:${ACCENT}08;line-height:1.35}
.poll-cta{text-align:center;margin-top:20px;font-size:26px;color:rgba(255,255,255,0.3)}

.bottom-note{position:relative;z-index:2;padding:0 72px 90px;
  font-size:24px;color:rgba(255,255,255,0.3);text-align:center;line-height:1.5}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="guide-top">
  <div class="guide-tag">GOOGL · 操作指南</div>
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
  <div class="poll-q">AI搜索，是Google的灭顶之灾，还是又一次进化？</div>
  <div class="poll-btns">
    <div class="poll-btn">🛡️ 搜索广告正在被AI蚕食<br/>用户习惯变了，Google<br/>不可能永远靠垄断活着</div>
    <div class="poll-btn">💎 Google有分发优势和数据壁垒<br/>AI搜索的终局不是颠覆<br/>而是Google自己把搜索升级</div>
  </div>
  <div class="poll-cta">如果未来5年只能持有一家AI公司：<br/>Google / 微软 / OpenAI（如果上市）<br/>你选谁？评论区见。</div>
</div>
<div class="bottom-note">
不一定对。<br/>
只是把自己每天看的东西记下来。<br/>
以后回来验证。<br/>
投资有风险，请独立判断。
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════
(async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  GOOGL 黑金投研海报渲染 (2026.06.08) ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log("📋 核心矛盾: AI搜索是否正在威胁Google传统搜索业务");
  console.log("🎨 视觉风格: 黑金主题 (Bloomberg × 小红书)");
  console.log("🖥️  渲染引擎: Puppeteer (deviceScaleFactor:2)\n");
  console.log("📌 拆解方向:");
  console.log("   1. Gemini商业化进展");
  console.log("   2. Google Search广告收入是否受AI影响");
  console.log("   3. Cloud业务增长能否支撑估值\n");

  const OUT_DIR = path.join(process.cwd(), "covers", "GOOGL_20260608");
  await fs.ensureDir(OUT_DIR);

  const slides = {
    p1: { html: buildP1(DATA) },
    p2: { html: buildP2(DATA) },
    p3: { html: buildP3(DATA) },
    p4: { html: buildP4(DATA) },
  };

  console.log("🎨 开始渲染 4 张 GOOGL 投研海报…\n");
  const results = await renderSlideSet("GOOGL", slides, OUT_DIR);

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

  // Save structured data for reference
  const jsonPath = path.join(OUT_DIR, "googl_data.json");
  await fs.writeJson(jsonPath, DATA, { spaces: 2 });
  console.log(`📋 数据结构已保存: ${jsonPath}`);

  // Save post caption
  const caption = `Google最大的敌人，可能不是OpenAI

Google其实是最奇怪的一家AI公司。

Transformer是它发明的。

Gemini也是它做的。

但现在大家聊AI，
想到的却是OpenAI。

甚至连搜索这门生意，
都开始有人怀疑会不会被AI抢走。

我把最近的数据重新整理了一遍。

做成4张图。

把多头和空头最核心的逻辑都放进去了。

不一定对。

只是把自己每天看的东西记下来。

以后回来验证。

投资有风险，请独立判断。

如果未来5年只能持有一家AI公司：
Google / 微软 / OpenAI（如果上市）
你选谁？

我发现评论区的答案比正文有意思。

#美股 #谷歌 #GOOGL #AI搜索 #Gemini #投资复盘 #深夜复盘`;

  const captionPath = path.join(OUT_DIR, "post_caption.txt");
  await fs.writeFile(captionPath, caption, "utf8");
  console.log(`✅ 发布文案已保存: ${captionPath}`);

  await closeBrowser();

  console.log(`\n🎉 渲染完成: ${successCount}/4 张 GOOGL 黑金海报已生成`);
  console.log(`📁 输出目录: ${OUT_DIR}\n`);
})().catch((err) => {
  console.error("❌ 渲染失败:", err);
  process.exit(1);
});
