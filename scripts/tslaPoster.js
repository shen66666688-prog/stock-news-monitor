/* eslint-disable no-console */
/**
 * tslaPoster.js — TSLA 黑金投研海报 (2026.06.10)
 *
 * 核心矛盾：市场到底是在给特斯拉汽车业务估值，还是在给马斯克的未来故事估值？
 *
 * 视觉策略 v2：
 *   标题占屏40%+ → 3张大数字卡片 → 最小化文字
 *   用户0.5秒内先看到冲突 → 再看到数字 → 最后才看逻辑
 *
 * 风格：深夜复盘 / 个人记录 / 非荐股 / 非机构 / 非财经媒体
 * 禁止：买入建议 / 卖出建议 / 目标价 / 涨跌预测
 * 禁止：讨论Robotaxi本身
 */

const fs = require("fs-extra");
const path = require("path");
const { renderSlideSet, closeBrowser } = require("./screenshotService");

// ═══════════════════════════════════════════════════════════════
// TSLA 2026.06.10 硬编码数据
// ═══════════════════════════════════════════════════════════════
const DATA = {
  // P1: 标题分两行手动控制视觉节奏
  titleLine1: "市场买的到底是汽车，",
  titleLine2: "还是马斯克的未来故事？",
  subTitle: "现价 $391  ·  市值 $1.47T  ·  静态PE 358×",
  // P1: 3张大数字卡片
  p1_bigCards: [
    {
      number: "358×",
      unit: "静态市盈率",
      sub: "汽车公司平均PE 8-12× · 溢价来自哪里？",
      color: "red",
    },
    {
      number: "$1.47T",
      unit: "市值",
      sub: "超越丰田+大众+奔驰+宝马总和",
      color: "orange",
    },
    {
      number: "1.8M",
      unit: "年交付量",
      sub: "全球份额 ~2.2% · 但市值占行业 ~40%",
      color: "gray",
    },
  ],
  // P2
  p2_stance:
    "市场已经开始给2030年的故事定价，但2026年的数据还没有完全验证。",
  p2_checks: [
    {
      label: "核心逻辑",
      status: "特斯拉的估值早已脱离汽车业务。市场在为FSD、Robotaxi、Optimus的未来现金流折现——但这些业务今天几乎没有收入。",
      icon: "⚠️",
    },
    {
      label: "安全边际",
      status: "$391 × 358倍PE。如果只按汽车业务估值（PE 15×），对应股价约$16。剩下的$375都是故事溢价。问题是：故事能不能变成财报？",
      icon: "❌",
    },
    {
      label: "短期催化",
      status: "FSD入华、Q2交付数据、Cybertruck产能爬坡——都是催化剂。但催化剂≠基本面改善，只是给故事争取更多时间。",
      icon: "⚠️",
    },
  ],
  // P3: 带关键数字的问答
  p3_questions: [
    {
      q: "Robotaxi到底能不能贡献利润？",
      bullNum: "$30K",
      bull:
        "Cybercab硬件成本<$30K，远低于Waymo的激光雷达方案。一旦FSD突破L4，单车运营利润模型理论上碾压所有竞品。规模化后每英里成本可以做到$0.2以下。",
      bearNum: "20辆",
      bear:
        "奥斯汀'全域覆盖'只有约20辆车在跑。Waymo有577辆且已积累百万英里数据。从20辆到商业化盈利车队，中间还有监管、安全、保险、用户信任四座大山。2028年前看不到实质收入。",
      watch:
        "Robotaxi月度运营数据（车队规模、里程、事故率）；FSD V15推送节点。",
    },
    {
      q: "FSD能不能形成长期护城河？",
      bullNum: "端到端",
      bull:
        "端到端方案一旦突破临界点，数据飞轮就会启动——更多车→更多数据→更好模型→更多车。这是Waymo的分层式方案无法复制的规模优势。中国FSD入华是泛化能力最真实的压力测试。",
      bearNum: "华为/小鹏",
      bear:
        "中国市场的辅助驾驶已经是红海。华为ADS、小鹏XNGP、理想AD Max都已经大量上路。FSD进中国是'补齐短板'，不是'建立壁垒'。一旦用户发现国产方案在日常场景中够用了，FSD的溢价就立不住。",
      watch:
        "FSD中国用户反馈（真实体验 vs 营销叙事）；FSD V15在复杂场景下的表现。",
    },
    {
      q: "汽车业务增速还能不能支撑估值？",
      bullNum: "16%",
      bull:
        "2026年全球交付增速预计16%，Cybertruck产能持续爬坡，Model 2（如果推出）会打开$25K以下新市场。储能业务增速超过80%，已经是第二增长曲线。即使汽车增速放缓，能源业务的估值贡献在增加。",
      bearNum: "−2.2%",
      bear:
        "中国市场份额持续被比亚迪蚕食，欧洲市场面临关税壁垒，美国Model Y/Y改款换新红利正在消退。Q1交付量环比下降。汽车毛利率从30%降到18%——规模在涨，但利润在缩。储能增速虽快，但基数太小（不足营收10%），远不足以支撑$1.47T估值。",
      watch:
        "Q2全球交付数据；中国市场份额月度变化；储能业务营收占比趋势。",
    },
  ],
  // P4
  p4_actions: {
    do: [
      "跟踪FSD V15推送质量——比Q2交付数据更影响长期逻辑估值",
      "观察Robotaxi月度运营数据——目前公开数据太少，数据密度决定验证速度",
    ],
    dont: [
      "\"PE高是因为特斯拉是科技公司\"——这个叙事已经被定价，不再是安全垫",
      "\"马斯克说过会兑现\"——他说过很多后来没有按时间表兑现的事",
    ],
  },
  footer: "数据来源：特斯拉Q1 FY26 · Reuters · Bloomberg · 行业研报汇总 · 个人记录",
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
      const labels = { red: "偏空", orange: "中性偏空", green: "偏多", gray: "待观察" };
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
  <div class="hero-tag">TSLA · 深夜复盘</div>
  <div class="hero-l1">${titleLine1}</div>
  <div class="hero-l2">${titleLine2}</div>
  <div class="hero-sub">${subTitle}</div>
  <div class="hero-bar"></div>
</div>
<div class="bcards">${cards}</div>
<div class="footer-block">
  <div class="footer-tag">
    <span class="footer-dot"></span>
    <span class="footer-text">TSLA · 投研笔记</span>
    <span class="footer-sub">${footer}</span>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P2 — VERDICT（顶部结论 → 紧凑金句 → 3张大卡片）
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

/* ── 顶部 ── */
.verdict-top{position:relative;z-index:2;padding:175px 72px 0;display:flex;align-items:center;gap:24px}
.verdict-emoji{font-size:88px;line-height:1}
.verdict-text{font-size:68px;font-weight:900;color:#fff;letter-spacing:1px}
.verdict-sub{font-size:24px;color:rgba(255,255,255,0.30);margin-top:20px;padding-left:112px;position:relative;z-index:2}

/* ── 分割线 ── */
.divider{width:48px;height:2px;background:${ACCENT}33;margin:44px 72px 0;border-radius:1px;position:relative;z-index:2}

/* ── 金句框 ── */
.quote{position:relative;z-index:2;padding:30px 72px 0}
.quote-box{display:flex;align-items:flex-start;gap:14px;padding:18px 32px;
  border:1px solid ${ACCENT}28;border-radius:12px;background:${ACCENT}04}
.quote-icon{font-size:30px;padding-top:2px}
.quote-text{font-size:32px;font-weight:800;color:#fff;line-height:1.4}

/* ── 3张独立卡片 ── */
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
  <div class="section-tag">TSLA · 深度拆解</div>
  <div class="section-title">估值还是故事？3 个核心问题</div>
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
      特斯拉<br/>被高估了
    </div>
    <div class="poll-btn">
      <span class="poll-btn-label">💎</span>
      市场仍然低估了<br/>未来价值
    </div>
  </div>
  <div class="poll-cta">
    <span class="poll-cta-q">如果5年后再回头看：</span><br/>
    特斯拉最大的收入来源<br/>
    还是卖车吗？评论区见。
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
  console.log("║  TSLA 黑金投研海报 v2 (2026.06.10)   ║");
  console.log("║  视觉策略: Hero封面 + 大数字 + 最小文字 ║");
  console.log("╚══════════════════════════════════════╝\n");

  const OUT_DIR = path.join(process.cwd(), "covers", "TSLA_20260610");
  await fs.ensureDir(OUT_DIR);

  const slides = {
    p1: { html: buildP1(DATA) },
    p2: { html: buildP2(DATA) },
    p3: { html: buildP3(DATA) },
    p4: { html: buildP4(DATA) },
  };

  console.log("🎨 渲染 4 张 TSLA 黑金海报…\n");
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

  // 渲染数据 JSON
  const renderData = {
    stock: "TSLA",
    date: "2026-06-10",
    style: "黑金投研海报 v2 — Hero Cover + Big Numbers",
    price: 391,
    marketCap: "1.47T",
    trailingPE: 358,
    p1_title: DATA.titleLine1 + DATA.titleLine2,
    p1_bigCards: DATA.p1_bigCards,
    p2_verdict: "🟡 中性观察",
    p2_checks: DATA.p2_checks,
    p2_oneLiner: DATA.p2_stance,
    p3_questions: DATA.p3_questions,
    p4_poll: {
      optionA: "🛡️ 特斯拉被高估了",
      optionB: "💎 市场仍然低估了未来价值",
      cta: "如果5年后再回头看：特斯拉最大的收入来源还是卖车吗？",
    },
    p4_actions: DATA.p4_actions,
  };

  const jsonPath = path.join(OUT_DIR, "tsla_render_data.json");
  await fs.writeJson(jsonPath, renderData, { spaces: 2 });
  console.log(`📋 渲染数据已保存: ${jsonPath}`);

  // 小红书文案
  const caption = `最近特斯拉最大的争议，

已经不是车卖得好不好了。

而是市场到底在给什么估值。

$391 的价格，358 倍 PE。

汽车公司平均才 8-12 倍。

多出来的那 340 倍，
买的到底是汽车业务，
还是马斯克的未来故事？

Robotaxi 到底能不能赚钱？
FSD 能不能形成护城河？
汽车增速还能不能撑住这个估值？

我把这三个问题拆开，
把多头和空头最核心的逻辑都放进去了。

做成 4 张图。

不一定对。

只是把自己每天看的东西记下来。
以后回来验证。

投资有风险，请独立判断。

如果 5 年后再回头看，
你觉得特斯拉最大的收入来源，
还是卖车吗？

#特斯拉 #TSLA #美股 #Robotaxi #FSD #投资复盘 #深夜复盘`;

  await fs.writeFile(path.join(OUT_DIR, "post_caption.txt"), caption, "utf8");
  console.log("✅ 小红书文案已保存");

  // 抖音专用文案
  const douyinCaption = `特斯拉 $391 一股。

358 倍 PE。

但你知道全球最大车企丰田 PE 才多少吗？
8 倍。

问题来了：
市场到底是在给特斯拉的汽车业务估值，
还是在给马斯克的未来故事估值？

Robotaxi 到底赚不赚钱？
FSD 真能成护城河吗？
汽车增速还能撑多久？

我把数据拆成 4 张图。

你觉得：
🛡️ 特斯拉被高估了
还是
💎 市场低估了未来价值？

评论区扣 1 或 2。

#特斯拉 #TSLA #美股 #财经`;

  await fs.writeFile(path.join(OUT_DIR, "douyin_caption.txt"), douyinCaption, "utf8");
  console.log("✅ 抖音文案已保存");

  // 置顶评论
  const pinned = `【置顶评论】

说几句心里话。

写这篇的时候我想了很久。

特斯拉是过去十年最精彩的故事。
但好故事和好估值是两回事。

358 倍 PE。
这意味着市场已经假设
FSD、Robotaxi、Optimus
全部成功商业化。

但如果只算汽车业务——
$391 的股价里，
大概只有 $16 是汽车值出来的。

剩下的 $375，
都是马斯克说的"未来"。

我不是说未来不会来。
我是说未来已经被提前定价了。

Q2 交付数据快出来了。
FSD 入华也在推进。
Robotaxi 在奥斯汀跑了一年多。

数据会告诉我们，
故事和现实之间还有多远。

最后的结论是 🟡 中性观察。

不是没有观点。
是承认现在这个位置，
多空都能讲出一个完整的、合理的、有数据支撑的故事。

投资有风险，请独立判断。

—— 深夜复盘，个人记录`;

  await fs.writeFile(path.join(OUT_DIR, "pinned_comment.txt"), pinned, "utf8");
  console.log("✅ 置顶评论已保存");

  // 评论互动文案
  const interactions = `【评论区互动】

🛡️ 投"被高估"方：
- "358倍PE。汽车公司PE中位数是10倍。你说特斯拉不是汽车公司，但它80%收入来自卖车。"
- "FSD讲了快10年了还没L4。Waymo已经在四个城市运营了。时间不站在特斯拉这边。"
- "中国市场份额在掉。欧洲关税在加。Cybertruck是小众市场。汽车基本盘在松动。"

💎 投"低估未来"方：
- "谁说特斯拉是汽车公司？它的AI、能源、机器人业务未来任何一个跑出来，都能再造一个特斯拉。"
- "Waymo一辆车成本$100K+，Cybercab<$30K。端到端方案一旦突破，规模效应会碾压所有对手。"
- "能源业务增速80%+。Megapack供不应求。这是被市场忽略的第二增长曲线。"

🔄 五年后回头看：
- "如果FSD真的L4了，Robotaxi就是印钞机。如果没突破，特斯拉就只是一家利润被挤压的汽车公司。"
- "我投的是'马斯克能把故事变成现实'。这句话放在2008年、2018年都成立，2026年也成立。"`;

  await fs.writeFile(path.join(OUT_DIR, "comment_interactions.txt"), interactions, "utf8");
  console.log("✅ 评论互动文案已保存");

  await closeBrowser();

  console.log(`\n🎉 渲染完成: ${successCount}/4 张 TSLA v2 黑金海报`);
  console.log(`📁 输出目录: ${OUT_DIR}\n`);
})().catch((err) => {
  console.error("❌ 渲染失败:", err);
  process.exit(1);
});
