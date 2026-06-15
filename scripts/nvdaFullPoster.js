/**
 * nvdaFullPoster.js — NVDA 投研海报 P1-P4 (2026.06.13)
 *
 * 模板: metaPoster.js (30%+ CTR 验证)
 * 核心矛盾: 远期PE仅16x vs 增速从93%降到63%
 */

const fs = require("fs-extra");
const path = require("path");
const { renderSlideSet, closeBrowser } = require("./screenshotService");

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

const NVDA = {
  ticker: "NVDA", name: "英伟达",
  title: "NVDA从$236跌到$205",
  subLine: "现在是机会还是陷阱？",
  price: "$205.19", pe: "PE 31.4x", mcap: "市值 $4.97万亿",
  conflictBull: "远期PE 仅16x",
  conflictBullSub: "比可乐还便宜",
  conflictBear: "增速 93%→63%",
  conflictBearSub: "加速度在降",
  instBull: "黄仁勋:下一家万亿美元公司",
  instBear: "市场从$236卖到$205",
  trackingLabel: "🔔 持续跟踪",
  trackingItems: ["Q2财报(8月)","$190支撑位","CPU落地进展"],

  // P2
  p2_verdict_emoji: "🔴", p2_verdict_label: "市场在担心什么",
  p2_verdict_sub: "PE 16x很便宜，为什么还在卖？",
  p2_items: [
    { num:"①", label:"增速放缓", detail:"Q1数据中心增速从+93%降到+63%。不是不增长，是加速度在降。市场买NVDA买的不是增长，是加速增长。" },
    { num:"②", label:"地缘政治", detail:"Vera CPU在中国发布挑战x86，但中美芯片博弈升级中。一旦制裁扩大，CPU叙事可能一夜反转。" },
    { num:"③", label:"趋势已破", detail:"从52周高$236跌到$205，跌破50日均线$207。下方$190如果撑不住，下一个支撑在$170。" },
    { num:"④", label:"SpaceX分流", detail:"SpaceX今日上市，可能从科技股板块大量吸走资金。NVDA作为流动性最好的科技股之一，首当其冲。" },
  ],
  p2_oneliner: "市场不担心NVDA不增长。市场担心增速加速度在降，16x PE看着便宜——但如果增速继续放缓，16x可能还不够便宜。",

  // P3
  p3_title: "为什么还有人坚定看多？", p3_tag: "NVDA · 多头逻辑",
  p3_items: [
    { q:"① 远期PE 16x，比可口可乐还低", a:"标普500平均21x，微软35x，苹果35x。NVDA的16x远期PE是按周期股在定价——没给任何AI溢价。如果AI需求是结构性的，这个定价就错了。", pct:88 },
    { q:"② CPU开辟第二战场", a:"Vera CPU正面挑战英特尔和AMD的x86护城河。数据中心CPU市场年规模$800亿，NVDA从零开始抢。这不是防守，是进攻。", pct:78 },
    { q:"③ 黄仁勋赌的是万亿生态", a:"不是卖更多GPU。是GPU+CPU+网络+软件的全栈AI基础设施。如果赌对了，$4.97万亿市值只是一个起点。", pct:65 },
  ],

  // P4
  p4_title: "选择题", p4_tag: "NVDA · 操作指南",
  p4_conclusion: "多空双方都有硬数据。16x PE买全球AI基础设施龙头——要么是十年一遇的机会，要么是价值陷阱。最终只看一件事：你信不信AI需求是结构性的。",
  p4_signals: [
    { signal:"跌破 $190", desc:"50周均线告破，趋势可能加速" },
    { signal:"Q2财报（8月）", desc:"数据中心增速是否止跌企稳" },
    { signal:"Vera CPU进展", desc:"中国市场反馈或地缘政治变化" },
    { signal:"突破 $236", desc:"创新高后重新确认上升趋势" },
  ],
  p4_follow_cta: "关注我，信号触发时你会收到分析。不需要每天盯盘。",
  footer: "数据来源: Yahoo Finance · 公开研报汇总 · 个人记录 · 非投资建议",
};

const ACCENT = "#64D2FF"; // NVDA 冰蓝

// ── CSS ──
function cssBase() {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{width:1242px;height:1660px;overflow:hidden;position:relative;
  font-family:-apple-system,"PingFang SC","MiSans","Microsoft YaHei",sans-serif;
  font-weight:700;display:flex;flex-direction:column;justify-content:space-between;
  background:#080c12}
.bg-grid{position:absolute;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px);
  background-size:72px 72px}
.bg-glow{position:absolute;width:600px;height:600px;border-radius:50%;
  background:radial-gradient(circle at center,${ACCENT}12 0%,transparent 70%);
  top:10%;left:50%;transform:translate(-50%,0);filter:blur(90px);pointer-events:none;z-index:0}
`.replace(/\n/g," ");
}

function calcTitleFont(title, maxWidth, maxSize) {
  const cjkRe = /[一-鿿]/g;
  const cjk = (title.match(cjkRe) || []).length;
  const ascii = title.length - cjk;
  const estWidth = cjk * 1.0 + ascii * 0.55;
  return Math.floor(Math.min(maxSize, maxWidth / Math.max(estWidth, 1)) * 0.95);
}

// ═══════════════════════════════════════════════════════════════
// P1 — 参照 META 模板
// ═══════════════════════════════════════════════════════════════
function buildP1(data, photoUrl) {
  const fsTitle = calcTitleFont(data.title, 943, 88);
  const fsSub = calcTitleFont(data.subLine, 943, 69);
  const trackingHtml = data.trackingItems.map(t => `<span class="track-chip">${esc(t)}</span>`).join("");
  const photoHtml = photoUrl ? `<img class="person-img" src="${esc(photoUrl)}" />` : "";

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}

/* ── 人物 — 右侧半身像 ── */
.person-layer{position:absolute;right:0;top:0;width:400px;height:1660px;z-index:1;pointer-events:none;overflow:hidden}
.person-img{position:absolute;right:-20px;top:100px;width:400px;height:auto;opacity:0.50;filter:grayscale(20%) brightness(1.05) contrast(1.1)}
.person-glow{position:absolute;right:0;top:40px;width:400px;height:600px;background:radial-gradient(ellipse at 38% 32%,${ACCENT}1a 0%,transparent 65%);pointer-events:none;z-index:0;filter:blur(50px)}
.person-gradient{position:absolute;left:0;top:0;width:320px;height:100%;background:linear-gradient(to left,transparent 0%,#080c12 100%);z-index:2}

/* ── 主内容 ── */
.p1-main{position:relative;z-index:3;display:flex;flex-direction:column;height:100%;padding:160px 74px 140px}

/* ── 顶部 ── */
.p1-top-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}
.p1-tag{display:inline-flex;align-items:center;gap:12px;padding:8px 25px;border:1px solid ${ACCENT}44;border-radius:5px;font-size:25px;font-weight:700;color:${ACCENT};letter-spacing:4px}
.p1-tag-dot{width:8px;height:8px;border-radius:50%;background:${ACCENT};box-shadow:0 0 10px ${ACCENT}88}
.p1-date{font-size:22px;font-weight:600;color:rgba(255,255,255,0.22);letter-spacing:3px}

/* ── 标题 ── */
.p1-title-block{margin-bottom:50px;max-width:1050px}
.p1-title{font-size:${fsTitle}px;font-weight:900;line-height:1.0;color:#fff;white-space:nowrap;letter-spacing:1.5px;text-shadow:0 0 140px ${ACCENT}28}
.p1-subline{font-size:${fsSub}px;font-weight:800;line-height:1.08;color:${ACCENT};letter-spacing:1.5px;margin-top:20px;text-shadow:0 0 50px ${ACCENT}22;max-width:950px}

/* ── 数据三栏 ── */
.p1-data-row{display:flex;gap:0;margin-bottom:44px;border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);padding:16px 0}
.p1-data-item{flex:1;text-align:center;border-right:1px solid rgba(255,255,255,0.04)}
.p1-data-item:last-child{border-right:none}
.p1-data-val{font-size:40px;font-weight:900;color:#fff;letter-spacing:1px}
.p1-data-label{font-size:22px;font-weight:600;color:rgba(255,255,255,0.28);margin-top:5px;letter-spacing:1px}

/* ── 核心冲突 VS 卡 ── */
.p1-conflict{display:flex;align-items:stretch;gap:0;margin-bottom:40px;border:2px solid rgba(255,255,255,0.12);border-radius:12px;overflow:hidden;background:rgba(255,255,255,0.02)}
.p1-conflict-side{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:44px 28px}
.p1-conflict-up{background:rgba(34,197,94,0.08)}
.p1-conflict-down{background:rgba(239,68,68,0.08)}
.p1-conflict-num{font-size:52px;font-weight:900;letter-spacing:2px}
.p1-conflict-num.green{color:#22c55e}
.p1-conflict-num.red{color:#ef4444}
.p1-conflict-label{font-size:20px;font-weight:700;color:rgba(255,255,255,0.45);margin-top:8px;letter-spacing:1px}
.p1-conflict-vs{display:flex;align-items:center;justify-content:center;padding:0 22px;background:rgba(255,255,255,0.02)}
.p1-conflict-vs-text{font-size:24px;font-weight:900;color:rgba(255,255,255,0.2)}

/* ── 第二冲突 ── */
.p1-institutional{display:flex;align-items:stretch;gap:0;margin-bottom:36px;border:1px solid rgba(255,255,255,0.06);border-radius:9px;overflow:hidden;background:rgba(255,255,255,0.01)}
.p1-inst-bull{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 20px;font-size:30px;font-weight:800;color:rgba(100,210,255,0.75);letter-spacing:1px}
.p1-inst-vs{display:flex;align-items:center;justify-content:center;padding:0 18px;font-size:22px;font-weight:700;color:rgba(255,255,255,0.15);letter-spacing:3px}
.p1-inst-bear{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 20px;font-size:30px;font-weight:800;color:rgba(239,68,68,0.75);letter-spacing:1px}

/* ── 跟踪 ── */
.p1-tracking{display:flex;align-items:center;gap:24px;margin-bottom:16px;padding:16px 28px;border:1px solid ${ACCENT}18;border-radius:7px;background:${ACCENT}04}
.p1-track-label{font-size:22px;font-weight:700;color:${ACCENT};letter-spacing:1px;white-space:nowrap}
.track-chip{font-size:22px;font-weight:600;color:rgba(255,255,255,0.45);padding:9px 15px;border:1px solid rgba(255,255,255,0.06);border-radius:5px;background:rgba(255,255,255,0.02)}

/* ── footer ── */
.p1-divider{width:100%;height:1px;background:rgba(255,255,255,0.04);margin-top:auto;margin-bottom:12px}
.p1-footer-text{font-size:18px;font-weight:600;color:rgba(255,255,255,0.1);letter-spacing:1px}

</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>

<div class="person-layer">
  <div class="person-glow"></div>
  ${photoHtml}
  <div class="person-gradient"></div>
</div>

<div class="p1-main">
  <div class="p1-top-row">
    <div class="p1-tag"><span class="p1-tag-dot"></span>${esc(data.ticker)} · 投研诊断</div>
  </div>

  <div class="p1-title-block">
    <div class="p1-title">${esc(data.title)}</div>
    <div class="p1-subline">${esc(data.subLine)}</div>
  </div>

  <div class="p1-data-row">
    <div class="p1-data-item"><div class="p1-data-val">${esc(data.price)}</div><div class="p1-data-label">现价</div></div>
    <div class="p1-data-item"><div class="p1-data-val">${esc(data.pe)}</div><div class="p1-data-label">市盈率 TTM</div></div>
    <div class="p1-data-item"><div class="p1-data-val">${esc(data.mcap)}</div><div class="p1-data-label">市值</div></div>
  </div>

  <div class="p1-conflict">
    <div class="p1-conflict-side p1-conflict-up">
      <div class="p1-conflict-num green">${esc(data.conflictBull)}</div>
      <div class="p1-conflict-label">${esc(data.conflictBullSub)}</div>
    </div>
    <div class="p1-conflict-vs"><div class="p1-conflict-vs-text">VS</div></div>
    <div class="p1-conflict-side p1-conflict-down">
      <div class="p1-conflict-num red">${esc(data.conflictBear)}</div>
      <div class="p1-conflict-label">${esc(data.conflictBearSub)}</div>
    </div>
  </div>

  <div class="p1-institutional">
    <div class="p1-inst-bull">${esc(data.instBull)}</div>
    <div class="p1-inst-vs">VS</div>
    <div class="p1-inst-bear">${esc(data.instBear)}</div>
  </div>

  <div class="p1-tracking">
    <div class="p1-track-label">${esc(data.trackingLabel)}</div>
    ${trackingHtml}
  </div>

  <div class="p1-divider"></div>
  <div class="p1-footer-text">${esc(data.footer)}</div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P2 — 空头逻辑
// ═══════════════════════════════════════════════════════════════
function buildP2(data) {
  const rows = data.p2_items.map(item => `
    <div class="sc-row">
      <div class="sc-num">${item.num}</div>
      <div class="sc-label">${item.label}</div>
      <div class="sc-detail">${esc(item.detail)}</div>
    </div>`).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.verdict-top{position:relative;z-index:2;padding:72px 72px 0;display:flex;align-items:center;gap:20px}
.verdict-emoji{font-size:60px}
.verdict-text{font-size:50px;font-weight:900;color:#fff;letter-spacing:2px}
.verdict-sub{font-size:28px;color:rgba(255,255,255,0.4);margin-top:8px;padding-left:80px;position:relative;z-index:2}
.scorecard{position:relative;z-index:2;padding:36px 72px 0;display:flex;flex-direction:column;gap:10px}
.sc-row{display:flex;align-items:flex-start;gap:16px;padding:26px 28px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);border-radius:14px}
.sc-num{font-size:30px;font-weight:800;color:${ACCENT};min-width:42px;padding-top:2px}
.sc-label{font-size:28px;font-weight:700;color:rgba(255,255,255,0.85);min-width:140px}
.sc-detail{font-size:24px;color:rgba(255,255,255,0.55);flex:1;line-height:1.45}
.one-liner{position:relative;z-index:2;padding:32px 72px 80px}
.one-liner-box{display:flex;align-items:center;gap:14px;padding:28px 36px;border:1px solid ${ACCENT}44;border-radius:16px;background:${ACCENT}08}
.one-liner-icon{font-size:32px}
.one-liner-text{font-size:30px;font-weight:700;color:#fff;line-height:1.4}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="verdict-top"><div class="verdict-emoji">${data.p2_verdict_emoji}</div><div class="verdict-text">${data.p2_verdict_label}</div></div>
<div class="verdict-sub">${data.p2_verdict_sub}</div>
<div class="scorecard">${rows}</div>
<div class="one-liner"><div class="one-liner-box"><span class="one-liner-icon">💡</span><span class="one-liner-text">${esc(data.p2_oneliner)}</span></div></div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P3 — 多头逻辑
// ═══════════════════════════════════════════════════════════════
function buildP3(data) {
  const cards = data.p3_items.map(item => `
    <div class="card">
      <div class="card-q">${esc(item.q)}</div>
      <div class="card-a">${esc(item.a)}</div>
      <div class="card-bar"><div class="card-bar-fill" style="width:${item.pct}%;background:${ACCENT}"></div></div>
    </div>`).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.section-head{position:relative;z-index:2;padding:72px 72px 0}
.section-tag{display:inline-block;padding:8px 24px;border:1px solid ${ACCENT}55;border-radius:6px;font-size:24px;font-weight:700;color:${ACCENT};letter-spacing:4px;margin-bottom:18px}
.section-title{font-size:52px;font-weight:900;color:#fff;letter-spacing:1px}
.cards{position:relative;z-index:2;padding:30px 72px 0;display:flex;flex-direction:column;gap:12px}
.card{padding:26px 32px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);border-radius:16px;border-left:4px solid ${ACCENT}55}
.card-q{font-size:30px;font-weight:800;color:#fff;margin-bottom:10px;line-height:1.3}
.card-a{font-size:24px;font-weight:600;color:rgba(255,255,255,0.62);line-height:1.45;margin-bottom:14px}
.card-bar{height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden}
.card-bar-fill{height:100%;border-radius:3px}
.bottom-note{position:relative;z-index:2;padding:40px 72px 80px;text-align:center;font-size:20px;color:rgba(255,255,255,0.2)}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="section-head"><div class="section-tag">${esc(data.p3_tag)}</div><div class="section-title">${esc(data.p3_title)}</div></div>
<div class="cards">${cards}</div>
<div class="bottom-note">${esc(data.footer)}</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P4 — 操作指南 + 投票
// ═══════════════════════════════════════════════════════════════
function buildP4(data) {
  const signalItems = data.p4_signals.map(s =>
    `<div class="signal-row"><span class="signal-dot"></span><span class="signal-label">${esc(s.signal)}</span><span class="signal-desc">${esc(s.desc)}</span></div>`
  ).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.section-top{position:relative;z-index:2;padding:64px 72px 0}
.section-tag{display:inline-block;padding:8px 24px;border:1px solid ${ACCENT}55;border-radius:6px;font-size:24px;font-weight:700;color:${ACCENT};letter-spacing:4px;margin-bottom:18px}
.section-title{font-size:50px;font-weight:900;color:#fff;letter-spacing:2px}
.conclusion-box{position:relative;z-index:2;padding:28px 72px 0}
.conclusion-text{font-size:28px;font-weight:700;color:rgba(255,255,255,0.7);line-height:1.5}
.tracker-box{position:relative;z-index:2;padding:30px 72px 0}
.tracker-title{font-size:32px;font-weight:800;color:${ACCENT};letter-spacing:1px;margin-bottom:16px}
.signal-row{display:flex;align-items:center;gap:14px;padding:14px 22px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:10px;margin-bottom:8px}
.signal-dot{width:8px;height:8px;border-radius:50%;background:${ACCENT};box-shadow:0 0 8px ${ACCENT}66;min-width:8px}
.signal-label{font-size:26px;font-weight:700;color:#fff;min-width:200px}
.signal-desc{font-size:22px;color:rgba(255,255,255,0.45)}
.follow-cta{position:relative;z-index:2;padding:20px 72px 0;text-align:center}
.follow-cta-text{font-size:30px;font-weight:700;color:${ACCENT};letter-spacing:1px}
.poll{position:relative;z-index:2;padding:28px 72px 40px}
.poll-q{font-size:34px;font-weight:800;color:#fff;text-align:center;margin-bottom:22px}
.poll-btns{display:flex;gap:20px;justify-content:center}
.poll-btn{flex:1;max-width:350px;padding:28px 20px;text-align:center;border:2px solid ${ACCENT}44;border-radius:16px;font-size:28px;font-weight:700;color:#fff;background:${ACCENT}06}
.poll-cta{text-align:center;margin-top:20px;font-size:24px;color:rgba(255,255,255,0.25)}
.disclaimer-block{position:relative;z-index:2;padding:0 72px 60px;text-align:center}
.disclaimer-text{font-size:20px;color:rgba(255,255,255,0.18);line-height:1.6}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="section-top"><div class="section-tag">${esc(data.p4_tag)}</div><div class="section-title">${esc(data.p4_title)}</div></div>
<div class="conclusion-box"><div class="conclusion-text">${esc(data.p4_conclusion)}</div></div>
<div class="tracker-box"><div class="tracker-title">🔔 NVDA 已进入持续跟踪名单</div>${signalItems}</div>
<div class="follow-cta"><div class="follow-cta-text">${esc(data.p4_follow_cta)}</div></div>
<div class="poll">
  <div class="poll-q">👇 你现在怎么操作？</div>
  <div class="poll-btns">
    <div class="poll-btn">🟢 我持有<br/>继续拿着</div>
    <div class="poll-btn">🔴 我已减仓<br/>或清仓了</div>
    <div class="poll-btn">🟡 空仓观望<br/>等Q2财报</div>
  </div>
  <div class="poll-cta">扣1继续持有 | 扣2准备减仓 | 扣3空仓观望<br/>评论区看看多空比例 👇</div>
</div>
<div class="disclaimer-block"><div class="disclaimer-text">风险提示：本文仅为公开数据整理与个人投研记录，不构成任何投资建议。<br/>市场有风险，入市需谨慎。投资决策请基于个人独立判断。</div></div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════
(async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  NVDA P1-P4 — 黑金投研海报           ║");
  console.log("║  Template: metaPoster.js (30% CTR)    ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log("📋 核心矛盾: 远期PE 16x vs 增速93%→63%");

  const OUT_DIR = path.join(process.cwd(), "covers", "NVDA_20260613");
  await fs.ensureDir(OUT_DIR);

  // Jensen photo
  const localPhoto = path.join(process.cwd(), "covers", "jensen.jpg");
  let photoUrl = null;
  if (fs.existsSync(localPhoto)) {
    const b64 = fs.readFileSync(localPhoto).toString("base64");
    photoUrl = "data:image/jpeg;base64," + b64;
  }

  const slides = {
    p1: { html: buildP1(NVDA, photoUrl) },
    p2: { html: buildP2(NVDA) },
    p3: { html: buildP3(NVDA) },
    p4: { html: buildP4(NVDA) },
  };

  console.log("🎨 渲染 4 张 NVDA 投研海报…\n");
  const results = await renderSlideSet("NVDA", slides, OUT_DIR, { viewportWidth: 1242, viewportHeight: 1660 });

  let ok = 0;
  for (const r of results) { if (!r.error) { console.log("✅ "+r.name+" ("+r.sizeKB+" KB)"); ok++; } else { console.log("❌ "+r.name+" 失败: "+r.error); } }

  // Caption
  const caption =
`NVDA从$236跌到$205，是机会还是陷阱？

远期PE只有16x，比可口可乐还便宜

但增速从93%降到了63%

为什么？

P2：市场担心什么（空头最硬的逻辑）
P3：为什么还有人坚定看多（多头最硬的逻辑）
P4：结论 + 持续跟踪机制

多空都有硬数据。16x PE买AI基础设施龙头——要么十年一遇，要么价值陷阱。

你怎么看？评论区见 👇

#美股 #NVDA #英伟达 #AI芯片 #投资 #理财 #股票分析 #每日复盘`;
  await fs.writeFile(path.join(OUT_DIR, "post_caption.txt"), caption, "utf8");
  console.log("✅ post_caption.txt");

  // Comment strategy
  const comments =
`━━━━━━━━━━━━━━━━━
💬 评论区引导
━━━━━━━━━━━━━━━━━

第一条（置顶）：
扣1 = 我持有，继续拿着
扣2 = 我已经减仓/清仓了
扣3 = 空仓观望，等Q2财报
看看多空比例 👇

第二条：
说实话：你觉得AI需求是结构性的还是周期性的？
结构性的扣「结构」，周期性的扣「周期」

第三条：
16x PE买NVDA，贵了还是便宜了？贵了扣1，便宜了扣2

━━━━━━━━━━━━━━━━━
📌 置顶评论
━━━━━━━━━━━━━━━━━
🔔 NVDA已进入持续跟踪名单：
跌破$190 / Q2财报变化 / CPU进展 / 突破$236
任一触发我都会更新分析。
关注后不用每天盯盘，出信号了我来说。`;
  await fs.writeFile(path.join(OUT_DIR, "comment_strategy.txt"), comments, "utf8");
  console.log("✅ comment_strategy.txt");

  await closeBrowser();
  console.log("\n🎉 " + ok + "/4 张渲染完成 → " + OUT_DIR + "\n");
})().catch((err) => { console.error("❌", err); process.exit(1); });
