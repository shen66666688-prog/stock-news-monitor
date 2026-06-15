const fs = require("fs");
const src = fs.readFileSync("scripts/aaplFullPoster.js", "utf8");

const p4Start = src.indexOf("function buildP4(data) {");
const mainIdx = src.indexOf("async function main");
const p4End = src.lastIndexOf("\n}", mainIdx);

const newP4 = `function buildP4(data) {
  const { p4_actions } = data;

  const doHtml = p4_actions.do.map((d) =>
    \`<div class="guide-row do"><span class="guide-icon">✅</span><span>\${esc(d)}</span></div>\`
  ).join("");

  const dontHtml = p4_actions.dont.map((d) =>
    \`<div class="guide-row dont"><span class="guide-icon">❌</span><span>\${esc(d)}</span></div>\`
  ).join("");

  return \`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
\${cssBase()}
.guide-top{position:relative;z-index:2;padding:72px 72px 0}
.guide-tag{display:inline-block;padding:8px 24px;border:1px solid \${ACCENT}55;border-radius:6px;
  font-size:24px;font-weight:700;color:\${ACCENT};letter-spacing:4px;margin-bottom:20px}
.guide-title{font-size:50px;font-weight:900;color:#fff;letter-spacing:1px}

.guide-section{position:relative;z-index:2;padding:28px 72px 0}
.guide-section-title{font-size:30px;font-weight:800;color:\${ACCENT};margin-bottom:14px;letter-spacing:2px}
.guide-row{display:flex;align-items:center;gap:14px;padding:16px 22px;
  margin-bottom:8px;border-radius:10px;font-size:24px;font-weight:600}
.guide-row.do{background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.12);color:rgba(255,255,255,0.82)}
.guide-row.dont{background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.12);color:rgba(255,255,255,0.82)}
.guide-icon{font-size:28px;min-width:42px;text-align:center}

.poll{position:relative;z-index:2;padding:32px 72px 52px}
.poll-q{font-size:38px;font-weight:800;color:#fff;text-align:center;margin-bottom:28px}
.poll-btns{display:flex;gap:24px;justify-content:center}
.poll-btn{flex:1;max-width:380px;padding:28px 0;text-align:center;
  border:2px solid \${ACCENT}55;border-radius:16px;font-size:30px;font-weight:700;
  color:#fff;background:\${ACCENT}08}
.poll-cta{text-align:center;margin-top:22px;font-size:26px;color:rgba(255,255,255,0.3)}

.disclaimer-block{position:relative;z-index:2;padding:0 72px 60px;text-align:center;margin-top:auto}
.disclaimer-text{font-size:20px;font-weight:500;color:rgba(255,255,255,0.22);line-height:1.6}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div>
<div class="guide-top">
  <div class="guide-tag">\${esc(data.ticker)} · 操作指南</div>
  <div class="guide-title">避坑 & 行动清单</div>
</div>
<div class="guide-section">
  <div class="guide-section-title">📊 胜率较高的策略</div>
  \${doHtml}
</div>
<div class="guide-section">
  <div class="guide-section-title">⚠️ 常见的亏损来源</div>
  \${dontHtml}
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
</body></html>\`;
}`;

const newSrc = src.substring(0, p4Start) + newP4 + src.substring(p4End + 2);
fs.writeFileSync("scripts/aaplFullPoster.js", newSrc, "utf8");

// Verify
const v = fs.readFileSync("scripts/aaplFullPoster.js", "utf8");
console.log("margin-top:auto (disclaimer贴底): " + (v.includes("margin-top:auto") ? "✅" : "❌"));
console.log("移除⚠️emoji: " + (!v.includes("⚠️ 风险提示") ? "✅" : "❌ 仍存在"));
console.log("风险提示文本: " + (v.includes("风险提示：本文仅为公开数据整理") ? "✅" : "❌"));
console.log("市场有风险: " + (v.includes("市场有风险，入市需谨慎") ? "✅" : "❌"));
console.log("guide-title 50px: " + (v.includes("font-size:50px") ? "✅" : "❌"));
