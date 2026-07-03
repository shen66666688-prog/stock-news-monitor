/* eslint-disable no-console */
/**
 * dynamicPoster.js — AI 动态数据 × metaPoster 模板
 *
 * 从 AI Pipeline 拿实时分析 + Yahoo 拿股价，
 * 套入 metaPoster.js 的 P1-P4 模板（30%+ CTR 验证）。
 *
 * 用法：node scripts/dynamicPoster.js AAPL
 */

const fs = require("fs-extra");
const path = require("path");
const { execSync } = require("child_process");
const { renderSlideSet, closeBrowser } = require("./screenshotService");

const BASE_URL = process.env.LOCAL_BASE_URL || "http://localhost:3000";
const PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "http://127.0.0.1:7892";

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function clamp(s, max) { const t = String(s||"").trim(); return t.length > max ? t.slice(0,max-1)+"…" : t; }

// ═══════════════════════════════════════
// Fetch AI summary from local API
// ═══════════════════════════════════════
async function fetchAISummary(ticker) {
  const url = `${BASE_URL}/api/stocks/${ticker}/summary`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  const s = json.summary;
  return {
    ticker,
    title: s.title || `${ticker} 今日投研`,
    sentiment: s.sentiment || "中性",
    points: (s.points || []).slice(0, 5),
    risks: (s.risks || []).slice(0, 5),
    hook: s.hook || "",
  };
}

// ═══════════════════════════════════════
// Fetch real price data via curl (Yahoo API)
// ═══════════════════════════════════════
function fetchMetrics(ticker) {
  try {
    // Part 1: Price + 52-week from chart v8 API (reliable)
    const raw = execSync(
      `curl -x "${PROXY}" -s "https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3mo&includePrePost=false" --connect-timeout 10 -H "User-Agent: Mozilla/5.0"`,
      { encoding: "utf-8", maxBuffer: 512*1024, timeout: 15000 }
    );
    const meta = JSON.parse(raw)?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    // Part 2: PE + market cap from Yahoo Finance HTML page
    let pe = 0, mktCap = 0;
    try {
      const html = execSync(
        `curl -x "${PROXY}" -s --compressed "https://finance.yahoo.com/quote/${ticker}/" --connect-timeout 15 --max-time 30 -H "User-Agent: Mozilla/5.0" -H "Accept-Encoding: gzip, deflate"`,
        { encoding: "utf-8", maxBuffer: 2*1024*1024, timeout: 35000 }
      );
      // Extract from <fin-streamer> elements
      const peMatch = html.match(/data-field="trailingPE"[^>]*>([^<]+)</);
      if (peMatch && peMatch[1]) {
        pe = parseFloat(peMatch[1].replace(/,/g, "")) || 0;
      }
      const mcMatch = html.match(/data-field="marketCap"[^>]*>([^<]+)</);
      if (mcMatch && mcMatch[1]) {
        const mcRaw = mcMatch[1].trim();
        // Parse "4.533T" or "453.3B" format
        if (mcRaw.endsWith("T")) mktCap = parseFloat(mcRaw) * 1e12;
        else if (mcRaw.endsWith("B")) mktCap = parseFloat(mcRaw) * 1e9;
        else mktCap = parseFloat(mcRaw.replace(/,/g, "")) || 0;
      }
    } catch (e) {
      console.warn(`   ⚠️ PE/mktCap HTML parsing failed for ${ticker}: ${e.message}`);
    }

    return {
      price: meta.regularMarketPrice,
      pe,
      mktCap: mktCap || meta.marketCap || 0,
      hi52: meta.fiftyTwoWeekHigh || meta.regularMarketPrice,
      lo52: meta.fiftyTwoWeekLow || 0,
    };
  } catch { return null; }
}

// ═══════════════════════════════════════
// Build metaPoster-compatible data from AI + metrics
// ═══════════════════════════════════════
function buildPosterData(ai, m) {
  const { ticker, title, sentiment, points, risks, hook } = ai;
  const isGood = sentiment.includes("利好");
  const isBad = sentiment.includes("利空");

  const price = m ? `$${m.price.toFixed(2)}` : "—";
  const pe = m?.pe > 0 ? `PE ${m.pe.toFixed(1)}` : "PE —";
  const mcap = m?.mktCap > 1e12
    ? `市值 $${(m.mktCap/1e12).toFixed(2)}万亿`
    : m?.mktCap > 0 ? `市值 $${(m.mktCap/1e9).toFixed(0)}B` : "市值 —";

  const p1Title = hook || title;

  return {
    ticker, title: p1Title,
    subLine: m ? "现在是机会还是陷阱？" : "今日投研诊断",
    price, pe, mcap,
    conflict1: clamp(points[0] || (isGood ? "多头逻辑占优" : "多空分歧"), 30),
    conflict2: clamp(risks[0] || points[1] || (isBad ? "短期风险加大" : "估值待验证"), 30),
    institutionalBull: clamp(points[1] || points[0] || "多头逻辑", 24),
    institutionalBear: clamp(risks[1] || risks[0] || "空头逻辑", 24),
    trackingLabel: "🔔 持续跟踪",
    trackingItems: [
      clamp(points[0] || "关键催化", 12),
      clamp(risks[0] || "风险信号", 12),
      "下次财报",
    ],

    // P2
    p2_verdict_emoji: isBad ? "🔴" : isGood ? "🟢" : "🟡",
    p2_verdict_label: isBad ? "需要警惕" : isGood ? "占优逻辑" : "多空拉锯",
    p2_verdict_sub: clamp(hook || title, 60),
    p2_items: [
      { num: "①", label: "核心逻辑", detail: clamp(points[0] || "多头支撑", 100) },
      { num: "②", label: "主要风险", detail: clamp(risks[0] || "空头压力", 100) },
      { num: "③", label: "短期催化", detail: clamp(points[1] || points[0] || "等待信号", 100) },
      { num: "④", label: "市场分歧", detail: clamp(risks[1] || risks[0] || "持续跟踪", 100) },
    ],
    p2_oneliner: `${clamp(points[0]||"多头有支撑", 40)}。但${clamp(risks[0]||"风险同样真实", 40)}。关键不在于方向判断，而在于你是否愿意承受中间的波动。`,

    // P3
    p3_title: "AI 分析：3 个关键问题",
    p3_tag: `${ticker} · AI 诊断`,
    p3_items: [
      { q: `① ${clamp(points[0] || "核心驱动", 30)}`, a: (points[0]||"") + (points[1] ? "。" + points[1] : "") + "。" + (hook||"市场正在重新定价。"), pct: 85 },
      { q: `② ${clamp(risks[0] || "主要风险", 30)}`,  a: (risks[0]||"") + (risks[1] ? "。" + risks[1] : "") + "。这构成了当前最主要的空头逻辑。", pct: 70 },
      { q: `③ ${clamp(points[2] || points[1] || points[0] || "关键变量", 30)}`, a: (points[2]||points[1]||points[0]||"") + "。这个变量的走向将决定未来几个月的方向。", pct: 60 },
    ],

    // P4
    p4_title: "操作 & 跟踪清单",
    p4_tag: `${ticker} · 操作指南`,
    p4_conclusion: `${clamp(points[0]||"多头有据", 40)}。但${clamp(risks[0]||"风险不可忽视", 40)}。当前最好的策略是保持信息更新、控制仓位。`,
    p4_signals: [
      { signal: clamp(points[0] ? points[0].slice(0,20) : "核心催化", 20), desc: clamp(risks[0]||"若逻辑证伪需重新评估", 30) },
      { signal: "下一财报/事件", desc: clamp(points[1]||"关键验证节点", 30) },
      { signal: clamp(risks[1] ? risks[1].slice(0,20) : "关键风险位", 20), desc: clamp(points[2]||"技术面或基本面信号", 30) },
    ],
    p4_follow_cta: `关注我，${ticker} 信号触发时你会收到分析。`,
    footer: `数据来源：Yahoo Finance + DeepSeek AI · 仅供参考 · 非投资建议`,
  };
}

// ═══════════════════════════════════════
// ACCENT — per-ticker color
// ═══════════════════════════════════════
const TICKER_COLORS = { AAPL:"#A0A0A0", NVDA:"#76B900", TSLA:"#E82127", MSFT:"#00A4EF", AMZN:"#FF9900", GOOGL:"#4285F4", META:"#4D9FFF" };
function getAccent(ticker) { return TICKER_COLORS[ticker] || "#64D2FF"; }

// ═══════════════════════════════════════
// CSS base (EXACT metaPoster.js clone)
// ═══════════════════════════════════════
function cssBase(accent) {
  return `*{margin:0;padding:0;box-sizing:border-box}body{width:1242px;height:1660px;overflow:hidden;position:relative;font-family:-apple-system,"PingFang SC","MiSans","Microsoft YaHei",sans-serif;font-weight:700;display:flex;flex-direction:column;justify-content:space-between;background:#080c12}.bg-grid{position:absolute;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px);background-size:72px 72px}.bg-glow{position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle at center,${accent}12 0%,transparent 70%);top:10%;left:50%;transform:translate(-50%,0);filter:blur(90px);pointer-events:none;z-index:0}`;
}

function calcTitleFont(title, maxWidth, maxSize) {
  const cjkRe = /[一-鿿]/g;
  const cjk = (title.match(cjkRe) || []).length;
  const ascii = title.length - cjk;
  const estWidth = cjk * 1.0 + ascii * 0.55;
  return Math.floor(Math.min(maxSize, maxWidth / Math.max(estWidth, 1)) * 0.95);
}

function getPersonPhoto(ticker) {
  const candidates = [
    path.join(process.cwd(), "covers", `${ticker.toLowerCase()}.jpg`),
    path.join(process.cwd(), "covers", `${ticker.toLowerCase()}_person.jpg`),
    ...(ticker === "META" ? [path.join(process.cwd(), "covers", "zuck.jpg")] : []),
    ...(ticker === "NVDA" ? [path.join(process.cwd(), "covers", "jensen.jpg")] : []),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return "data:image/jpeg;base64," + fs.readFileSync(p).toString("base64");
    }
  }
  return null;
}

// ═══════════════════════════════════════
// P1 — EXACT metaPoster.js P1 clone
// ═══════════════════════════════════════
function buildP1(data, photoUrl) {
  const accent = getAccent(data.ticker);
  const fsTitle = calcTitleFont(data.title, 943, 88);
  const fsSub = calcTitleFont(data.subLine, 943, 69);
  const trackingHtml = data.trackingItems.map(t => `<span class="track-chip">${esc(t)}</span>`).join("");
  const photoHtml = photoUrl ? `<img class="p1-person" src="${esc(photoUrl)}" />` : "";

  const hasPhoto = !!photoUrl;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase(accent)}
${hasPhoto ? `.person-layer{position:absolute;right:0;top:0;width:400px;height:1660px;z-index:1;pointer-events:none;overflow:hidden}.p1-person{position:absolute;right:-20px;top:100px;width:400px;height:auto;opacity:0.50;filter:grayscale(10%) brightness(1.05) contrast(1.1)}.person-glow{position:absolute;right:0;top:40px;width:400px;height:600px;background:radial-gradient(ellipse at 38% 32%, ${accent}1a 0%, transparent 65%);pointer-events:none;z-index:0;filter:blur(50px)}.person-gradient{position:absolute;left:0;top:0;width:320px;height:100%;background:linear-gradient(to left, transparent 0%, #080c12 100%);z-index:2}` : ""}
.p1-main{position:relative;z-index:3;display:flex;flex-direction:column;height:100%;padding:160px 74px 140px}
.p1-top-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}
.p1-tag{display:inline-flex;align-items:center;gap:12px;padding:8px 25px;border:1px solid ${accent}44;border-radius:5px;font-size:25px;font-weight:700;color:${accent};letter-spacing:4px}
.p1-tag-dot{width:8px;height:8px;border-radius:50%;background:${accent};box-shadow:0 0 10px ${accent}88}
.p1-title-block{margin-bottom:50px;max-width:1050px}
.p1-title{font-size:${fsTitle}px;font-weight:900;line-height:1.0;color:#fff;white-space:nowrap;letter-spacing:1.5px;text-shadow:0 0 140px ${accent}28}
.p1-subline{font-size:${fsSub}px;font-weight:800;line-height:1.08;color:${accent};letter-spacing:1.5px;margin-top:20px;text-shadow:0 0 50px ${accent}22;max-width:950px}
.p1-data-row{display:flex;gap:0;margin-bottom:44px;border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);padding:16px 0}
.p1-data-item{flex:1;text-align:center;border-right:1px solid rgba(255,255,255,0.04)}
.p1-data-item:last-child{border-right:none}
.p1-data-val{font-size:40px;font-weight:900;color:#fff;letter-spacing:1px}
.p1-data-label{font-size:22px;font-weight:600;color:rgba(255,255,255,0.28);margin-top:5px;letter-spacing:1px}
.p1-conflict{display:flex;align-items:stretch;gap:0;margin-bottom:40px;border:2px solid rgba(255,255,255,0.12);border-radius:12px;overflow:hidden;background:rgba(255,255,255,0.02)}
.p1-conflict-side{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:44px 28px}
.p1-conflict-up{background:rgba(34,197,94,0.08)}.p1-conflict-down{background:rgba(239,68,68,0.08)}
.p1-conflict-num{font-size:48px;font-weight:900;letter-spacing:2px}.p1-conflict-num.green{color:#22c55e}.p1-conflict-num.red{color:#ef4444}
.p1-conflict-label{font-size:20px;font-weight:700;color:rgba(255,255,255,0.45);margin-top:8px;letter-spacing:1px}
.p1-conflict-vs{display:flex;align-items:center;justify-content:center;padding:0 22px;background:rgba(255,255,255,0.02)}
.p1-conflict-vs-text{font-size:24px;font-weight:900;color:rgba(255,255,255,0.2)}
.p1-institutional{display:flex;align-items:stretch;gap:0;margin-bottom:36px;border:1px solid rgba(255,255,255,0.06);border-radius:9px;overflow:hidden;background:rgba(255,255,255,0.01)}
.p1-inst-bull{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 20px;font-size:26px;font-weight:800;color:rgba(34,197,94,0.75);letter-spacing:1px}
.p1-inst-vs{display:flex;align-items:center;justify-content:center;padding:0 18px;font-size:22px;font-weight:700;color:rgba(255,255,255,0.15);letter-spacing:3px}
.p1-inst-bear{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 20px;font-size:26px;font-weight:800;color:rgba(239,68,68,0.75);letter-spacing:1px}
.p1-tracking{display:flex;align-items:center;gap:24px;margin-bottom:16px;padding:16px 28px;border:1px solid ${accent}18;border-radius:7px;background:${accent}04}
.p1-track-label{font-size:22px;font-weight:700;color:${accent};letter-spacing:1px;white-space:nowrap}
.track-chip{font-size:22px;font-weight:600;color:rgba(255,255,255,0.45);padding:9px 15px;border:1px solid rgba(255,255,255,0.06);border-radius:5px;background:rgba(255,255,255,0.02)}
.p1-divider{width:100%;height:1px;background:rgba(255,255,255,0.04);margin-top:auto;margin-bottom:12px}
.p1-footer-text{font-size:18px;font-weight:600;color:rgba(255,255,255,0.1);letter-spacing:1px}
</style></head><body><div class="bg-grid"></div><div class="bg-glow"></div>
${hasPhoto ? `<div class="person-layer"><div class="person-glow"></div>${photoHtml}<div class="person-gradient"></div></div>` : ""}
<div class="p1-main">
<div class="p1-top-row"><div class="p1-tag"><span class="p1-tag-dot"></span>${esc(data.ticker)} · 投研诊断</div></div>
<div class="p1-title-block"><div class="p1-title">${esc(data.title)}</div><div class="p1-subline">${esc(data.subLine)}</div></div>
<div class="p1-data-row"><div class="p1-data-item"><div class="p1-data-val">${esc(data.price)}</div><div class="p1-data-label">现价</div></div><div class="p1-data-item"><div class="p1-data-val">${esc(data.pe)}</div><div class="p1-data-label">市盈率 TTM</div></div><div class="p1-data-item"><div class="p1-data-val">${esc(data.mcap)}</div><div class="p1-data-label">市值</div></div></div>
<div class="p1-conflict"><div class="p1-conflict-side p1-conflict-up"><div class="p1-conflict-num green">${esc(data.conflict1)}</div><div class="p1-conflict-label">关键多头逻辑</div></div><div class="p1-conflict-vs"><div class="p1-conflict-vs-text">VS</div></div><div class="p1-conflict-side p1-conflict-down"><div class="p1-conflict-num red">${esc(data.conflict2)}</div><div class="p1-conflict-label">核心空头逻辑</div></div></div>
<div class="p1-institutional"><div class="p1-inst-bull">${esc(data.institutionalBull)}</div><div class="p1-inst-vs">VS</div><div class="p1-inst-bear">${esc(data.institutionalBear)}</div></div>
<div class="p1-tracking"><div class="p1-track-label">${esc(data.trackingLabel)}</div>${trackingHtml}</div>
<div class="p1-divider"></div><div class="p1-footer-text">${esc(data.footer)}</div>
</div></body></html>`;
}

// ═══════════════════════════════════════
// P2 — EXACT metaPoster.js P2 clone
// ═══════════════════════════════════════
function buildP2(data) {
  const accent = getAccent(data.ticker);
  const rows = data.p2_items.map(item => `<div class="sc-row"><div class="sc-num">${item.num}</div><div class="sc-label">${item.label}</div><div class="sc-detail">${esc(item.detail)}</div></div>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase(accent)}
.verdict-top{position:relative;z-index:2;padding:72px 72px 0;display:flex;align-items:center;gap:20px}
.verdict-emoji{font-size:60px}.verdict-text{font-size:50px;font-weight:900;color:#fff;letter-spacing:2px}
.verdict-sub{font-size:28px;color:rgba(255,255,255,0.4);margin-top:8px;padding-left:80px;position:relative;z-index:2}
.scorecard{position:relative;z-index:2;padding:36px 72px 0;display:flex;flex-direction:column;gap:10px}
.sc-row{display:flex;align-items:flex-start;gap:16px;padding:26px 28px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);border-radius:14px}
.sc-num{font-size:30px;font-weight:800;color:${accent};min-width:42px;padding-top:2px}
.sc-label{font-size:28px;font-weight:700;color:rgba(255,255,255,0.85);min-width:140px}
.sc-detail{font-size:24px;color:rgba(255,255,255,0.55);flex:1;line-height:1.45}
.one-liner{position:relative;z-index:2;padding:32px 72px 80px}
.one-liner-box{display:flex;align-items:center;gap:14px;padding:28px 36px;border:1px solid ${accent}44;border-radius:16px;background:${accent}08}
.one-liner-icon{font-size:32px}.one-liner-text{font-size:30px;font-weight:700;color:#fff;line-height:1.4}
</style></head><body><div class="bg-grid"></div><div class="bg-glow"></div>
<div class="verdict-top"><div class="verdict-emoji">${data.p2_verdict_emoji}</div><div class="verdict-text">${data.p2_verdict_label}</div></div>
<div class="verdict-sub">${data.p2_verdict_sub}</div><div class="scorecard">${rows}</div>
<div class="one-liner"><div class="one-liner-box"><span class="one-liner-icon">💡</span><span class="one-liner-text">${esc(data.p2_oneliner)}</span></div></div>
</body></html>`;
}

// ═══════════════════════════════════════
// P3 — EXACT metaPoster.js P3 clone
// ═══════════════════════════════════════
function buildP3(data) {
  const accent = getAccent(data.ticker);
  const cards = data.p3_items.map(item => `<div class="card"><div class="card-q">${esc(item.q)}</div><div class="card-a">${esc(item.a)}</div><div class="card-bar"><div class="card-bar-fill" style="width:${item.pct}%;background:${accent}"></div></div></div>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase(accent)}
.section-head{position:relative;z-index:2;padding:72px 72px 0}
.section-tag{display:inline-block;padding:8px 24px;border:1px solid ${accent}55;border-radius:6px;font-size:24px;font-weight:700;color:${accent};letter-spacing:4px;margin-bottom:18px}
.section-title{font-size:52px;font-weight:900;color:#fff;letter-spacing:1px}
.cards{position:relative;z-index:2;padding:30px 72px 0;display:flex;flex-direction:column;gap:12px}
.card{padding:26px 32px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);border-radius:16px;border-left:4px solid ${accent}55}
.card-q{font-size:30px;font-weight:800;color:#fff;margin-bottom:10px;line-height:1.3}
.card-a{font-size:24px;font-weight:600;color:rgba(255,255,255,0.62);line-height:1.45;margin-bottom:14px}
.card-bar{height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden}.card-bar-fill{height:100%;border-radius:3px}
.bottom-note{position:relative;z-index:2;padding:40px 72px 80px;text-align:center;font-size:20px;color:rgba(255,255,255,0.2)}
</style></head><body><div class="bg-grid"></div><div class="bg-glow"></div>
<div class="section-head"><div class="section-tag">${esc(data.p3_tag)}</div><div class="section-title">${esc(data.p3_title)}</div></div>
<div class="cards">${cards}</div><div class="bottom-note">${esc(data.footer)}</div></body></html>`;
}

// ═══════════════════════════════════════
// P4 — EXACT metaPoster.js P4 clone
// ═══════════════════════════════════════
function buildP4(data) {
  const accent = getAccent(data.ticker);
  const signalItems = data.p4_signals.map(s => `<div class="signal-row"><span class="signal-dot"></span><span class="signal-label">${esc(s.signal)}</span><span class="signal-desc">${esc(s.desc)}</span></div>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase(accent)}
.section-top{position:relative;z-index:2;padding:64px 72px 0}
.section-tag{display:inline-block;padding:8px 24px;border:1px solid ${accent}55;border-radius:6px;font-size:24px;font-weight:700;color:${accent};letter-spacing:4px;margin-bottom:18px}
.section-title{font-size:50px;font-weight:900;color:#fff;letter-spacing:2px}
.conclusion-box{position:relative;z-index:2;padding:28px 72px 0}
.conclusion-text{font-size:28px;font-weight:700;color:rgba(255,255,255,0.7);line-height:1.5}
.tracker-box{position:relative;z-index:2;padding:30px 72px 0}
.tracker-title{font-size:32px;font-weight:800;color:${accent};letter-spacing:1px;margin-bottom:16px}
.signal-row{display:flex;align-items:center;gap:14px;padding:14px 22px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:10px;margin-bottom:8px}
.signal-dot{width:8px;height:8px;border-radius:50%;background:${accent};box-shadow:0 0 8px ${accent}66;min-width:8px}
.signal-label{font-size:26px;font-weight:700;color:#fff;min-width:200px}
.signal-desc{font-size:22px;color:rgba(255,255,255,0.45)}
.follow-cta{position:relative;z-index:2;padding:20px 72px 0;text-align:center}
.follow-cta-text{font-size:30px;font-weight:700;color:${accent};letter-spacing:1px}
.poll{position:relative;z-index:2;padding:28px 72px 40px}
.poll-q{font-size:34px;font-weight:800;color:#fff;text-align:center;margin-bottom:22px}
.poll-btns{display:flex;gap:20px;justify-content:center}
.poll-btn{flex:1;max-width:350px;padding:28px 20px;text-align:center;border:2px solid ${accent}44;border-radius:16px;font-size:28px;font-weight:700;color:#fff;background:${accent}06}
.poll-cta{text-align:center;margin-top:20px;font-size:24px;color:rgba(255,255,255,0.25)}
.disclaimer-block{position:relative;z-index:2;padding:0 72px 60px;text-align:center}
.disclaimer-text{font-size:20px;color:rgba(255,255,255,0.18);line-height:1.6}
</style></head><body><div class="bg-grid"></div><div class="bg-glow"></div>
<div class="section-top"><div class="section-tag">${esc(data.p4_tag)}</div><div class="section-title">${esc(data.p4_title)}</div></div>
<div class="conclusion-box"><div class="conclusion-text">${esc(data.p4_conclusion)}</div></div>
<div class="tracker-box"><div class="tracker-title">🔔 ${data.ticker} 已进入持续跟踪名单</div>${signalItems}</div>
<div class="follow-cta"><div class="follow-cta-text">${esc(data.p4_follow_cta)}</div></div>
<div class="poll"><div class="poll-q">👇 你现在怎么操作？</div><div class="poll-btns"><div class="poll-btn">🟢 我持有<br/>继续拿着</div><div class="poll-btn">🔴 我已减仓<br/>或清仓了</div><div class="poll-btn">🟡 空仓观望<br/>等催化剂</div></div><div class="poll-cta">扣1继续持有 | 扣2准备减仓 | 扣3空仓观望<br/>评论区看看多空比例 👇</div></div>
<div class="disclaimer-block"><div class="disclaimer-text">风险提示：本文仅为公开数据整理与AI辅助分析，不构成任何投资建议。<br/>市场有风险，入市需谨慎。投资决策请基于个人独立判断。</div></div>
</body></html>`;
}

// ═══════════════════════════════════════
// Main
// ═══════════════════════════════════════
(async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();

  console.log(`\n🚀 dynamicPoster — ${ticker}`);
  console.log("📡 拉取 AI 分析…");
  const ai = await fetchAISummary(ticker);
  console.log(`   Title: ${ai.title}`);
  console.log(`   Sentiment: ${ai.sentiment}`);
  console.log(`   Points: ${ai.points.length} | Risks: ${ai.risks.length}`);

  console.log("📊 拉取实时股价…");
  const m = fetchMetrics(ticker);
  if (m) console.log(`   $${m.price}  PE=${m.pe.toFixed(1)}  Hi52=$${m.hi52.toFixed(0)}`);
  else console.log("   ⚠️ 无法获取实时数据");

  const photoUrl = getPersonPhoto(ticker);
  if (photoUrl) console.log("📸 人物照片已加载");

  const data = buildPosterData(ai, m);
  const outDir = path.join(process.cwd(), "covers", `${ticker}_${new Date().toISOString().slice(0,10).replace(/-/g,"")}`);
  await fs.ensureDir(outDir);

  const slides = {
    p1: { html: buildP1(data, photoUrl) },
    p2: { html: buildP2(data) },
    p3: { html: buildP3(data) },
    p4: { html: buildP4(data) },
  };

  console.log("🎨 渲染 4 张海报…");
  const results = await renderSlideSet(ticker, slides, outDir, { viewportWidth: 1242, viewportHeight: 1660 });

  for (const r of results) {
    if (!r.error) console.log(`✅ ${r.name} (${r.sizeKB}KB)`);
    else console.log(`❌ ${r.name}: ${r.error}`);
  }

  // Save data for reference
  await fs.writeJson(path.join(outDir, "poster_data.json"), data, { spaces: 2 });

  await closeBrowser();
  console.log(`\n🎉 完成 → ${outDir}\n`);
})().catch(err => {
  console.error("❌", err);
  process.exit(1);
});
