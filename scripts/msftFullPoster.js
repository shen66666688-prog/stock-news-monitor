/**
 * msftFullPoster.js — MSFT 投研海报 P1-P4 (2026.06.15)
 *
 * 模板: nvdaFullPoster.js (META 30%+ CTR 模板)
 * 核心矛盾: 股价跌30% vs Azure加速到40%
 *             PE 23x十年最便宜 vs $190B capex + 诉讼
 */
const fs = require("fs-extra");
const path = require("path");
const { renderSlideSet, closeBrowser } = require("./screenshotService");

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

const MSFT = {
  ticker: "MSFT", name: "微软",
  title: "微软从$555跌到$391",
  subLine: "Azure在加速，股价在暴跌。谁错了？",
  price: "$390.74", pe: "PE 23.3x", mcap: "市值 $2.90万亿",
  conflictBull: "Azure 增速 40%",
  conflictBullSub: "重新加速中",
  conflictBear: "股价 -30%",
  conflictBearSub: "从52周高点腰斩",
  instBull: "35位分析师说Strong Buy",
  instBear: "$190B capex + 集体诉讼",
  trackingLabel: "🔔 持续跟踪",
  trackingItems: ["7/29 Q4财报","$356支撑位","Copilot渗透率"],

  // P2
  p2_verdict_emoji: "🔴", p2_verdict_label: "市场在担心什么",
  p2_verdict_sub: "PE 23x很便宜，为什么还在卖？",
  p2_items: [
    { num:"①", label:"AI投入黑洞", detail:"全年capex $190B，吃掉了大部分自由现金流。市场问的不是'AI有没有未来'，而是'这笔钱什么时候能赚回来'。Copilot 2000万付费用户只占M365的4.4%。" },
    { num:"②", label:"证券集体诉讼", detail:"6月12日刚立案。指控微软将Azure GPU偷偷挪去补贴Copilot研发，拖累了Azure增速。1月财报后一天蒸发$357B市值——投资人觉得自己被骗了。" },
    { num:"③", label:"趋势全面破位", detail:"从52周高$555跌到$391，跌破50日均线($412)和200日均线($454)。双死叉。$356如果撑不住，下一个支撑在$320。" },
    { num:"④", label:"FTC反垄断", detail:"Lina Khan任内最后大案，调查微软云+AI捆绑。如果要求拆分Azure和M365，估值逻辑需要重写。" },
  ],
  p2_oneliner: "市场不怀疑微软能赚钱。市场怀疑的是：$190B的AI赌注，回报来得够不够快。23x PE看着便宜——但如果capex继续膨胀而Copilot渗透率上不去，23x可能是价值陷阱。",

  // P3
  p3_title: "为什么还有人坚定看多？", p3_tag: "MSFT · 多头逻辑",
  p3_items: [
    { q:"① PE 23x，十年最便宜", a:"微软上一次这么便宜是2016年。35位分析师一致Strong Buy，目标价$561(+43%)，最乐观的看到$870。Azure 40%增速的企业，你上一次见到PE 23x是什么时候？", pct:92 },
    { q:"② AI收入已经$37B，翻倍增长", a:"不是'将来会赚钱'，是已经在赚。AI年化收入$37B(+123%)，Copilot突破2000万付费席位。RPO $627B一个季度翻倍——企业用真金白银在投票。", pct:85 },
    { q:"③ Azure在加速，不是减速", a:"AWS增速20%，Google Cloud增速28%，Azure增速40%——而且还在加速。不是所有云都在减速。如果AI workload迁移到云是大趋势，Azure就是最大的受益者之一。", pct:72 },
  ],

  // P4
  p4_title: "选择题", p4_tag: "MSFT · 操作指南",
  p4_conclusion: "微软是Mag 7里最分裂的标的。23x PE买全球第二大云+最大企业软件公司——要么是十年一遇的折扣，要么$190B capex真的是个无底洞。最终只看一件事：7月29日财报，Copilot能不能证明自己。",
  p4_signals: [
    { signal:"7/29 Q4财报", desc:"Copilot渗透率 + Azure增速 + capex指引" },
    { signal:"跌破 $356", desc:"52周低点告破，趋势可能加速下行" },
    { signal:"诉讼进展", desc:"集体诉讼是否被受理，影响市场情绪" },
    { signal:"突破 $454", desc:"收复200日均线，趋势可能反转" },
  ],
  p4_follow_cta: "关注我，信号触发时你会收到分析。不需要每天盯盘。",
  footer: "数据来源: Yahoo Finance · SEC Filing · 公开研报 · 非投资建议",
};

const ACCENT = "#3B82F6"; // MSFT 蓝

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
// P1 — 冲突型封面
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
.p1-inst-bull{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 20px;font-size:30px;font-weight:800;color:rgba(59,130,246,0.75);letter-spacing:1px}
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
// P4 — 操作指南
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
<div class="tracker-box"><div class="tracker-title">🔔 MSFT 已进入持续跟踪名单</div>${signalItems}</div>
<div class="follow-cta"><div class="follow-cta-text">${esc(data.p4_follow_cta)}</div></div>
<div class="poll">
  <div class="poll-q">👇 你现在怎么操作？</div>
  <div class="poll-btns">
    <div class="poll-btn">🟢 我持有<br/>继续拿着</div>
    <div class="poll-btn">🔴 我已减仓<br/>或清仓了</div>
    <div class="poll-btn">🟡 空仓观望<br/>等7/29财报</div>
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
  console.log("║  MSFT P1-P4 — 投研海报               ║");
  console.log("║  Template: nvdaFullPoster.js (30% CTR)║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log("📋 核心矛盾: Azure 40% vs 股价 -30%");

  const OUT_DIR = path.join(process.cwd(), "covers", "MSFT_20260615");
  await fs.ensureDir(OUT_DIR);

  // Satya Nadella photo
  const localPhoto = path.join(process.cwd(), "covers", "msft.jpg");
  let photoUrl = null;
  if (fs.existsSync(localPhoto)) {
    const b64 = fs.readFileSync(localPhoto).toString("base64");
    photoUrl = "data:image/jpeg;base64," + b64;
  }

  const slides = {
    p1: { html: buildP1(MSFT, photoUrl) },
    p2: { html: buildP2(MSFT) },
    p3: { html: buildP3(MSFT) },
    p4: { html: buildP4(MSFT) },
  };

  console.log("🎨 渲染 4 张 MSFT 投研海报…\n");
  const results = await renderSlideSet("MSFT", slides, OUT_DIR, { viewportWidth: 1242, viewportHeight: 1660 });

  let ok = 0;
  for (const r of results) { if (!r.error) { console.log("✅ "+r.name+" ("+r.sizeKB+" KB)"); ok++; } else { console.log("❌ "+r.name+" 失败: "+r.error); } }

  // Caption
  const caption =
`微软从$555跌到$391，是机会还是陷阱？

PE只有23x，十年最便宜

但Azure增速反而从33%加速到了40%

为什么？

P2：市场在担心什么（$190B capex + 集体诉讼 + 双死叉）
P3：为什么还有人坚定看多（Azure加速 + AI收入翻倍 + 35个Strong Buy）
P4：结论 + 7/29财报是关键

Mag 7里最分裂的标的。23x PE买全球第二大云——要么十年一遇，要么价值陷阱。

你怎么看？评论区见 👇

#美股 #MSFT #微软 #Azure #AI #投资 #理财 #股票分析 #每日复盘`;
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
扣3 = 空仓观望，等7/29财报
看看多空比例 👇

第二条：
说实话：你觉得微软$190B的AI投入能赚回来吗？
能的扣「能」，不能的扣「不能」

第三条：
23x PE买微软，贵了还是便宜了？贵了扣1，便宜了扣2

━━━━━━━━━━━━━━━━━
📌 置顶评论
━━━━━━━━━━━━━━━━━
🔔 MSFT已进入持续跟踪名单：
7/29 Q4财报 / 跌破$356 / 诉讼进展 / 突破$454
任一触发我都会更新分析。
关注后不用每天盯盘，出信号了我来说。`;
  await fs.writeFile(path.join(OUT_DIR, "comment_strategy.txt"), comments, "utf8");
  console.log("✅ comment_strategy.txt");

  await closeBrowser();
  console.log("\n🎉 " + ok + "/4 张渲染完成 → " + OUT_DIR + "\n");
})().catch((err) => { console.error("❌", err); process.exit(1); });
