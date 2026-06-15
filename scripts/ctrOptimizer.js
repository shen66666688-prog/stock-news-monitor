/**
 * ctrOptimizer.js — 基金路演级海报模板 v3
 *
 * Design philosophy:
 *   Apple Keynote × Bloomberg Terminal × The Economist
 *   $10B fund roadshow aesthetic.
 *
 * Rules:
 *   - Single visual center per page. No competing focal points.
 *   - User must grasp the key message within 3 seconds.
 *   - 50% fewer decorative elements, 30% more whitespace.
 *   - Unified grid, margins, font hierarchy, glow intensity.
 *   - No red/green mixing. No fluorescent colors. No excessive glow.
 *
 * Palette (Apple-inspired):
 *   Background:  #050505
 *   Title:       #FFFFFF
 *   Secondary:   #A1A1A6 (silver-gray)
 *   Key numbers: #64D2FF (ice blue)
 *   Accent:      #86868B (subtle silver)
 *   Bull tone:   #64D2FF (ice blue — cool optimism)
 *   Bear tone:   #A1A1A6 (silver — caution without alarm)
 */

const { escapeHtml, pickSentimentStyle, clampShort } = require("./post-utils");

// ═══════════════════════════════════════════════════════════════
// Unified Design System
// ═══════════════════════════════════════════════════════════════
const D = {
  BG:          "#050505",
  WHITE:       "#FFFFFF",
  SILVER:      "#A1A1A6",
  ICE:         "#64D2FF",
  ACCENT:      "#86868B",
  CARD_BG:     "rgba(255,255,255,0.015)",
  CARD_BORDER: "rgba(255,255,255,0.04)",
  GLOW:        "rgba(100,210,255,0.03)",
  DIVIDER:     "rgba(255,255,255,0.06)",
  MUTED:       "rgba(255,255,255,0.22)",
  GRID:        96,   // px
  MARGIN:      80,   // px
  CONTENT_W:   920,  // 1080 - 80*2
};

// ═══════════════════════════════════════════════════════════════
// Per-ticker headline pools — fund-manager tone, not clickbait
// ═══════════════════════════════════════════════════════════════
const COVER_CFG = {
  AAPL: {
    p1_good:    ["苹果的AI溢价，市场还没完全定价","持有AAPL的核心逻辑变了","服务生态：被低估的复利机器"],
    p1_bad:     ["iPhone换机周期正在拉长","苹果在中国市场面临的结构性挑战","当硬件增速归零，估值怎么撑"],
    p1_neutral: ["AAPL：等待下一个催化剂","苹果的攻守之道","硬件守城，服务攻城"],
  },
  NVDA: {
    p1_good:    ["算力的复利效应才刚刚开始","Blackwell之后，还有什么","英伟达的护城河比你以为的深"],
    p1_bad:     ["当所有人都在买GPU，谁还买得起","Capex增速见顶：英伟达最大的灰犀牛","Cisco 2000：一个被遗忘的警示"],
    p1_neutral: ["NVDA：多空都有一手好牌","算力军备竞赛的下半场","英伟达的最优解：时间还是方向"],
  },
  TSLA: {
    p1_good:    ["特斯拉的终局不是一个汽车公司","FSD + Robotaxi：重新定义出行","能源业务：被市场忽略的第二曲线"],
    p1_bad:     ["358倍PE：故事能撑多久","汽车基本盘正在松动","Robotaxi的商业化比你想的更远"],
    p1_neutral: ["TSLA：信仰与数据的博弈","市场在给2030年定价","估值还是故事：特斯拉的十字路口"],
  },
  MSFT: {
    p1_good:    ["Copilot：下一个Office时刻","Azure的AI加速才刚刚开始","微软的复利引擎：企业AI渗透"],
    p1_bad:     ["AI投入回报：市场还能等多久","微软估值到了需要证明自己的时刻","竞争对手正在追赶Azure的AI优势"],
    p1_neutral: ["MSFT：稳中求进","微软的AI赌注大不大","企业AI化：谁是最大赢家"],
  },
  AMZN: {
    p1_good:    ["AWS的AI收入正在加速","零售利润率的结构性改善","亚马逊的飞轮效应回来了"],
    p1_bad:     ["Capex膨胀：亚马逊的利润去哪了","零售竞争加剧：Temu和Shein在追","AWS增速能否持续超预期"],
    p1_neutral: ["AMZN：电商+云的平衡术","等待利润兑现","亚马逊的攻守转换"],
  },
  GOOGL: {
    p1_good:    ["Gemini正在缩小与GPT的差距","Google Cloud：被低估的增长引擎","搜索广告的韧性被市场低估了"],
    p1_bad:     ["AI搜索正在改变游戏规则","反垄断阴影下的谷歌","当用户的搜索习惯开始迁移"],
    p1_neutral: ["GOOGL：转型中的搜索巨人","谷歌的AI反击战","搜索广告的终局是什么"],
  },
  META: {
    p1_good:    ["Reels + AI：广告收入的复利引擎","Meta的AI推荐系统已经形成壁垒","效率年后的Meta：利润加速释放"],
    p1_bad:     ["Reality Labs还要烧多少钱","广告主预算正在分散","Meta的AI故事还剩多少想象空间"],
    p1_neutral: ["META：社交帝国的新护城河","广告+AI：Meta的确定性在哪","扎克伯格的长线赌局"],
  },
};

// ═══════════════════════════════════════════════════════════════
// Font calculator — CJK-aware, refined for larger titles
// ═══════════════════════════════════════════════════════════════
function calcTitleFont(title, maxWidth = 920, maxSize = 108) {
  const cjkRe = /[一-鿿]/g;
  const cjk = (title.match(cjkRe) || []).length;
  const ascii = title.length - cjk;
  const estWidth = cjk * 1.0 + ascii * 0.55;
  let size = Math.floor(Math.min(maxSize, maxWidth / Math.max(estWidth, 1)) * 0.97);
  // Minimum sizes for visual dominance — title must command the page
  if (estWidth < 8) size = Math.max(size, 100);
  else if (estWidth < 12) size = Math.max(size, 84);
  else if (estWidth < 16) size = Math.max(size, 68);
  return size;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickP1Title(ticker, sentiment) {
  const st = pickSentimentStyle(sentiment);
  const cfg = COVER_CFG[ticker] || COVER_CFG.AAPL;
  const key = "p1_" + st.theme;
  const pool = cfg[key] || cfg.p1_neutral;
  return pick(pool);
}

// ═══════════════════════════════════════════════════════════════
// Diagnostic engine — AI data → structured metrics
//
// Maintains backward-compatible 4-row array for mergeMetrics().
// In the new design, these rows feed P1 data cards (not a table).
// ═══════════════════════════════════════════════════════════════
function buildDiagnostics(points, risks, sentiment) {
  const st = pickSentimentStyle(sentiment);
  const allText = [...(points || []), ...(risks || [])].join(" ");

  const hasValuation = /估值|高估|泡沫|贵|回调|PE|溢价/.test(allText);
  const hasGrowth = /增长|加速|需求|资本支出|capex|营收|收入/.test(allText);
  const hasCompetition = /竞争|对手|份额|蚕食|挑战|威胁/.test(allText);
  const hasRegulation = /监管|政策|法规|反垄断|调查|诉讼/.test(allText);

  const rows = [];

  // Row 1: Valuation
  if (hasValuation || st.theme === "bad") {
    const pct = st.theme === "bad" ? 75 : st.theme === "good" ? 50 : 60;
    rows.push({
      icon: "PE", label: "估值水位",
      value: pct > 70 ? "偏高" : pct > 55 ? "合理偏高" : "合理",
      pct, color: D.SILVER,
      detail: hasValuation
        ? clampShort((risks || []).find(r => /估值|高估|泡沫|贵/.test(r)) || points[0] || "", 24)
        : "估值处于历史中枢附近",
    });
  } else {
    rows.push({
      icon: "PE", label: "估值水位",
      value: "相对合理", pct: 45, color: D.SILVER,
      detail: points[0] || "估值未显著偏离均值",
    });
  }

  // Row 2: Growth
  const growthPoint = (points || []).find(p => /增长|加速|需求|资本|突破|芯片|AI/.test(p));
  rows.push({
    icon: "↑", label: "增长动能",
    value: st.theme === "good" ? "强劲" : "温和",
    pct: st.theme === "good" ? 78 : 55,
    color: D.SILVER,
    detail: clampShort(growthPoint || points[1] || points[0] || "等待下一催化剂确认", 24),
  });

  // Row 3: Competition or Market Position
  if (hasCompetition) {
    rows.push({
      icon: "⚔", label: "竞争格局",
      value: "关注变化", pct: 55, color: D.SILVER,
      detail: clampShort(
        (risks || []).find(r => /竞争|对手|份额|蚕食/.test(r))
        || (points || []).find(p => /护城河|壁垒|领先/.test(p))
        || "竞品动态需持续跟踪", 24),
    });
  } else {
    rows.push({
      icon: "◆", label: "技术信号",
      value: "待确认", pct: 50, color: D.SILVER,
      detail: "等待方向性催化剂",
    });
  }

  // Row 4: Risk or Support
  if (hasRegulation) {
    rows.push({
      icon: "⚖", label: "监管风险",
      value: "需关注", pct: 55, color: D.SILVER,
      detail: clampShort((risks || []).find(r => /监管|政策|法规|反垄断|调查|诉讼/.test(r)) || "政策不确定性", 24),
    });
  } else if (st.theme !== "good") {
    const altRisk = (risks || []).length > 1 ? risks[1] : null;
    let riskItem = altRisk || (risks || []).find(r => !/竞争|对手|份额/.test(r)) || "短期不确定性较高";
    const valRow = rows.find(r => r.label === "估值水位");
    const isUndervalued = valRow && /低估/.test(valRow.value || "");
    if (isUndervalued && /高位|高估|过热|泡沫|贵/.test(riskItem)) {
      riskItem = (risks || []).find(r => !/高位|高估|过热|泡沫|贵|竞争|对手|份额/.test(r))
        || "注意大盘系统性风险";
    }
    rows.push({
      icon: "!", label: "风险提示",
      value: "密切关注", pct: 60, color: D.SILVER,
      detail: clampShort(riskItem, 24),
    });
  } else {
    rows.push({
      icon: "✓", label: "核心支撑",
      value: "逻辑成立", pct: 75, color: D.SILVER,
      detail: clampShort((points || [])[0] || "多头逻辑链条完整", 24),
    });
  }

  // Ensure exactly 4 rows
  while (rows.length < 4) {
    rows.push({
      icon: "·", label: "跟踪指标",
      value: "持续观察", pct: 50, color: D.SILVER,
      detail: "关注下一催化节点",
    });
  }

  return rows.slice(0, 4);
}

// ═══════════════════════════════════════════════════════════════
// Unified CSS foundation — single glow, subtle grid, no noise
// ═══════════════════════════════════════════════════════════════
function cssBase() {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1440px;overflow:hidden;position:relative;
  font-family:-apple-system,"PingFang SC","MiSans","Microsoft YaHei",sans-serif;
  font-weight:500;display:flex;flex-direction:column;
  background:${D.BG}}
.bg-grid{position:absolute;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(rgba(255,255,255,0.010) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.010) 1px,transparent 1px);
  background-size:${D.GRID}px ${D.GRID}px}
.bg-glow{position:absolute;width:700px;height:700px;border-radius:50%;
  background:radial-gradient(circle at center,${D.GLOW} 0%,transparent 70%);
  top:8%;left:50%;transform:translate(-50%,0);filter:blur(120px);pointer-events:none;z-index:0}
`.replace(/\n/g, " ");
}

// ═══════════════════════════════════════════════════════════════
// P1 — COVER
//
// Title dominates 40%+ of the page.
// 3 subtle data cards at bottom — small, understated.
// Only ONE visual center: the title.
// ═══════════════════════════════════════════════════════════════
function buildP1(ticker, title, _accent, diagnostics) {
  const fs = calcTitleFont(title, 880, 104);

  // Extract 3 key data points from diagnostics for the small cards
  const valRow = diagnostics.find(r => r.label === "估值水位") || diagnostics[0];
  const growRow = diagnostics.find(r => r.label === "增长动能") || diagnostics[1];
  const riskRow = diagnostics.find(r => r.label === "风险提示" || r.label === "核心支撑") || diagnostics[3];

  const cards = [
    { label: "估值", value: valRow.value, detail: clampShort(valRow.detail, 20) },
    { label: "动能", value: growRow.value, detail: clampShort(growRow.detail, 20) },
    { label: "信号", value: riskRow.value, detail: clampShort(riskRow.detail, 20) },
  ];

  const cardsHtml = cards.map(c => `
    <div class="mc">
      <div class="mc-label">${escapeHtml(c.label)}</div>
      <div class="mc-value">${escapeHtml(c.value)}</div>
      <div class="mc-detail">${escapeHtml(c.detail)}</div>
    </div>`).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
/* ── Title block: 40%+ of page, title IS the visual center ── */
.hero{position:relative;z-index:2;padding:180px ${D.MARGIN}px 0;
  display:flex;flex-direction:column;justify-content:center;min-height:640px}
.hero-logo{font-size:36px;font-weight:900;color:${D.WHITE};letter-spacing:12px;
  margin-bottom:40px;opacity:0.9}
.hero-title{font-size:${fs}px;font-weight:900;line-height:1.06;color:${D.WHITE};
  letter-spacing:-1px;max-width:920px}
.hero-sub{font-size:20px;font-weight:500;color:${D.MUTED};margin-top:28px;letter-spacing:2px}
.hero-line{width:40px;height:2px;background:${D.ICE}44;margin-top:36px;border-radius:1px}

/* ── Data cards: small, subtle, don't compete with title ── */
.minicards{position:relative;z-index:2;padding:40px ${D.MARGIN}px 0;
  display:flex;gap:20px}
.mc{flex:1;padding:22px 16px 18px;
  background:${D.CARD_BG};border:1px solid ${D.CARD_BORDER};border-radius:8px;
  text-align:center}
.mc-label{font-size:15px;font-weight:600;color:${D.MUTED};letter-spacing:4px;
  text-transform:uppercase;margin-bottom:10px}
.mc-value{font-size:24px;font-weight:700;color:${D.ICE};letter-spacing:0.5px}
.mc-detail{font-size:14px;font-weight:500;color:${D.MUTED};margin-top:8px;
  line-height:1.3}

/* ── Footer: minimal attribution ── */
.footer{position:relative;z-index:2;padding:0 ${D.MARGIN}px 64px;margin-top:auto}
.footer-text{font-size:16px;font-weight:500;color:rgba(255,255,255,0.10);
  letter-spacing:2px}
.footer-line{width:100%;height:1px;background:${D.DIVIDER};margin-bottom:20px}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="hero">
  <div class="hero-logo">${escapeHtml(ticker)}</div>
  <div class="hero-title">${escapeHtml(title)}</div>
  <div class="hero-sub">投研笔记  ·  数据驱动的独立分析</div>
  <div class="hero-line"></div>
</div>
<div class="minicards">${cardsHtml}</div>
<div class="footer">
  <div class="footer-line"></div>
  <div class="footer-text">Yahoo Finance  ·  AI 辅助分析  ·  仅供参考</div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P2 — VERDICT  (Investment Bank Morning Note layout)
//
// 左：多头逻辑  |  中：最终判断  |  右：空头逻辑
// Looks like a research summary, NOT a table.
// ═══════════════════════════════════════════════════════════════
function buildP2(ticker, sentiment, points, risks, _accent, metrics) {
  const st = pickSentimentStyle(sentiment);

  // Verdict
  const verdictLabel = st.theme === "good" ? "偏多观察"
    : st.theme === "bad" ? "防御观望" : "中性观察";
  const verdictSub = st.theme === "good" ? "核心逻辑有支撑，但需等待验证"
    : st.theme === "bad" ? "短期压力真实，但中长期逻辑未破"
    : "多空逻辑同时成立，方向未定";

  // PE data for context
  const pe = (metrics && metrics.raw && metrics.raw.pe > 0) ? metrics.raw.pe : 0;
  const fwdPe = (metrics && metrics.raw && metrics.raw.fwdPe > 0) ? metrics.raw.fwdPe : 0;
  const effectivePE = fwdPe > 0 ? fwdPe : pe;
  const peText = effectivePE > 0 ? `PE ${effectivePE.toFixed(0)}×` : "";

  // Bull side: from points
  const bullItems = (points || []).slice(0, 3);
  while (bullItems.length < 3) bullItems.push("等待更多数据验证多头逻辑");

  // Bear side: from risks
  const bearItems = (risks || []).slice(0, 3);
  while (bearItems.length < 3) bearItems.push("关注宏观及系统性风险");

  const bullHtml = bullItems.map((p, i) => `
    <div class="arg-row bull">
      <span class="arg-num">0${i + 1}</span>
      <span class="arg-text">${escapeHtml(clampShort(p, 36))}</span>
    </div>`).join("");

  const bearHtml = bearItems.map((r, i) => `
    <div class="arg-row bear">
      <span class="arg-num">0${i + 1}</span>
      <span class="arg-text">${escapeHtml(clampShort(r, 36))}</span>
    </div>`).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
body{justify-content:flex-start}

/* ── Top: Verdict — the visual center ── */
.verdict{position:relative;z-index:2;padding:120px ${D.MARGIN}px 0;text-align:center}
.verdict-label{font-size:68px;font-weight:900;color:${D.WHITE};letter-spacing:3px}
.verdict-sub{font-size:22px;font-weight:500;color:${D.MUTED};margin-top:18px;
  max-width:600px;margin-left:auto;margin-right:auto;line-height:1.5}
.verdict-divider{width:36px;height:2px;background:${D.ICE}44;margin:32px auto 0;border-radius:1px}

/* ── PE context ── */
.pe-context{position:relative;z-index:2;padding:24px ${D.MARGIN}px 0;text-align:center;
  font-size:20px;font-weight:600;color:${D.ICE};letter-spacing:1px}

/* ── Two-column bull vs bear ── */
.columns{position:relative;z-index:2;padding:36px ${D.MARGIN}px 0;
  display:flex;gap:32px}
.col{flex:1;padding:36px 28px 32px;
  background:${D.CARD_BG};border:1px solid ${D.CARD_BORDER};border-radius:14px}
.col-header{font-size:22px;font-weight:700;letter-spacing:5px;text-align:center;
  margin-bottom:28px;padding-bottom:18px;border-bottom:1px solid ${D.DIVIDER}}
.col-header.bull-side{color:${D.ICE}}
.col-header.bear-side{color:${D.SILVER}}

.arg-row{display:flex;align-items:flex-start;gap:14px;padding:16px 0}
.arg-row + .arg-row{border-top:1px solid ${D.CARD_BORDER}}
.arg-num{font-size:16px;font-weight:700;color:${D.MUTED};min-width:24px;padding-top:2px}
.arg-text{font-size:21px;font-weight:500;color:rgba(255,255,255,0.68);line-height:1.5}

/* ── Bottom: thesis summary ── */
.thesis{position:relative;z-index:2;padding:32px ${D.MARGIN}px 100px}
.thesis-box{display:flex;align-items:flex-start;gap:16px;padding:28px 36px;
  border:1px solid ${D.DIVIDER};border-radius:12px;background:${D.CARD_BG}}
.thesis-icon{font-size:24px;color:${D.SILVER};padding-top:2px}
.thesis-text{font-size:24px;font-weight:600;color:rgba(255,255,255,0.58);
  line-height:1.55}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>

<div class="verdict">
  <div class="verdict-label">${escapeHtml(verdictLabel)}</div>
  <div class="verdict-sub">${escapeHtml(verdictSub)}</div>
  <div class="verdict-divider"></div>
</div>
${peText ? `<div class="pe-context">${escapeHtml(ticker)}  ·  ${peText}</div>` : ""}

<div class="columns">
  <div class="col">
    <div class="col-header bull-side">多 头 逻 辑</div>
    ${bullHtml}
  </div>
  <div class="col">
    <div class="col-header bear-side">空 头 逻 辑</div>
    ${bearHtml}
  </div>
</div>

<div class="thesis">
  <div class="thesis-box">
    <span class="thesis-icon">◆</span>
    <span class="thesis-text">${escapeHtml(verdictSub)}——当前阶段，保持耐心比频繁操作更重要。</span>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P3 — DEEP DIVE
//
// 3 core questions only. Each: title + two-line explanation.
// Independent cards with generous whitespace.
// No long paragraphs. No progress bars.
// ═══════════════════════════════════════════════════════════════
function buildP3(ticker, points, risks, sentiment, _accent) {
  const st = pickSentimentStyle(sentiment);

  // Build 3 question-answer pairs
  const q12 = (points || []).slice(0, 2);
  while (q12.length < 2) q12.push("后续催化事件的验证情况仍需观察");
  const q3 = (risks || []).length > 0
    ? risks[0]
    : (st.theme === "good" ? "估值溢价是否已被充分定价" : "短期技术面能否形成有效支撑");

  const questions = [
    { num: "01", q: "当前最核心的逻辑是什么？", a: clampShort(q12[0], 48) },
    { num: "02", q: st.theme === "good" ? "这个逻辑的持续性如何？"
        : st.theme === "bad" ? "利空因素何时可能缓解？"
        : "多头在押注什么关键变量？",
      a: clampShort(q12[1], 48) },
    { num: "03", q: "最大的不确定性来自哪里？",
      a: clampShort(q3, 48) },
  ];

  const cards = questions.map(q => `
    <div class="card">
      <div class="card-num">${q.num}</div>
      <div class="card-content">
        <div class="card-q">${escapeHtml(q.q)}</div>
        <div class="card-a">${escapeHtml(q.a)}</div>
      </div>
    </div>`).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
body{justify-content:flex-start}

.section-head{position:relative;z-index:2;padding:100px ${D.MARGIN}px 0}
.section-tag{display:inline-block;padding:6px 18px;border:1px solid ${D.DIVIDER};border-radius:4px;
  font-size:18px;font-weight:600;color:${D.SILVER};letter-spacing:6px;margin-bottom:24px}
.section-title{font-size:48px;font-weight:800;color:${D.WHITE};letter-spacing:0.5px}

.cards{position:relative;z-index:2;padding:52px ${D.MARGIN}px 0;
  display:flex;flex-direction:column;gap:36px}
.card{display:flex;gap:36px;padding:44px 40px;
  background:${D.CARD_BG};border:1px solid ${D.CARD_BORDER};border-radius:16px;
  align-items:flex-start}
.card-num{font-size:40px;font-weight:900;color:${D.ICE};min-width:72px;
  line-height:1;opacity:0.45}
.card-content{flex:1}
.card-q{font-size:28px;font-weight:700;color:${D.WHITE};margin-bottom:14px;
  line-height:1.35}
.card-a{font-size:22px;font-weight:500;color:rgba(255,255,255,0.50);
  line-height:1.6;max-width:700px}

.bottom-note{position:relative;z-index:2;padding:48px ${D.MARGIN}px 80px;
  font-size:17px;font-weight:500;color:rgba(255,255,255,0.10);text-align:center}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="section-head">
  <div class="section-tag">${escapeHtml(ticker)}  ·  深度拆解</div>
  <div class="section-title">三个核心问题</div>
</div>
<div class="cards">${cards}</div>
<div class="bottom-note">数据来源：Yahoo Finance + AI 辅助分析 · 仅供参考</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P4 — POLL + ACTION
//
// Poll takes 50% of vertical space.
// Disclaimer minimized to bottom ~5%.
// Interactive question IS the main visual.
// ═══════════════════════════════════════════════════════════════
const TICKER_KPI = {
  NVDA:  "持续跟踪AI芯片出货量及Blackwell量产进度",
  AAPL:  "持续跟踪iPhone换机周期及AI服务订阅转化率",
  TSLA:  "持续跟踪FSD订阅率与汽车交付数据",
  MSFT:  "持续跟踪Azure AI服务增速及Copilot企业渗透率",
  AMZN:  "持续跟踪AWS AI收入占比及零售业务利润率",
  GOOGL: "持续跟踪Google Cloud增速及AI搜索商业化进度",
  META:  "持续跟踪Reels广告加载率及AI推荐系统ROI",
};

function buildP4(ticker, sentiment, _accent) {
  const st = pickSentimentStyle(sentiment);
  const kpi = TICKER_KPI[ticker] || "持续跟踪核心业务关键指标的边际变化";

  // Poll options
  const pollOptions = st.theme === "good"
    ? ["继续持有", "等待回调加仓"]
    : st.theme === "bad"
    ? ["已减仓观察", "还在等待反弹"]
    : ["等待突破信号", "等待回调机会"];

  // Action items — 2 do, 2 don't
  const doItems = st.theme === "good"
    ? ["等回调至均线附近再考虑加仓", kpi]
    : st.theme === "bad"
    ? ["先把仓位控制在能冷静思考的水平", "关注是否出现放量止跌信号"]
    : ["保持现有仓位不轻易变动", kpi];

  const dontItems = st.theme === "good"
    ? ["不要在连续上涨后追高", "不要单票重仓超过25%"]
    : st.theme === "bad"
    ? ["不要在恐慌时做出重大决策", "不要假装利空不存在"]
    : ["不要在方向不明时重仓赌方向", "不要被任何一方叙事完全说服"];

  const doHtml = doItems.map(d => `
    <div class="act-row do">
      <span class="act-icon">+</span>
      <span class="act-text">${escapeHtml(d)}</span>
    </div>`).join("");

  const dontHtml = dontItems.map(d => `
    <div class="act-row dont">
      <span class="act-icon">−</span>
      <span class="act-text">${escapeHtml(d)}</span>
    </div>`).join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
body{justify-content:flex-start}

/* ── Poll section: 50% of page, the main visual ── */
.poll-section{position:relative;z-index:2;padding:160px ${D.MARGIN}px 0;
  text-align:center;min-height:720px;display:flex;flex-direction:column;
  justify-content:center}
.poll-q{font-size:46px;font-weight:800;color:${D.WHITE};margin-bottom:52px;
  letter-spacing:1px;line-height:1.3}
.poll-options{display:flex;gap:28px;justify-content:center}
.poll-btn{flex:1;max-width:360px;padding:56px 36px;text-align:center;
  border:1px solid ${D.DIVIDER};border-radius:18px;
  font-size:28px;font-weight:700;color:${D.WHITE};
  background:${D.CARD_BG};transition:border-color 0.3s}
.poll-btn:hover{border-color:${D.ICE}44}
.poll-btn-label{font-size:48px;display:block;margin-bottom:24px;
  color:${D.ICE};line-height:1}
.poll-cta{font-size:24px;font-weight:500;color:${D.MUTED};margin-top:44px;
  line-height:1.7}

/* ── Divider ── */
.section-divider{height:1px;background:${D.DIVIDER};margin:44px ${D.MARGIN}px 0;
  position:relative;z-index:2}

/* ── Action section: compact, below poll ── */
.actions{position:relative;z-index:2;padding:32px ${D.MARGIN}px 0}
.act-label{font-size:19px;font-weight:700;color:${D.SILVER};letter-spacing:5px;
  margin-bottom:14px}
.act-row{display:flex;align-items:center;gap:14px;padding:14px 20px;
  margin-bottom:8px;border-radius:8px;font-size:20px;font-weight:500;
  border:1px solid ${D.CARD_BORDER};background:${D.CARD_BG}}
.act-icon{font-size:18px;font-weight:700;color:${D.SILVER};min-width:24px;
  text-align:center}
.act-text{color:rgba(255,255,255,0.55);line-height:1.4}

/* ── Disclaimer: minimal, bottom ~5% ── */
.disclaimer{position:relative;z-index:2;padding:36px ${D.MARGIN}px 56px;
  text-align:center;margin-top:auto}
.disclaimer-text{font-size:14px;font-weight:500;color:rgba(255,255,255,0.08);
  line-height:1.6}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>

<div class="poll-section">
  <div class="poll-q">你怎么看 ${escapeHtml(ticker)} 当前走势？</div>
  <div class="poll-options">
    <div class="poll-btn">
      <span class="poll-btn-label">▲</span>
      ${escapeHtml(pollOptions[0])}
    </div>
    <div class="poll-btn">
      <span class="poll-btn-label">▼</span>
      ${escapeHtml(pollOptions[1])}
    </div>
  </div>
  <div class="poll-cta">评论区聊聊你的看法<br/>你的逻辑可能比我的更完整</div>
</div>

<div class="section-divider"></div>

<div class="actions">
  <div class="act-label">跟 踪 策 略</div>
  ${doHtml}
  <div class="act-label" style="margin-top:24px">回 避 误 区</div>
  ${dontHtml}
</div>

<div class="disclaimer">
  <div class="disclaimer-text">
    本文仅为公开数据整理与AI投研模型诊断，不构成任何投资建议。<br/>
    市场有风险，入市需谨慎。投资决策请基于个人独立判断。
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// Caption — real-person trader reflection
// ═══════════════════════════════════════════════════════════════
function buildCaption({ ticker, sentiment, points, risks, metrics, p1Title }) {
  const st = pickSentimentStyle(sentiment);
  const priceStr = metrics ? "（现价 $" + metrics.price.toFixed(0) + "）" : "";

  const openings = [
    "翻看" + ticker + "最近的消息面，有一条信息让我停下来想了一会儿。不是那种一眼就能看到的大新闻，而是需要串起来读才有的感觉。记录一下自己的思考过程。",
    "今晚复盘" + ticker + "，翻了几条新闻之后感觉有点意思。市场情绪近期变化明显，但我习惯先不看涨跌幅，而是把消息面过一遍再下判断。分享一下我看到的几个点。",
    "把" + ticker + "的近两周数据拉出来看了一下。表面上看是顺着大盘在走，但仔细拆开，有几个细节其实挺能说明问题的。不一定准，但至少是认真想过的。",
  ];
  const opening = openings[Math.floor(Math.random() * openings.length)];

  const phraseFns = [
    (p) => clampShort(p, 48) + "——这条信息其实挺关键的。我回头对比了一下之前几个类似阶段的市场反应，觉得市场目前对这个因素的定价还不够充分。",
    (p) => "另外一点是" + clampShort(p, 48) + "。这个信号说明基本面的支撑比表面看起来要更扎实一些。不是说现在就可以无脑做多，但至少给了一个相对清晰的分析锚点。",
    (p) => "还有一个容易被忽略的细节：" + clampShort(p, 48) + "。如果后续数据继续往这个方向验证，这个逻辑链条会越来越完整。",
  ];
  const logicItems = (points || []).slice(0, 3).map((p, i) =>
    phraseFns[i] ? phraseFns[i](p) : phraseFns[0](p));
  while (logicItems.length < 3) logicItems.push("整体来看，目前的逻辑链条还比较完整，但我习惯在乐观的时候给自己多留一分谨慎。");
  const logicBlock = logicItems.join("\n\n");

  const riskText = (risks || []).length > 0
    ? "当然，也需要看到硬币的另一面。" + clampShort(risks[0], 52) + "的风险是真实存在的。如果这个风险开始兑现，我会重新评估当前的判断。"
    : "当然，任何利好都有被市场提前消化的一天。保持敬畏比盲目乐观重要得多。";

  const stanceMap = {
    good: "总结一下我自己的想法：从中期的维度看，" + ticker + "的多头逻辑是有支撑的，不是纯情绪驱动。但在操作上我不会追高——经历过太多次\"追进去就回调\"之后，我现在更倾向于等一个回踩确认。\n\n如果关键假设被数据证伪了，要及时调整看法，不要在错误的逻辑上越走越远。",
    bad: "总结一下我自己的想法：" + ticker + "短期压力是真实的，不需要硬撑。经历过太多次\"扛到崩溃\"之后，我现在更倾向于先把仓位控制在能冷静思考的水平。但也不会在市场最恐慌的时候跟着一起恐慌。\n\n接下来我会盯着利空因素何时出现边际改善，以及技术面是否开始出现有效的止跌结构。",
    neutral: "总结一下我自己的想法：" + ticker + "目前处在典型的方向选择期。经历过太多次\"赌方向被教育\"之后，我现在的原则是——维持现有敞口，等方向确认了再动手。\n\n如果突破了就顺势而为，跌破了就认输出局。方向错了可以改，但反复横跳对心态和账户的消耗往往比方向性亏损更大。",
  };
  const stance = stanceMap[st.theme] || stanceMap.neutral;

  const disclaimer = "⚠️ 风险提示：本文仅为公开数据整理与AI投研模型诊断，不构成任何投资建议。市场有风险，入市需谨慎。";

  const tagMap = {
    AAPL: "#美股 #苹果 #AAPL #投资复盘 #理财 #每日复盘",
    NVDA: "#美股 #英伟达 #NVDA #投资复盘 #理财 #每日复盘",
    TSLA: "#美股 #特斯拉 #TSLA #投资复盘 #理财 #每日复盘",
    MSFT: "#美股 #微软 #MSFT #投资复盘 #理财 #每日复盘",
    AMZN: "#美股 #亚马逊 #AMZN #投资复盘 #理财 #每日复盘",
    GOOGL: "#美股 #谷歌 #GOOGL #投资复盘 #理财 #每日复盘",
    META: "#美股 #Meta #META #投资复盘 #理财 #每日复盘",
  };
  const tags = tagMap[ticker] || "#美股 #" + ticker + " #投资复盘 #理财 #每日复盘";

  return p1Title + " " + priceStr + "\n\n" + opening + "\n\n" + logicBlock + "\n\n" + riskText + "\n\n" + stance + "\n\n" + disclaimer + "\n\n" + tags;
}

// ═══════════════════════════════════════════════════════════════
// Master builder — produces P1-P4 HTML + caption text
// ═══════════════════════════════════════════════════════════════
function buildSlideSet({ ticker, sentiment, points, risks, metrics }) {
  const cfg = COVER_CFG[ticker] || COVER_CFG.AAPL;
  const accent = D.ACCENT; // Unified accent — no per-ticker colors
  const p1Title = pickP1Title(ticker, sentiment);
  let diagnostics = buildDiagnostics(points, risks, sentiment);

  // Merge real market data if available
  if (metrics) {
    const { mergeMetrics } = require("./dataFetcher");
    diagnostics = mergeMetrics(diagnostics, metrics);
  }

  const caption = buildCaption({ ticker, sentiment, points, risks, metrics, p1Title });

  return {
    p1: { html: buildP1(ticker, p1Title, accent, diagnostics), meta: { title: p1Title, fontSize: calcTitleFont(p1Title), diagnostics } },
    p2: { html: buildP2(ticker, sentiment, points, risks, accent, metrics), meta: {} },
    p3: { html: buildP3(ticker, points, risks, sentiment, accent), meta: {} },
    p4: { html: buildP4(ticker, sentiment, accent), meta: {} },
    caption,
  };
}

// ═══════════════════════════════════════════════════════════════
// Premium P1 builder (30%+ CTR verified — Bloomberg × 小红书)
//
// Uses the same template as metaPoster.js.
// When person photo + conflict data are available, this replaces
// the standard buildP1() in buildSlideSet().
// ═══════════════════════════════════════════════════════════════

const fs = require("fs-extra");
const path = require("path");

/** Per-ticker accent colors */
const TICKER_ACCENT = {
  NVDA: "#64D2FF", AAPL: "#A1A1A6", TSLA: "#E8A838", MSFT: "#4D9FFF",
  AMZN: "#FF9900", GOOGL: "#64D2FF", META: "#4D9FFF", ORCL: "#FF6B6B",
};

/** Per-ticker person photos (check covers/ for {ticker}.jpg or {ticker}_person.jpg) */
function getPersonPhoto(ticker) {
  const candidates = [
    path.join(process.cwd(), "covers", `${ticker.toLowerCase()}_person.jpg`),
    path.join(process.cwd(), "covers", `${ticker.toLowerCase()}.jpg`),
    // Special mappings
    ...(ticker === "META" ? [path.join(process.cwd(), "covers", "zuck.jpg")] : []),
    ...(ticker === "NVDA" ? [path.join(process.cwd(), "covers", "jensen.jpg")] : []),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const b64 = fs.readFileSync(p).toString("base64");
      return "data:image/jpeg;base64," + b64;
    }
  }
  return null;
}

/**
 * Auto-build premium P1 data from generic AI summary + market metrics.
 * Converts the weak "points/risks" into the strong "VS conflict" format.
 */
function buildPremiumP1Data({ ticker, sentiment, points, risks, metrics }) {
  const accent = TICKER_ACCENT[ticker] || "#64D2FF";
  const price = metrics?.price ? `$${metrics.price.toFixed(2)}` : "—";
  const pe = metrics?.raw?.pe > 0 ? `PE ${metrics.raw.pe.toFixed(1)}x` : "PE —";
  const mcap = metrics?.raw?.mktCap
    ? (metrics.raw.mktCap > 1e12
        ? `市值 $${(metrics.raw.mktCap / 1e12).toFixed(2)}万亿`
        : `市值 $${(metrics.raw.mktCap / 1e9).toFixed(0)}B`)
    : "市值 —";

  // Extract conflict: best point (bull) vs worst risk (bear)
  const bullPoint = (points || [])[0] || "多头逻辑";
  const bearPoint = (risks || [])[0] || (points || [])[1] || "空头逻辑";

  // Truncate for display
  const trunc = (s, max) => s.length > max ? s.slice(0, max) + "…" : s;

  // Build title from ticker + price context
  const hi52 = metrics?.raw?.hi52 || metrics?.ma50 || 0;
  const title = hi52 && metrics?.price
    ? `${ticker}从$${hi52.toFixed(0)}跌到$${metrics.price.toFixed(0)}`
    : `${ticker}关键分歧`;

  return {
    ticker,
    title,
    subLine: "现在是机会还是陷阱？",
    price,
    pe,
    mcap,
    conflictBull: trunc(bullPoint, 18),
    conflictBullSub: sentiment === "利好" ? "多头逻辑" : "关键支撑",
    conflictBear: trunc(bearPoint, 18),
    conflictBearSub: sentiment === "利空" ? "空头逻辑" : "核心风险",
    instBull: (points || [])[1] || "看多逻辑",
    instBear: (risks || [])[1] || (risks || [])[0] || "看空风险",
    trackingLabel: "🔔 持续跟踪",
    trackingItems: ["下次财报", "关键支撑位", "催化剂事件"],
    footer: "数据来源: Yahoo Finance · AI辅助分析 · 仅供参考",
    accent,
    personPhotoUrl: getPersonPhoto(ticker) || undefined,
  };
}

/**
 * Premium P1 HTML — same as metaPoster.js P1.
 * Uses 1242×1660 canvas (not 1080×1440).
 */
function buildPremiumP1(data) {
  function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function calcFont(title, maxWidth, maxSize) {
    const cjk = (title.match(/[一-鿿]/g) || []).length;
    const est = cjk * 1.0 + (title.length - cjk) * 0.55;
    return Math.floor(Math.min(maxSize, maxWidth / Math.max(est, 1)) * 0.95);
  }

  const fsTitle = calcFont(data.title, 943, 88);
  const fsSub = calcFont(data.subLine, 943, 69);
  const trackingHtml = (data.trackingItems || []).map(t => `<span class="track-chip">${esc(t)}</span>`).join("");
  const photoHtml = data.personPhotoUrl ? `<img class="person-img" src="${esc(data.personPhotoUrl)}" />` : "";

  const cssBase = `*{margin:0;padding:0;box-sizing:border-box}body{width:1242px;height:1660px;overflow:hidden;position:relative;font-family:-apple-system,"PingFang SC","MiSans","Microsoft YaHei",sans-serif;font-weight:700;display:flex;flex-direction:column;justify-content:space-between;background:#080c12}.bg-grid{position:absolute;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px);background-size:72px 72px}.bg-glow{position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle at center,${data.accent}12 0%,transparent 70%);top:10%;left:50%;transform:translate(-50%,0);filter:blur(90px);pointer-events:none;z-index:0}`;

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase}

.person-layer{position:absolute;right:0;top:0;width:400px;height:1660px;z-index:1;pointer-events:none;overflow:hidden}
.person-img{position:absolute;right:-20px;top:100px;width:400px;height:auto;opacity:0.50;filter:grayscale(20%) brightness(1.05) contrast(1.1)}
.person-glow{position:absolute;right:0;top:40px;width:400px;height:600px;background:radial-gradient(ellipse at 38% 32%,${data.accent}1a 0%,transparent 65%);pointer-events:none;z-index:0;filter:blur(50px)}
.person-gradient{position:absolute;left:0;top:0;width:320px;height:100%;background:linear-gradient(to left,transparent 0%,#080c12 100%);z-index:2}

.p1-main{position:relative;z-index:3;display:flex;flex-direction:column;height:100%;padding:160px 74px 140px}

.p1-top-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}
.p1-tag{display:inline-flex;align-items:center;gap:12px;padding:8px 25px;border:1px solid ${data.accent}44;border-radius:5px;font-size:25px;font-weight:700;color:${data.accent};letter-spacing:4px}
.p1-tag-dot{width:8px;height:8px;border-radius:50%;background:${data.accent};box-shadow:0 0 10px ${data.accent}88}

.p1-title-block{margin-bottom:50px;max-width:1050px}
.p1-title{font-size:${fsTitle}px;font-weight:900;line-height:1.0;color:#fff;white-space:nowrap;letter-spacing:1.5px;text-shadow:0 0 140px ${data.accent}28}
.p1-subline{font-size:${fsSub}px;font-weight:800;line-height:1.08;color:${data.accent};letter-spacing:1.5px;margin-top:20px;text-shadow:0 0 50px ${data.accent}22;max-width:950px}

.p1-data-row{display:flex;gap:0;margin-bottom:44px;border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);padding:16px 0}
.p1-data-item{flex:1;text-align:center;border-right:1px solid rgba(255,255,255,0.04)}
.p1-data-item:last-child{border-right:none}
.p1-data-val{font-size:40px;font-weight:900;color:#fff;letter-spacing:1px}
.p1-data-label{font-size:22px;font-weight:600;color:rgba(255,255,255,0.28);margin-top:5px;letter-spacing:1px}

.p1-conflict{display:flex;align-items:stretch;gap:0;margin-bottom:40px;border:2px solid rgba(255,255,255,0.12);border-radius:12px;overflow:hidden;background:rgba(255,255,255,0.02)}
.p1-conflict-side{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:44px 28px}
.p1-conflict-up{background:rgba(34,197,94,0.08)}
.p1-conflict-down{background:rgba(239,68,68,0.08)}
.p1-conflict-num{font-size:36px;font-weight:900;letter-spacing:1px}
.p1-conflict-num.green{color:#22c55e}
.p1-conflict-num.red{color:#ef4444}
.p1-conflict-label{font-size:20px;font-weight:700;color:rgba(255,255,255,0.45);margin-top:8px;letter-spacing:1px}
.p1-conflict-vs{display:flex;align-items:center;justify-content:center;padding:0 22px;background:rgba(255,255,255,0.02)}
.p1-conflict-vs-text{font-size:24px;font-weight:900;color:rgba(255,255,255,0.2)}

.p1-institutional{display:flex;align-items:stretch;gap:0;margin-bottom:36px;border:1px solid rgba(255,255,255,0.06);border-radius:9px;overflow:hidden;background:rgba(255,255,255,0.01)}
.p1-inst-bull{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 20px;font-size:30px;font-weight:800;color:rgba(100,210,255,0.75);letter-spacing:1px}
.p1-inst-vs{display:flex;align-items:center;justify-content:center;padding:0 18px;font-size:22px;font-weight:700;color:rgba(255,255,255,0.15);letter-spacing:3px}
.p1-inst-bear{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 20px;font-size:30px;font-weight:800;color:rgba(239,68,68,0.75);letter-spacing:1px}

.p1-tracking{display:flex;align-items:center;gap:24px;margin-bottom:16px;padding:16px 28px;border:1px solid ${data.accent}18;border-radius:7px;background:${data.accent}04}
.p1-track-label{font-size:22px;font-weight:700;color:${data.accent};letter-spacing:1px;white-space:nowrap}
.track-chip{font-size:22px;font-weight:600;color:rgba(255,255,255,0.45);padding:9px 15px;border:1px solid rgba(255,255,255,0.06);border-radius:5px;background:rgba(255,255,255,0.02)}

.p1-divider{width:100%;height:1px;background:rgba(255,255,255,0.04);margin-top:auto;margin-bottom:12px}
.p1-footer-text{font-size:18px;font-weight:600;color:rgba(255,255,255,0.1);letter-spacing:1px}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="person-layer"><div class="person-glow"></div>${photoHtml}<div class="person-gradient"></div></div>
<div class="p1-main">
<div class="p1-top-row"><div class="p1-tag"><span class="p1-tag-dot"></span>${esc(data.ticker)} · 投研诊断</div></div>
<div class="p1-title-block"><div class="p1-title">${esc(data.title)}</div><div class="p1-subline">${esc(data.subLine)}</div></div>
<div class="p1-data-row">
<div class="p1-data-item"><div class="p1-data-val">${esc(data.price)}</div><div class="p1-data-label">现价</div></div>
<div class="p1-data-item"><div class="p1-data-val">${esc(data.pe)}</div><div class="p1-data-label">市盈率 TTM</div></div>
<div class="p1-data-item"><div class="p1-data-val">${esc(data.mcap)}</div><div class="p1-data-label">市值</div></div>
</div>
<div class="p1-conflict">
<div class="p1-conflict-side p1-conflict-up"><div class="p1-conflict-num green">${esc(data.conflictBull)}</div><div class="p1-conflict-label">${esc(data.conflictBullSub)}</div></div>
<div class="p1-conflict-vs"><div class="p1-conflict-vs-text">VS</div></div>
<div class="p1-conflict-side p1-conflict-down"><div class="p1-conflict-num red">${esc(data.conflictBear)}</div><div class="p1-conflict-label">${esc(data.conflictBearSub)}</div></div>
</div>
<div class="p1-institutional"><div class="p1-inst-bull">${esc(data.instBull)}</div><div class="p1-inst-vs">VS</div><div class="p1-inst-bear">${esc(data.instBear)}</div></div>
<div class="p1-tracking"><div class="p1-track-label">${esc(data.trackingLabel)}</div>${trackingHtml}</div>
<div class="p1-divider"></div><div class="p1-footer-text">${esc(data.footer)}</div>
</div></body></html>`;
}

/**
 * Premium slide set — uses premium P1 + existing P2-P4.
 * Call this instead of buildSlideSet() when you want the 30%+ CTR template.
 */
function buildPremiumSlideSet({ ticker, sentiment, points, risks, metrics }) {
  const p1Data = buildPremiumP1Data({ ticker, sentiment, points, risks, metrics });
  const p1Html = buildPremiumP1(p1Data);

  const accent = TICKER_ACCENT[ticker] || D.ACCENT;
  const caption = buildCaption({ ticker, sentiment, points, risks, metrics,
    p1Title: p1Data.title + " " + p1Data.subLine });

  return {
    p1: { html: p1Html, meta: { premium: true, title: p1Data.title, data: p1Data }, _viewport: { w: 1242, h: 1660 } },
    p2: { html: buildP2(ticker, sentiment, points, risks, accent, metrics), meta: {} },
    p3: { html: buildP3(ticker, points, risks, sentiment, accent), meta: {} },
    p4: { html: buildP4(ticker, sentiment, accent), meta: {} },
    caption,
  };
}

module.exports = {
  COVER_CFG, calcTitleFont, pickP1Title, buildDiagnostics, buildCaption,
  buildP1, buildP2, buildP3, buildP4, buildSlideSet,
  // V1 Premium exports
  buildPremiumP1, buildPremiumP1Data, buildPremiumSlideSet, getPersonPhoto,
  TICKER_ACCENT,
};
