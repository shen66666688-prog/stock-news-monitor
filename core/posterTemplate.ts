/**
 * posterTemplate.ts — 高CTR海报模板 (融合进 V1 统一系统)
 *
 * Baseline: metaPoster.js P1 (30%+ CTR 验证)
 * 设计语言: Bloomberg × 小红书 高密度封面
 *
 * 核心要素:
 *   - 1242×1660 画布
 *   - 人物右侧半身像 (400px, opacity 0.50)
 *   - VS 分栏冲突卡 (绿色 vs 红色)
 *   - 数据三栏 (价格 / PE / 市值)
 *   - 跟踪标签
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface PosterP1Data {
  ticker: string;
  /** 大标题: "NVDA从$236跌到$205" */
  title: string;
  /** 副标题: "现在是机会还是陷阱？" */
  subLine: string;
  /** 价格: "$205.19" */
  price: string;
  /** PE: "PE 31.4x" */
  pe: string;
  /** 市值: "市值 $4.97万亿" */
  mcap: string;
  /** 冲突卡左侧 (绿色) */
  conflictBull: string;
  /** 冲突卡左侧副标题 */
  conflictBullSub: string;
  /** 冲突卡右侧 (红色) */
  conflictBear: string;
  /** 冲突卡右侧副标题 */
  conflictBearSub: string;
  /** 第二冲突行左侧 */
  instBull: string;
  /** 第二冲突行右侧 */
  instBear: string;
  /** 跟踪标签文字 */
  trackingLabel: string;
  /** 跟踪标签项 */
  trackingItems: string[];
  /** 页脚 */
  footer: string;
  /** 强调色 */
  accent: string;
  /** 人物照片 base64 URL (可选) */
  personPhotoUrl?: string;
}

// ═══════════════════════════════════════════════════════════════
// Shared CSS (1242×1660 canvas)
// ═══════════════════════════════════════════════════════════════

export function posterBaseCSS(accent: string): string {
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
  background:radial-gradient(circle at center,${accent}12 0%,transparent 70%);
  top:10%;left:50%;transform:translate(-50%,0);filter:blur(90px);pointer-events:none;z-index:0}
`.replace(/\n/g, " ");
}

// ═══════════════════════════════════════════════════════════════
// Font calculator
// ═══════════════════════════════════════════════════════════════

export function calcTitleFont(title: string, maxWidth: number, maxSize: number): number {
  const cjkRe = /[一-鿿]/g;
  const cjk = (title.match(cjkRe) || []).length;
  const ascii = title.length - cjk;
  const estWidth = cjk * 1.0 + ascii * 0.55;
  return Math.floor(Math.min(maxSize, maxWidth / Math.max(estWidth, 1)) * 0.95);
}

// ═══════════════════════════════════════════════════════════════
// HTML escape
// ═══════════════════════════════════════════════════════════════

function esc(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ═══════════════════════════════════════════════════════════════
// P1 封面 HTML 生成器 (30%+ CTR 验证模板)
// ═══════════════════════════════════════════════════════════════

export function buildPremiumP1(data: PosterP1Data): string {
  const fsTitle = calcTitleFont(data.title, 943, 88);
  const fsSub = calcTitleFont(data.subLine, 943, 69);

  const trackingHtml = data.trackingItems
    .map((t) => `<span class="track-chip">${esc(t)}</span>`)
    .join("");

  const photoHtml = data.personPhotoUrl
    ? `<img class="person-img" src="${esc(data.personPhotoUrl)}" />`
    : "";

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${posterBaseCSS(data.accent)}

/* ── 人物 — 右侧半身像 ── */
.person-layer{position:absolute;right:0;top:0;width:400px;height:1660px;z-index:1;pointer-events:none;overflow:hidden}
.person-img{position:absolute;right:-20px;top:100px;width:400px;height:auto;opacity:0.50;filter:grayscale(20%) brightness(1.05) contrast(1.1)}
.person-glow{position:absolute;right:0;top:40px;width:400px;height:600px;background:radial-gradient(ellipse at 38% 32%,${data.accent}1a 0%,transparent 65%);pointer-events:none;z-index:0;filter:blur(50px)}
.person-gradient{position:absolute;left:0;top:0;width:320px;height:100%;background:linear-gradient(to left,transparent 0%,#080c12 100%);z-index:2}

/* ── 主内容 ── */
.p1-main{position:relative;z-index:3;display:flex;flex-direction:column;height:100%;padding:160px 74px 140px}

/* ── 顶部品牌标 ── */
.p1-top-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}
.p1-tag{display:inline-flex;align-items:center;gap:12px;padding:8px 25px;border:1px solid ${data.accent}44;border-radius:5px;font-size:25px;font-weight:700;color:${data.accent};letter-spacing:4px}
.p1-tag-dot{width:8px;height:8px;border-radius:50%;background:${data.accent};box-shadow:0 0 10px ${data.accent}88}

/* ── 标题 ── */
.p1-title-block{margin-bottom:50px;max-width:1050px}
.p1-title{font-size:${fsTitle}px;font-weight:900;line-height:1.0;color:#fff;white-space:nowrap;letter-spacing:1.5px;text-shadow:0 0 140px ${data.accent}28}
.p1-subline{font-size:${fsSub}px;font-weight:800;line-height:1.08;color:${data.accent};letter-spacing:1.5px;margin-top:20px;text-shadow:0 0 50px ${data.accent}22;max-width:950px}

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

/* ── 第二冲突行 ── */
.p1-institutional{display:flex;align-items:stretch;gap:0;margin-bottom:36px;border:1px solid rgba(255,255,255,0.06);border-radius:9px;overflow:hidden;background:rgba(255,255,255,0.01)}
.p1-inst-bull{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 20px;font-size:30px;font-weight:800;color:rgba(100,210,255,0.75);letter-spacing:1px}
.p1-inst-vs{display:flex;align-items:center;justify-content:center;padding:0 18px;font-size:22px;font-weight:700;color:rgba(255,255,255,0.15);letter-spacing:3px}
.p1-inst-bear{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 20px;font-size:30px;font-weight:800;color:rgba(239,68,68,0.75);letter-spacing:1px}

/* ── 跟踪标签 ── */
.p1-tracking{display:flex;align-items:center;gap:24px;margin-bottom:16px;padding:16px 28px;border:1px solid ${data.accent}18;border-radius:7px;background:${data.accent}04}
.p1-track-label{font-size:22px;font-weight:700;color:${data.accent};letter-spacing:1px;white-space:nowrap}
.track-chip{font-size:22px;font-weight:600;color:rgba(255,255,255,0.45);padding:9px 15px;border:1px solid rgba(255,255,255,0.06);border-radius:5px;background:rgba(255,255,255,0.02)}

/* ── 页脚 ── */
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
