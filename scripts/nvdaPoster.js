/* eslint-disable no-console */
/**
 * nvdaPoster.js — NVDA 黑金投研海报 v2 (2026.06.09)
 *
 * 核心矛盾：AI资本开支增速放缓 vs Blackwell需求爆棚
 * 争议路线：英伟达最危险的时刻，可能恰恰是最赚钱的时候
 *
 * 视觉策略 v2：
 *   标题占屏40%+ → 3张大数字卡片 → 最小化文字
 *   用户0.5秒内先看到冲突 → 再看到数字 → 最后才看逻辑
 *
 * 风格：深夜复盘 / 个人记录 / 非荐股 / 非机构 / 非财经媒体
 * 禁止：买入建议 / 卖出建议 / 目标价 / 涨跌预测
 */

const fs = require("fs-extra");
const path = require("path");
const { renderSlideSet, closeBrowser } = require("./screenshotService");

// ═══════════════════════════════════════════════════════════════
// NVDA 2026.06.09 硬编码数据
// ═══════════════════════════════════════════════════════════════
const DATA = {
  // P1: 标题分两行手动控制视觉节奏
  titleLine1: "英伟达最危险的时刻，",
  titleLine2: "可能恰恰是最赚钱的时候",
  subTitle: "现价 $215  ·  市值 $5.2T  ·  PE 32×  /  远期 22×",
  // P1: 3张大数字卡片（纵向布局：数字在上，标签在下）
  p1_bigCards: [
    {
      number: "$5.2T",
      unit: "市值",
      sub: "全球前三，超越除Apple/MSFT外所有公司",
      color: "green",
    },
    {
      number: "$725B",
      unit: "2026 AI Capex",
      sub: "四大云厂商合计 · 增速从54%降至26%",
      color: "orange",
    },
    {
      number: "22×",
      unit: "远期市盈率",
      sub: "7年最低 · 但Cisco在2000年也只有30×",
      color: "gray",
    },
  ],
  // P2
  p2_stance:
    "当所有公司都在疯狂买GPU时，市场担心的反而是：还有没有人能继续这么买下去。",
  p2_checks: [
    {
      label: "核心逻辑",
      status: "Blackwell供不应求，但capex增速放缓不是需求消失，而是基数规律",
      icon: "⚠️",
    },
    {
      label: "安全边际",
      status: "远期PE 22×是7年最低，但便宜≠安全——取决于capex周期拐点",
      icon: "⚠️",
    },
    {
      label: "短期催化",
      status: "GB300爬坡+沙特大单+Anthropic集群 vs GPU租赁价跌38%+企业ROI存疑",
      icon: "⚠️",
    },
  ],
  // P3: 带关键数字的问答
  p3_questions: [
    {
      q: "云厂商AI资本开支还能增长多久？",
      bullNum: "+77%",
      bull:
        "2026年四大厂capex合计$725B。Goldman预测2030年累计$5.3T。管理层反复强调'需求远超供给'，AI工作负载增速未见顶。",
      bearNum: "94%",
      bear:
        "增速从54%降至26%。Capex吃掉94%经营现金流。AI债务$175B，信用利差扩大。一旦融资收紧，capex增速会更快下修。",
      watch:
        "Q2电话会各家capex guidance方向；云厂商FCF margin变化。",
    },
    {
      q: "AI ROI不及预期，英伟达会先受冲击吗？",
      bullNum: "$96.6B",
      bull:
        "GPU是AI淘金热的'铁锹'。英伟达FCF $96.6B，供应链锁定$119B。已签合同至少撑12-18个月，缓冲垫足够厚。",
      bearNum: "−38%",
      bear:
        "GPU租赁价已跌38%——供需在回归。Uber烧完全年AI预算只用了4个月。Michael Burry做空：GPU折旧被严重低估。Cisco在2000年也是'不可替代'的。",
      watch:
        "GPU租赁价格月度走势；企业AI token消耗增速；大客户是否出现订单调整。",
    },
    {
      q: "Blackwell是真需求，还是提前透支？",
      bullNum: "$500B",
      bull:
        "订单$500B，已交付仅$150B。Wedbush：'从未见过如此供应紧张'。Blackwell占高端GPU出货71%。这不是透支，是真实需求远超供给。",
      bearNum: "1/10×",
      bear:
        "Rubin推理成本降至Blackwell的1/10——经济寿命可能比预期短。$500B订单里有多少是'怕买不到'而非'真的马上要用'？囤货≠需求。",
      watch:
        "Blackwell实际部署率 vs 订单量；Rubin量产进度；H200二手价格作为领先指标。",
    },
  ],
  // P4
  p4_actions: {
    do: [
      "跟踪Q2云厂商capex guidance —— 增速拐点是最重要的信号",
      "监控GPU租赁价格(H200/B200) —— 比财报早3-6个月反映供需",
    ],
    dont: [
      "\"AI时代唯一选择\" —— TPU / Trainium / Maia 都在分食推理市场",
      "\"PE 22×很便宜所以安全\" —— 便宜可能是因为市场在合理定价风险",
    ],
  },
  footer: "数据来源：NVDA Q1 FY27 · Goldman Sachs · Morgan Stanley · TrendForce · Wedbush",
};

// ═══════════════════════════════════════════════════════════════
// Accent & theme
// ═══════════════════════════════════════════════════════════════
const ACCENT = "#D4A843";

function colorHex(c) {
  const map = { red: "#ef4444", orange: "#f59e0b", green: "#22c55e", gray: "#94a3b8" };
  return map[c] || "#94a3b8";
}

// ═══════════════════════════════════════════════════════════════
// Shared CSS — bigger glow, more breathing room
// ═══════════════════════════════════════════════════════════════
function cssBase() {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1440px;overflow:hidden;position:relative;
  font-family:-apple-system,"PingFang SC","MiSans","Microsoft YaHei",sans-serif;
  font-weight:700;display:flex;flex-direction:column;justify-content:space-between;
  background:#080c12}
.bg-grid{position:absolute;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px);
  background-size:72px 72px}
.bg-glow{position:absolute;width:800px;height:800px;border-radius:50%;
  background:radial-gradient(circle at center,${ACCENT}10 0%,transparent 70%);
  top:5%;left:50%;transform:translate(-50%,0);filter:blur(100px);pointer-events:none;z-index:0}
.bg-glow2{position:absolute;width:500px;height:500px;border-radius:50%;
  background:radial-gradient(circle at center,${ACCENT}08 0%,transparent 70%);
  bottom:10%;left:20%;transform:translate(-50%,0);filter:blur(80px);pointer-events:none;z-index:0}
`.replace(/\n/g, " ");
}

// ═══════════════════════════════════════════════════════════════
// P1 — HERO COVER（标题占屏40%+，大数字卡片）
// ═══════════════════════════════════════════════════════════════
function buildP1(data) {
  const { titleLine1, titleLine2, subTitle, p1_bigCards, footer } = data;

  // 计算两行分别的字号：最长行决定字号
  const cjkRe = /[一-鿿]/g;
  const l1cjk = (titleLine1.match(cjkRe) || []).length;
  const l1ascii = titleLine1.length - l1cjk;
  const l1w = l1cjk * 1.0 + l1ascii * 0.55;
  const l2cjk = (titleLine2.match(cjkRe) || []).length;
  const l2ascii = titleLine2.length - l2cjk;
  const l2w = l2cjk * 1.0 + l2ascii * 0.55;
  const maxW = Math.max(l1w, l2w);
  const titleSize = Math.floor(Math.min(100, 920 / maxW) * 0.95);

  const cards = p1_bigCards
    .map((c) => {
      const hex = colorHex(c.color);
      const labels = { green: "偏多", orange: "中性偏空", gray: "待观察" };
      return `
    <div class="bcard" style="border-top:3px solid ${hex}33">
      <div class="bc-num" style="color:${hex}">${c.number}</div>
      <div class="bc-unit">${c.unit}</div>
      <div class="bc-sub">${c.sub}</div>
      <div class="bc-tag" style="color:${hex};border-color:${hex}33">${labels[c.color] || "跟踪"}</div>
    </div>`;
    })
    .join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.hero{position:relative;z-index:2;padding:90px 72px 0;text-align:left;
  display:flex;flex-direction:column;justify-content:center;min-height:620px}
.hero-tag{display:inline-block;padding:6px 20px;border:1px solid ${ACCENT}44;border-radius:4px;
  font-size:20px;font-weight:700;color:${ACCENT}88;letter-spacing:6px;margin-bottom:28px;width:fit-content}
.hero-l1{font-size:${titleSize}px;font-weight:900;line-height:1.05;color:#fff;
  letter-spacing:2px;text-shadow:0 0 80px ${ACCENT}22}
.hero-l2{font-size:${titleSize}px;font-weight:900;line-height:1.05;color:#fff;
  letter-spacing:2px;text-shadow:0 0 80px ${ACCENT}22;margin-top:6px}
.hero-sub{font-size:24px;font-weight:600;color:rgba(255,255,255,0.35);margin-top:28px;letter-spacing:1px}
.hero-bar{width:60px;height:3px;background:${ACCENT};margin-top:24px;border-radius:2px;opacity:0.6}

.bcards{position:relative;z-index:2;padding:20px 72px 0;display:flex;gap:18px}
.bcard{flex:1;padding:28px 22px 22px;background:rgba(255,255,255,0.018);
  border:1px solid rgba(255,255,255,0.04);border-radius:16px;
  display:flex;flex-direction:column;align-items:center;text-align:center}
.bc-num{font-size:50px;font-weight:900;letter-spacing:1px;line-height:1;margin-bottom:6px}
.bc-unit{font-size:20px;font-weight:700;color:rgba(255,255,255,0.65);margin-bottom:10px;letter-spacing:2px}
.bc-sub{font-size:17px;font-weight:600;color:rgba(255,255,255,0.3);line-height:1.3;margin-bottom:12px}
.bc-tag{font-size:16px;font-weight:700;padding:4px 14px;border:1px solid;border-radius:20px}

.footer-block{position:relative;z-index:2;padding:24px 72px 80px}
.footer-tag{display:flex;align-items:center;gap:12px;padding:18px 28px;
  background:${ACCENT}08;border:1px solid ${ACCENT}22;border-radius:12px}
.footer-dot{width:8px;height:8px;border-radius:50%;background:${ACCENT};box-shadow:0 0 8px ${ACCENT}44}
.footer-text{font-size:22px;font-weight:700;color:${ACCENT};letter-spacing:3px;white-space:nowrap}
.footer-sub{font-size:17px;color:rgba(255,255,255,0.25);margin-left:auto;text-align:right;line-height:1.3}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div><div class="bg-glow2"></div>
<div class="hero">
  <div class="hero-tag">NVDA · 深夜复盘</div>
  <div class="hero-l1">${titleLine1}</div>
  <div class="hero-l2">${titleLine2}</div>
  <div class="hero-sub">${subTitle}</div>
  <div class="hero-bar"></div>
</div>
<div class="bcards">${cards}</div>
<div class="footer-block">
  <div class="footer-tag">
    <span class="footer-dot"></span>
    <span class="footer-text">NVDA · 投研笔记</span>
    <span class="footer-sub">${footer}</span>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P2 — VERDICT（顶部结论 → 紧凑金句 → 3张大卡片）
// 布局：12%顶部 / 金句框减高40% / 卡片字体放大20%
// ═══════════════════════════════════════════════════════════════
function buildP2(data) {
  const { p2_stance, p2_checks } = data;

  const cards = p2_checks
    .map(
      (item, i) => `
    <div class="card">
      <div class="card-head">
        <span class="card-icon">${item.icon}</span>
        <span class="card-label">${item.label}</span>
      </div>
      <div class="card-body">${item.status}</div>
    </div>`
    )
    .join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
body{justify-content:flex-start}

/* ── 顶部：🟡 中性观察 @ 12% ── */
.verdict-top{position:relative;z-index:2;padding:175px 72px 0;display:flex;align-items:center;gap:24px}
.verdict-emoji{font-size:88px;line-height:1}
.verdict-text{font-size:68px;font-weight:900;color:#fff;letter-spacing:1px}
.verdict-sub{font-size:24px;color:rgba(255,255,255,0.30);margin-top:20px;padding-left:112px;position:relative;z-index:2}

/* ── 分割线 ── */
.divider{width:48px;height:2px;background:${ACCENT}33;margin:44px 72px 0;border-radius:1px;position:relative;z-index:2}

/* ── 金句框：高度缩小40% ── */
.quote{position:relative;z-index:2;padding:30px 72px 0}
.quote-box{display:flex;align-items:flex-start;gap:14px;padding:18px 32px;
  border:1px solid ${ACCENT}28;border-radius:12px;background:${ACCENT}04}
.quote-icon{font-size:30px;padding-top:2px}
.quote-text{font-size:32px;font-weight:800;color:#fff;line-height:1.4}

/* ── 3张独立卡片：字体放大20%，每卡最多2行 ── */
.cards{position:relative;z-index:2;padding:44px 72px 60px;display:flex;flex-direction:column;gap:22px}
.card{padding:36px 32px 34px;
  background:rgba(255,255,255,0.020);border:1px solid rgba(255,255,255,0.05);
  border-radius:16px}
.card-head{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.card-icon{font-size:32px;line-height:1}
.card-label{font-size:29px;font-weight:800;color:rgba(255,255,255,0.88)}
.card-body{font-size:25px;font-weight:600;color:rgba(255,255,255,0.48);line-height:1.45;padding-left:44px}

</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div><div class="bg-glow2"></div>

<div class="verdict-top">
  <div class="verdict-emoji">🟡</div>
  <div class="verdict-text">中性观察</div>
</div>
<div class="verdict-sub">多空逻辑同时成立，方向未定</div>

<div class="divider"></div>

<div class="quote">
  <div class="quote-box">
    <span class="quote-icon">💡</span>
    <span class="quote-text">${p2_stance}</span>
  </div>
</div>

<div class="cards">${cards}</div>

</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P3 — DEEP DIVE（多头vs空头+关键数字+观察）
// ═══════════════════════════════════════════════════════════════
function buildP3(data) {
  const { p3_questions, footer } = data;

  const cards = p3_questions
    .map(
      (qa) => `
    <div class="card">
      <div class="card-q">${qa.q}</div>
      <div class="card-split">
        <div class="card-bull">
          <div class="card-side-top">
            <span class="card-side-icon">📈</span>
            <span class="card-side-label" style="color:#22c55e">多头</span>
            <span class="card-side-num" style="color:#22c55e">${qa.bullNum}</span>
          </div>
          <div class="card-side-text">${qa.bull}</div>
        </div>
        <div class="card-bear">
          <div class="card-side-top">
            <span class="card-side-icon">📉</span>
            <span class="card-side-label" style="color:#ef4444">空头</span>
            <span class="card-side-num" style="color:#ef4444">${qa.bearNum}</span>
          </div>
          <div class="card-side-text">${qa.bear}</div>
        </div>
      </div>
      <div class="card-watch">
        <span class="card-watch-icon">👁️</span>
        <span class="card-watch-label">观察：</span>
        <span class="card-watch-text">${qa.watch}</span>
      </div>
    </div>`
    )
    .join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.section-head{position:relative;z-index:2;padding:60px 72px 0}
.section-tag{display:inline-block;padding:6px 20px;border:1px solid ${ACCENT}44;border-radius:4px;
  font-size:20px;font-weight:700;color:${ACCENT}88;letter-spacing:6px;margin-bottom:16px}
.section-title{font-size:42px;font-weight:900;color:#fff;letter-spacing:1px}

.cards{position:relative;z-index:2;padding:16px 72px 0;display:flex;flex-direction:column;gap:12px}
.card{padding:24px 28px;background:rgba(255,255,255,0.016);
  border:1px solid rgba(255,255,255,0.04);border-radius:14px;border-left:4px solid ${ACCENT}33}
.card-q{font-size:30px;font-weight:800;color:#fff;margin-bottom:14px;line-height:1.3}
.card-split{display:flex;gap:14px;margin-bottom:12px}
.card-bull,.card-bear{flex:1;padding:18px 18px;border-radius:10px}
.card-bull{background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.10)}
.card-bear{background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.10)}
.card-side-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.card-side-icon{font-size:20px}
.card-side-label{font-size:20px;font-weight:800}
.card-side-num{font-size:24px;font-weight:900;margin-left:auto}
.card-side-text{font-size:20px;font-weight:600;color:rgba(255,255,255,0.65);line-height:1.5}
.card-watch{display:flex;align-items:flex-start;gap:8px;padding:12px 16px;
  background:rgba(212,168,67,0.04);border:1px solid ${ACCENT}22;border-radius:8px;
  font-size:19px;color:rgba(255,255,255,0.45);line-height:1.4}
.card-watch-icon{font-size:18px;padding-top:1px}
.card-watch-label{font-weight:700;color:${ACCENT};white-space:nowrap}
.card-watch-text{font-weight:600}

.bottom-note{position:relative;z-index:2;padding:20px 72px 80px;
  font-size:22px;color:rgba(255,255,255,0.22);text-align:center}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div><div class="bg-glow2"></div>
<div class="section-head">
  <div class="section-tag">NVDA · 深度拆解</div>
  <div class="section-title">围绕 AI 资本开支的 3 个核心问题</div>
</div>
<div class="cards">${cards}</div>
<div class="bottom-note">${footer}</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P4 — ACTION + POLL（投票C位 + 2+2清单 + CTA）
// ═══════════════════════════════════════════════════════════════
function buildP4(data) {
  const { p4_actions } = data;

  const doHtml = p4_actions.do
    .map(
      (d) =>
        `<div class="guide-row do"><span class="guide-icon">✅</span><span>${d}</span></div>`
    )
    .join("");

  const dontHtml = p4_actions.dont
    .map(
      (d) =>
        `<div class="guide-row dont"><span class="guide-icon">❌</span><span>${d}</span></div>`
    )
    .join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
.poll{position:relative;z-index:2;padding:100px 72px 0;text-align:center}
.poll-q{font-size:38px;font-weight:900;color:#fff;margin-bottom:32px;letter-spacing:1px}
.poll-btns{display:flex;gap:24px;justify-content:center}
.poll-btn{flex:1;max-width:400px;padding:36px 24px;text-align:center;
  border:2px solid ${ACCENT}44;border-radius:20px;font-size:30px;font-weight:700;
  color:#fff;background:${ACCENT}06;line-height:1.4;transition:border-color 0.2s}
.poll-btn-label{font-size:40px;display:block;margin-bottom:10px}
.poll-cta{text-align:center;margin-top:28px;font-size:28px;font-weight:700;
  color:rgba(255,255,255,0.30);line-height:1.6}
.poll-cta-q{color:${ACCENT};font-weight:900}

.guide-divider{height:1px;background:${ACCENT}18;margin:40px 72px 0;position:relative;z-index:2}

.guide-section{position:relative;z-index:2;padding:24px 72px 0}
.guide-section-title{font-size:26px;font-weight:800;color:${ACCENT};margin-bottom:12px;letter-spacing:3px}
.guide-row{display:flex;align-items:center;gap:14px;padding:16px 22px;
  margin-bottom:8px;border-radius:10px;font-size:22px;font-weight:600;line-height:1.4}
.guide-row.do{background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.10);color:rgba(255,255,255,0.78)}
.guide-row.dont{background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.10);color:rgba(255,255,255,0.78)}
.guide-icon{font-size:26px;min-width:38px;text-align:center}

.bottom-note{position:relative;z-index:2;padding:36px 72px 80px;
  font-size:28px;color:rgba(255,255,255,0.20);text-align:center;line-height:1.8}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div><div class="bg-glow2"></div>
<div class="poll">
  <div class="poll-q">你认为？</div>
  <div class="poll-btns">
    <div class="poll-btn">
      <span class="poll-btn-label">🛡️</span>
      AI算力需求<br/>已经接近天花板
    </div>
    <div class="poll-btn">
      <span class="poll-btn-label">💎</span>
      AI军备竞赛<br/>才刚刚开始
    </div>
  </div>
  <div class="poll-cta">
    <span class="poll-cta-q">如果未来5年只能选一个：</span><br/>
    微软 · 英伟达 · 谷歌<br/>
    你会选谁？评论区见。
  </div>
</div>
<div class="guide-divider"></div>
<div class="guide-section">
  <div class="guide-section-title">📊 胜率较高的策略</div>
  ${doHtml}
</div>
<div class="guide-section">
  <div class="guide-section-title">⚠️ 常见的亏损来源</div>
  ${dontHtml}
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
  console.log("║  NVDA 黑金投研海报 v2 (2026.06.09)   ║");
  console.log("║  视觉策略: Hero封面 + 大数字 + 最小文字 ║");
  console.log("╚══════════════════════════════════════╝\n");

  const OUT_DIR = path.join(process.cwd(), "covers", "NVDA_20260609");
  await fs.ensureDir(OUT_DIR);

  const slides = {
    p1: { html: buildP1(DATA) },
    p2: { html: buildP2(DATA) },
    p3: { html: buildP3(DATA) },
    p4: { html: buildP4(DATA) },
  };

  console.log("🎨 渲染 4 张 NVDA 黑金海报…\n");
  const results = await renderSlideSet("NVDA", slides, OUT_DIR);

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

  // 渲染数据 JSON
  const renderData = {
    stock: "NVDA",
    date: "2026-06-09",
    style: "黑金投研海报 v2 — Hero Cover + Big Numbers",
    price: 215,
    marketCap: "5.2T",
    trailingPE: 32,
    forwardPE: 22,
    p1_title: DATA.titleLine1 + DATA.titleLine2,
    p1_bigCards: DATA.p1_bigCards,
    p2_verdict: "🟡 中性观察",
    p2_checks: DATA.p2_checks,
    p2_oneLiner: DATA.p2_stance,
    p3_questions: DATA.p3_questions,
    p4_poll: {
      optionA: "🛡️ AI算力需求已经接近天花板",
      optionB: "💎 AI军备竞赛才刚刚开始",
      cta: "如果未来5年只能选一个：微软 / 英伟达 / 谷歌",
    },
    p4_actions: DATA.p4_actions,
  };

  const jsonPath = path.join(OUT_DIR, "nvda_render_data.json");
  await fs.writeJson(jsonPath, renderData, { spaces: 2 });
  console.log(`📋 渲染数据已保存: ${jsonPath}`);

  // 小红书文案
  const caption = `最近越来越多人觉得，
英伟达最大的风险来自竞争对手。

但我翻了一圈财报之后发现。

市场真正担心的，
可能不是AMD。

而是另一件事。

当微软、Meta、Google、Amazon
今年合计要花 $7250亿 在AI基础设施上时——

市场问的不是"他们买不买得起"，
而是"他们还能这样买多久"。

Blackwell一芯难求，
订单积压 $5000亿。

但GPU租赁价格跌了38%。
企业AI的ROI正在被严格审视。

我把多头和空头最核心的逻辑
都拆成了3个问题。

做成4张图。

不一定对。

只是把自己每天看的东西记下来。
以后回来验证。
投资有风险，请独立判断。

如果未来5年只能选一个：
微软 · 英伟达 · 谷歌
你选谁？

#英伟达 #NVDA #美股 #AI芯片 #Blackwell #投资复盘 #深夜复盘 #AI算力`;

  await fs.writeFile(path.join(OUT_DIR, "post_caption.txt"), caption, "utf8");
  console.log("✅ 小红书文案已保存");

  // ── 抖音专用文案 ──
  const douyinCaption = `最近越来越多人担心英伟达。

但我发现。

市场真正怕的好像根本不是AMD。

而是——如果那些巨头不继续砸钱买GPU了呢？

$725B。这是今年四大云厂的AI预算。

但增速已经在刹车。

我把多空逻辑拆成4张图。

你觉得：
🛡️ AI算力需求快到头了
还是
💎 AI军备竞赛才刚开始？

评论区扣1或2。
看看大家站哪边。

#英伟达 #NVDA #AI #美股 #财经`;

  await fs.writeFile(path.join(OUT_DIR, "douyin_caption.txt"), douyinCaption, "utf8");
  console.log("✅ 抖音文案已保存");

  // 置顶评论
  const pinned = `【置顶评论】

说几句心里话。

写这篇的时候我其实很纠结。

从数据上看，
英伟达好得不像话——
$96.6B 自由现金流，
Blackwell 供不应求，
PE 才 22 倍。

但历史上每一个"不可替代"的公司，
最后都被替代了。

Cisco 在 2000 年也是"互联网的基础设施"。
诺基亚在 2007 年也是"手机的唯一选择"。

我不是说英伟达会变成它们。

我是想提醒自己：
当一个公司的好
已经好到没有人质疑的时候——
质疑本身就变得最有价值。

最后我的结论是 🟡 中性观察。

不是没有观点。
是承认现在这个位置，
多空都能讲出一个完整的、合理的、有数据支撑的故事。

投资有风险，请独立判断。

—— 深夜复盘，个人记录`;

  await fs.writeFile(path.join(OUT_DIR, "pinned_comment.txt"), pinned, "utf8");
  console.log("✅ 置顶评论已保存");

  // 评论互动文案
  const interactions = `【评论区互动】

🛡️ 投"天花板"方：
- "你有没有算过，$725B capex吃掉94%经营现金流。历史上从未有过。"
- "GPU租赁跌38%——供给追上需求的速度比市场想的快。"
- "Cisco在2000年也是'不可替代'的。估值逻辑一模一样。"

💎 投"军备竞赛"方：
- "推理成本降到1/10，用的人只会更多。成本降→需求扩，不是零和。"
- "Blackwell订单$500B才交了$150B。砍一半也能撑到2027。"
- "全世界还有中国、中东、欧洲。AI基建不是美国一个市场的故事。"

🔄 五年选一个：
- "我选微软。OpenAI独家+Copilot落地+Azure云底座。"
- "我选英伟达。不管谁赢，都得买GPU。AI时代的卖水人。"
- "我选谷歌。Transformer是它发明的，TPU是它做的，Gemini被低估最厉害。"`;

  await fs.writeFile(path.join(OUT_DIR, "comment_interactions.txt"), interactions, "utf8");
  console.log("✅ 评论互动文案已保存");

  await closeBrowser();

  console.log(`\n🎉 渲染完成: ${successCount}/4 张 NVDA v2 黑金海报`);
  console.log(`📁 输出目录: ${OUT_DIR}\n`);
})().catch((err) => {
  console.error("❌ 渲染失败:", err);
  process.exit(1);
});
