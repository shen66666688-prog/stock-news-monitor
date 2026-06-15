/* eslint-disable no-console */
/**
 * tslaDouyinPoster.js — TSLA 抖音版黑金投研海报 (2026.06.10)
 *
 * 平台：抖音图文
 * 核心原则：不深度分析 / 不财经媒体腔 / 不像研报 / 先制造冲突
 *
 * 视觉策略（抖音定制）：
 *   - 标题字号比黑金版放大 25%+
 *   - 顶部留白增加，标题视觉居中
 *   - 大数字驱动，文字密度降至最低
 *   - 远离底部，给抖音UI留空间
 *   - 减少表格，增加单数字冲击
 *
 * 风格：冲突型复盘 / 个人记录 / 非荐股 / 非机构
 * 禁止：买入建议 / 卖出建议 / 目标价 / 涨跌预测
 */

const fs = require("fs-extra");
const path = require("path");
const { renderSlideSet, closeBrowser } = require("./screenshotService");

// ═══════════════════════════════════════════════════════════════
// TSLA 2026.06.10 抖音版数据
// ═══════════════════════════════════════════════════════════════
const DATA = {
  // P1: Bloomberg Terminal / ARK / MS 风格
  p1_tslaTag: "TSLA",
  p1_line1_num: "358",
  p1_line1_unit: "倍PE",
  p1_line2: "市场买的到底是",
  p1_line3a: "汽车业务",
  p1_line3b: "还是 Robotaxi？",
  p1_priceLine: "$391    $1.47T    PE 358×",
  // P2: 多空对撞
  p2_stance: "多头在赌一个未来，空头在等一个答案。两边都有道理。",
  p2_bull: {
    label: "📈 多头",
    points: [
      "Robotaxi一旦跑通，商业模型碾压所有竞品",
      "FSD端到端路线一旦突破临界点，数据飞轮启动",
      "能源业务增速80%+，第二曲线已经成型",
    ],
  },
  p2_bear: {
    label: "📉 空头",
    points: [
      "358倍PE，透支了至少5年的增长预期",
      "FSD讲了快10年，Robotaxi只有20辆车在跑",
      "汽车毛利率从30%降到18%，基本盘在松动",
    ],
  },
  // P3: 3个问题 — 每问只保留核心冲突
  p3_questions: [
    {
      q: "Robotaxi 真的能赚钱吗？",
      bull: "Cybercab 成本 &lt;$30K，规模化后每英里 &lt;$0.2，盈利模型理论上碾压 Waymo。",
      bear: "奥斯汀只有 20 辆车在跑。Waymo 有 577 辆。从 20 辆到商业化盈利，中间隔着四座大山。",
    },
    {
      q: "FSD 能不能成为第二增长曲线？",
      bull: "端到端方案一旦突破，数据飞轮启动——更多车→更多数据→更好模型。这是 Waymo 做不到的。",
      bear: "华为 ADS、小鹏 XNGP 已经大量上路。FSD 进中国是补齐短板，不是建立壁垒。",
    },
    {
      q: "如果汽车业务放缓，估值靠什么撑？",
      bull: "能源业务增速 80%+，Megapack 供不应求。FSD 订阅一旦起量，利润率远超卖车。",
      bear: "中国份额在掉。欧洲关税在加。储能基数太小（不到营收 10%），远不够撑 $1.47T。",
    },
  ],
  // P4
  footer: "不一定对 · 个人记录 · 投资有风险请独立判断",
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
// Shared CSS — 抖音版：更大的对比度，更少的细节
// ═══════════════════════════════════════════════════════════════
function cssBase() {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1440px;overflow:hidden;position:relative;
  font-family:-apple-system,"PingFang SC","MiSans","Microsoft YaHei",sans-serif;
  font-weight:700;display:flex;flex-direction:column;
  background:#080c12}
.bg-grid{position:absolute;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px);
  background-size:80px 80px}
.bg-glow{position:absolute;width:900px;height:900px;border-radius:50%;
  background:radial-gradient(circle at center,${ACCENT}10 0%,transparent 70%);
  top:0%;left:50%;transform:translate(-50%,0);filter:blur(120px);pointer-events:none;z-index:0}
.bg-glow2{position:absolute;width:600px;height:600px;border-radius:50%;
  background:radial-gradient(circle at center,${ACCENT}08 0%,transparent 70%);
  bottom:0;right:0;transform:translate(30%,20%);filter:blur(100px);pointer-events:none;z-index:0}
`.replace(/\n/g, " ");
}

// ═══════════════════════════════════════════════════════════════
// P1 — Bloomberg Terminal / ARK / MS 风格封面
// 高级感 > 情绪化  ·  专业感 > 标题党  ·  1秒看懂冲突
// ═══════════════════════════════════════════════════════════════
function buildP1(data) {
  const { p1_tslaTag, p1_line1_num, p1_line1_unit, p1_line2, p1_line3a, p1_line3b, p1_priceLine } = data;

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
/* ── 画布垂直居中 ── */
body{justify-content:center}

/* ── 内容区 ── */
.container{position:relative;z-index:2;
  display:flex;flex-direction:column;align-items:center;text-align:center;
  padding:0 96px}

/* ── TSLA 标签：在358正上方，可见锚点 ── */
.tag-tsla{display:inline-block;padding:4px 18px;
  border:1px solid ${ACCENT}55;border-radius:3px;
  font-size:16px;font-weight:700;color:${ACCENT}88;letter-spacing:10px;
  margin-bottom:32px}

/* ── L1: 358倍PE — 最大元素 ── */
.line1{display:flex;align-items:baseline;justify-content:center;gap:0;margin-bottom:44px}
.num{font-size:108px;font-weight:900;color:#ef4444;
  text-shadow:0 0 48px rgba(239,68,68,0.28),0 0 96px rgba(239,68,68,0.10);
  letter-spacing:-2px;line-height:1}
.unit{font-size:50px;font-weight:900;color:rgba(255,255,255,0.90);
  letter-spacing:3px;line-height:1;margin-left:4px}

/* ── L2: 市场买的到底是 — 过渡句 ── */
.line2{font-size:36px;font-weight:700;color:rgba(255,255,255,0.55);
  letter-spacing:3px;line-height:1;margin-bottom:40px}

/* ── L3: 核心冲突 — 汽车业务(白) vs Robotaxi(金) 同字号对立 ── */
.line3{display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:52px}
.line3a{font-size:52px;font-weight:900;color:#fff;letter-spacing:4px;line-height:1.1}
.line3b{font-size:52px;font-weight:900;color:${ACCENT};letter-spacing:4px;line-height:1.1}

/* ── 分割线 ── */
.divider{width:200px;height:1px;background:${ACCENT}22;margin-bottom:44px}

/* ── 底部数据：monospace 极简 ── */
.price-line{font-size:20px;font-weight:600;color:rgba(255,255,255,0.18);
  letter-spacing:3px;font-family:"SF Mono","JetBrains Mono","Consolas",monospace}

/* ── 底部水印 ── */
.foot-tag{margin-top:48px;font-size:17px;color:rgba(255,255,255,0.10);letter-spacing:6px}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div><div class="bg-glow2"></div>

<div class="container">

  <div class="tag-tsla">${p1_tslaTag}</div>

  <div class="line1">
    <span class="num">${p1_line1_num}</span><span class="unit">${p1_line1_unit}</span>
  </div>

  <div class="line2">${p1_line2}</div>

  <div class="line3">
    <div class="line3a">${p1_line3a}</div>
    <div class="line3b">${p1_line3b}</div>
  </div>

  <div class="divider"></div>

  <div class="price-line">${p1_priceLine}</div>

  <div class="foot-tag">TSLA · 投研笔记</div>

</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P2 — 多空对撞（左右撞，非上下）
// ═══════════════════════════════════════════════════════════════
function buildP2(data) {
  const { p2_stance, p2_bull, p2_bear } = data;

  const bullPoints = p2_bull.points
    .map((p) => `<div class="pt">${p}</div>`)
    .join("");
  const bearPoints = p2_bear.points
    .map((p) => `<div class="pt">${p}</div>`)
    .join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
body{justify-content:flex-start}

/* ── 顶部结论 ── */
.top{position:relative;z-index:2;padding:160px 96px 0;text-align:center}
.top-emoji{font-size:60px;display:block;margin-bottom:16px}
.top-label{font-size:56px;font-weight:900;color:#fff;letter-spacing:2px}

/* ── 金句 ── */
.quote-wrap{position:relative;z-index:2;padding:32px 96px 0}
.quote{display:flex;align-items:center;gap:12px;padding:28px 36px;
  border:1px solid ${ACCENT}28;border-radius:16px;background:${ACCENT}04}
.quote-icon{font-size:28px}
.quote-text{font-size:34px;font-weight:800;color:#fff;line-height:1.35}

/* ── 多空对撞：左右两列 ── */
.clash{position:relative;z-index:2;padding:36px 72px 0;display:flex;gap:24px}
.col{flex:1;padding:32px 28px;border-radius:20px}
.col.bull{background:rgba(34,197,94,0.04);border:2px solid rgba(34,197,94,0.12)}
.col.bear{background:rgba(239,68,68,0.04);border:2px solid rgba(239,68,68,0.12)}
.col-label{font-size:32px;font-weight:900;margin-bottom:24px;letter-spacing:1px}
.col.bull .col-label{color:#22c55e}
.col.bear .col-label{color:#ef4444}
.col-divider{width:100%;height:1px;background:rgba(255,255,255,0.06);margin-bottom:24px}
.pt{font-size:23px;font-weight:600;color:rgba(255,255,255,0.7);line-height:1.5;margin-bottom:14px;padding-left:8px}
.pt::before{content:"▸ ";color:${ACCENT};opacity:0.6}

/* ── VS 线 ── */
.vs{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  width:56px;height:56px;border-radius:50%;
  background:${ACCENT}15;border:2px solid ${ACCENT}33;
  display:flex;align-items:center;justify-content:center;
  font-size:22px;font-weight:900;color:${ACCENT};z-index:3}

</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div><div class="bg-glow2"></div>

<div class="top">
  <span class="top-emoji">⚡</span>
  <div class="top-label">多空对撞</div>
</div>

<div class="quote-wrap">
  <div class="quote">
    <span class="quote-icon">💡</span>
    <span class="quote-text">${p2_stance}</span>
  </div>
</div>

<div class="clash" style="position:relative">
  <div class="col bull">
    <div class="col-label">${p2_bull.label}</div>
    <div class="col-divider"></div>
    ${bullPoints}
  </div>
  <div class="vs">VS</div>
  <div class="col bear">
    <div class="col-label">${p2_bear.label}</div>
    <div class="col-divider"></div>
    ${bearPoints}
  </div>
</div>

</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P3 — 3 问极简版（每问仅两句话：多头一句 vs 空头一句）
// ═══════════════════════════════════════════════════════════════
function buildP3(data) {
  const { p3_questions } = data;

  const cards = p3_questions
    .map(
      (qa, i) => `
    <div class="card">
      <div class="card-num">0${i + 1}</div>
      <div class="card-q">${qa.q}</div>
      <div class="card-row bull-row">
        <span class="tag" style="background:#22c55e22;color:#22c55e">多</span>
        <span class="txt">${qa.bull}</span>
      </div>
      <div class="card-row bear-row">
        <span class="tag" style="background:#ef444422;color:#ef4444">空</span>
        <span class="txt">${qa.bear}</span>
      </div>
    </div>`
    )
    .join("");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
body{justify-content:flex-start}

.head{position:relative;z-index:2;padding:70px 96px 0;text-align:center}
.head-tag{display:inline-block;padding:6px 24px;border:1px solid ${ACCENT}33;border-radius:4px;
  font-size:22px;color:${ACCENT}66;letter-spacing:8px;margin-bottom:20px}
.head-title{font-size:52px;font-weight:900;color:#fff;letter-spacing:2px}

.cards{position:relative;z-index:2;padding:28px 72px 0;display:flex;flex-direction:column;gap:14px}
.card{padding:26px 36px;background:rgba(255,255,255,0.015);
  border:1px solid rgba(255,255,255,0.04);border-radius:20px;
  border-left:4px solid ${ACCENT}33}
.card-num{font-size:18px;font-weight:800;color:${ACCENT}44;letter-spacing:4px;margin-bottom:8px}
.card-q{font-size:34px;font-weight:900;color:#fff;margin-bottom:16px;line-height:1.3}
.card-row{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;padding:14px 18px;border-radius:10px}
.card-row.bull-row{background:rgba(34,197,94,0.03);border:1px solid rgba(34,197,94,0.06)}
.card-row.bear-row{background:rgba(239,68,68,0.03);border:1px solid rgba(239,68,68,0.06)}
.tag{font-size:18px;font-weight:900;padding:4px 12px;border-radius:6px;min-width:44px;text-align:center;flex-shrink:0}
.txt{font-size:24px;font-weight:600;color:rgba(255,255,255,0.7);line-height:1.45}

.bottom-pad{position:relative;z-index:2;height:120px}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div><div class="bg-glow2"></div>

<div class="head">
  <div class="head-tag">TSLA</div>
  <div class="head-title">3 个问题</div>
</div>

<div class="cards">${cards}</div>
<div class="bottom-pad"></div>

</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// P4 — 投票 + 免责（抖音极简版）
// ═══════════════════════════════════════════════════════════════
function buildP4(data) {
  const { footer } = data;

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
${cssBase()}
body{justify-content:center;align-items:center;gap:0}

/* ── 投票区：C位 ── */
.poll{position:relative;z-index:2;padding:0 72px;text-align:center;width:100%}
.poll-q{font-size:40px;font-weight:900;color:#fff;margin-bottom:40px;letter-spacing:2px}
.poll-btns{display:flex;gap:28px;justify-content:center;margin-bottom:36px}
.poll-btn{flex:1;max-width:380px;padding:40px 20px;text-align:center;
  border:2px solid ${ACCENT}33;border-radius:24px;font-size:32px;font-weight:800;
  color:#fff;background:${ACCENT}04;line-height:1.3}
.poll-btn-label{font-size:52px;display:block;margin-bottom:12px}
.poll-sub{font-size:20px;font-weight:600;color:rgba(255,255,255,0.35)}

/* ── 评论区CTA ── */
.cta{position:relative;z-index:2;padding:0 72px;text-align:center;margin-top:28px}
.cta-text{font-size:30px;font-weight:700;color:rgba(255,255,255,0.28);line-height:1.6}
.cta-em{color:${ACCENT};font-weight:900}

/* ── 分割线 ── */
.divider{width:80px;height:1px;background:${ACCENT}18;margin:36px auto 0;position:relative;z-index:2}

/* ── 免责：极简 ── */
.foot{position:relative;z-index:2;padding:32px 96px 0;text-align:center;width:100%}
.foot-text{font-size:24px;color:rgba(255,255,255,0.15);line-height:2.0;letter-spacing:2px}
</style></head><body>
<div class="bg-grid"></div><div class="bg-glow"></div><div class="bg-glow2"></div>

<div class="poll">
  <div class="poll-q">你站哪边？</div>
  <div class="poll-btns">
    <div class="poll-btn">
      <span class="poll-btn-label">🛡️</span>
      特斯拉<br/>被高估了
    </div>
    <div class="poll-btn">
      <span class="poll-btn-label">💎</span>
      市场低估了<br/>未来价值
    </div>
  </div>
  <div class="poll-sub">评论区 扣1看空 · 扣2看多</div>
</div>

<div class="cta">
  <div class="cta-text">
    <span class="cta-em">5 年后回头看，</span><br/>
    特斯拉最大的收入来源<br/>
    还会是卖车吗？
  </div>
</div>

<div class="divider"></div>

<div class="foot">
  <div class="foot-text">${footer}</div>
</div>

</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════
(async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  TSLA 抖音版黑金海报 (2026.06.10)     ║");
  console.log("║  策略: 冲突前置 + 大数字 + 极简文字    ║");
  console.log("╚══════════════════════════════════════╝\n");

  const OUT_DIR = path.join(process.cwd(), "covers", "TSLA_20260610_douyin");
  await fs.ensureDir(OUT_DIR);

  const slides = {
    p1: { html: buildP1(DATA) },
    p2: { html: buildP2(DATA) },
    p3: { html: buildP3(DATA) },
    p4: { html: buildP4(DATA) },
  };

  console.log("🎨 渲染 4 张 TSLA 抖音版海报…\n");
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

  // 抖音文案
  const douyinCaption = `特斯拉最危险的，
可能根本不是销量。

而是你买的到底是特斯拉，
还是马斯克？

$391 一股。
358 倍 PE。
丰田只有 8 倍。

多出来的，
全是故事。

Robotaxi 能赚钱吗？
FSD 能成护城河吗？
汽车慢了，估值靠什么撑？

4 张图拆给你看。

评论区扣 1 看空，扣 2 看多。
我赌一半人站错边。

#特斯拉 #TSLA #美股 #Robotaxi #马斯克`;

  await fs.writeFile(path.join(OUT_DIR, "douyin_caption.txt"), douyinCaption, "utf8");
  console.log("✅ 抖音文案已保存");

  // 置顶评论
  const pinned = `我翻了一圈财报。

特斯拉 80% 的收入还是卖车。

但股价里只有 $16 是按汽车给的估值。

剩下的 $375，都是马斯克说的"未来"。

这个"未来"会不会来？
我不知道。

但我知道的是：
358 倍 PE 已经把"一定会来"定价进去了。

万一它来得慢了一点呢？

—— 深夜复盘，个人记录
投资有风险，请独立判断。`;

  await fs.writeFile(path.join(OUT_DIR, "pinned_comment.txt"), pinned, "utf8");
  console.log("✅ 置顶评论已保存");

  await closeBrowser();

  console.log(`\n🎉 渲染完成: ${successCount}/4 张 TSLA 抖音版海报`);
  console.log(`📁 输出目录: ${OUT_DIR}\n`);
})().catch((err) => {
  console.error("❌ 渲染失败:", err);
  process.exit(1);
});
