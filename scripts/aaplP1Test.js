/* eslint-disable no-console */
/**
 * aaplP1Test.js — AAPL P1 封面 v3 测试
 *
 * 视觉权重: 标题 45% / 关键数字 30% / 核心论点 20% / 其他 5%
 * 黑金 + 冰蓝数字 + Tim Cook 剪影背景
 * 目标: 顶级投研报告封面，不是设计作品集
 */

const fs = require("fs-extra");
const path = require("path");
const { screenshotHtml, closeBrowser } = require("./screenshotService");

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const G = {
  BG:       "#050505",
  WHITE:    "#FFFFFF",
  ICE:      "#64D2FF",
  GOLD:     "#B8975A",
  GOLD_DIM: "rgba(184,151,90,0.30)",
  SILVER:   "#A1A1A6",
  MUTED:    "rgba(255,255,255,0.22)",
  BORDER:   "rgba(255,255,255,0.05)",
  M: 80,
};

const VERSIONS = [
  {
    id: "A",
    title: "苹果最大的危机，可能不是AI落后",
    numbers: [
      { num: "25亿",   label: "活跃设备",   color: "#64D2FF" },
      { num: "18个月", label: "AI 落后",    color: "#64D2FF" },
      { num: "4.2年",  label: "换机周期",   color: "#64D2FF" },
    ],
    points: [
      "硬件分发优势在 AI 时代正在边际递减",
      "隐私优先策略限制了训练数据的规模与质量",
      "AI 功能能否成为换机催化剂仍是未知数",
    ],
  },
  {
    id: "B",
    title: "25亿设备，",
    titleLine2: "为什么打不过ChatGPT？",
    numbers: [
      { num: "2亿",   label: "ChatGPT 周活", color: "#64D2FF" },
      { num: "0",     label: "Apple AI 周活", color: "#64D2FF" },
      { num: "30%",   label: "App Store 抽成", color: "#64D2FF" },
    ],
    points: [
      "开源社区模型迭代速度已远超封闭生态",
      "开发者正在流向抽成更低、工具更开放的 AI 平台",
      "25 亿设备的硬件优势不等于 AI 服务优势",
    ],
  },
  {
    id: "C",
    title: "苹果最大的危机，其实不是AI",
    numbers: [
      { num: "−2.2%", label: "中国份额变化", color: "#64D2FF" },
      { num: "7%",    label: "服务增速",     color: "#64D2FF" },
      { num: "4.2年", label: "换机周期",     color: "#64D2FF" },
    ],
    points: [
      "华为回归叠加本土品牌崛起，中国市场持续失血",
      "服务业务增速从双位数降至个位数，第二曲线熄火",
      "全球智能手机换机周期已达历史最长",
    ],
  },
];

function calcTitleSize(title) {
  const cjk = (title.match(/[一-鿿]/g) || []).length;
  const ascii = title.length - cjk;
  const w = cjk * 1.0 + ascii * 0.55;
  let size = Math.floor(Math.min(120, 920 / Math.max(w, 1)) * 0.96);
  if (w < 10) size = Math.max(size, 108);
  else if (w < 15) size = Math.max(size, 96);
  return size;
}

function buildP1(v) {
  // Calculate title size — use longest line for two-line titles
  const lines = [v.title];
  if (v.titleLine2) lines.push(v.titleLine2);
  const maxEstW = Math.max(...lines.map((l) => {
    const cjk = (l.match(/[一-鿿]/g) || []).length;
    const ascii = l.length - cjk;
    return cjk * 1.0 + ascii * 0.55;
  }));
  let ts = Math.floor(Math.min(120, 920 / Math.max(maxEstW, 1)) * 0.97);
  if (maxEstW < 8) ts = Math.max(ts, 112);
  else if (maxEstW < 12) ts = Math.max(ts, 100);

  const titleHtml = v.titleLine2
    ? '<div class="hero-title">' + esc(v.title) + "</div>" +
      '<div class="hero-title hero-title-l2">' + esc(v.titleLine2) + "</div>"
    : '<div class="hero-title">' + esc(v.title) + "</div>";

  const numsHtml = v.numbers
    .map((n) => {
      return (
        '<div class="num-card">' +
        '<div class="num-value" style="color:' + n.color + '">' + esc(n.num) + "</div>" +
        '<div class="num-label">' + esc(n.label) + "</div>" +
        "</div>"
      );
    })
    .join("");

  const pointsHtml = v.points
    .map((p) => {
      return '<div class="point"><span class="point-dot"></span>' + esc(p) + "</div>";
    })
    .join("");

  return (
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>' +
    "*{margin:0;padding:0;box-sizing:border-box}" +
    "body{width:1080px;height:1440px;overflow:hidden;position:relative;" +
    'font-family:-apple-system,"PingFang SC","MiSans","Microsoft YaHei",sans-serif;' +
    "font-weight:500;display:flex;flex-direction:column;background:" + G.BG + "}" +

    /* Grid */
    ".bg-grid{position:absolute;inset:0;pointer-events:none;z-index:0;" +
    "background-image:linear-gradient(rgba(255,255,255,0.008) 1px,transparent 1px)," +
    "linear-gradient(90deg,rgba(255,255,255,0.008) 1px,transparent 1px);background-size:96px 96px}" +

    /* Glow */
    ".bg-glow{position:absolute;width:800px;height:600px;border-radius:50%;" +
    "background:radial-gradient(circle at center,rgba(100,210,255,0.025) 0%,transparent 70%);" +
    "top:5%;left:45%;transform:translate(-50%,0);filter:blur(140px);pointer-events:none;z-index:0}" +

    /* ── Silhouette: right side, 12% opacity ── */
    ".silhouette{position:absolute;right:60px;top:200px;width:240px;height:880px;" +
    "pointer-events:none;z-index:0;opacity:0.11}" +
    ".sil-head{width:72px;height:72px;border-radius:50%;background:" + G.WHITE + ";" +
    "margin:0 auto 2px}" +
    ".sil-shoulders{width:160px;height:120px;border-radius:80px 80px 0 0;background:" + G.WHITE + ";" +
    "margin:0 auto}" +
    ".sil-torso{width:108px;height:420px;border-radius:16px 16px 0 0;background:" + G.WHITE + ";" +
    "margin:0 auto}" +

    /* ── Title block: 45% visual weight ── */
    ".hero{position:relative;z-index:2;padding:150px " + G.M + "px 0;" +
    "display:flex;flex-direction:column}" +
    ".hero-logo{font-size:30px;font-weight:900;color:rgba(255,255,255,0.48);" +
    "letter-spacing:16px;margin-bottom:40px}" +
    ".hero-title{font-size:" + ts + "px;font-weight:900;line-height:1.06;color:" + G.WHITE + ";" +
    "letter-spacing:-1.5px;max-width:760px}" +
    ".hero-title-l2{margin-top:2px}" +
    ".hero-line{width:36px;height:2px;background:" + G.GOLD_DIM + ";margin-top:32px;border-radius:1px}" +

    /* ── Key numbers: SECOND visual center, 30% weight ── */
    ".numbers{position:relative;z-index:2;padding:40px " + G.M + "px 0;display:flex;gap:32px}" +
    ".num-card{flex:1;text-align:center;padding:16px 12px}" +
    ".num-value{font-size:56px;font-weight:900;letter-spacing:-1.5px;line-height:1;" +
    "margin-bottom:12px}" +
    ".num-label{font-size:18px;font-weight:600;color:" + G.SILVER + ";letter-spacing:3px}" +

    /* ── Core arguments: 20% weight, 50% larger than before ── */
    ".arguments{position:relative;z-index:2;padding:32px " + G.M + "px 0}" +
    ".point{display:flex;align-items:flex-start;gap:14px;padding:15px 0;" +
    "font-size:22px;font-weight:500;color:rgba(255,255,255,0.60);line-height:1.5}" +
    ".point-dot{width:5px;height:5px;border-radius:50%;background:" + G.GOLD_DIM + ";" +
    "margin-top:11px;flex-shrink:0}" +

    /* ── Footer: 5% ── */
    ".footer{position:relative;z-index:2;padding:0 " + G.M + "px 48px;margin-top:auto}" +
    ".footer-line{width:100%;height:1px;background:" + G.BORDER + ";margin-bottom:16px}" +
    ".footer-text{font-size:14px;font-weight:500;color:rgba(255,255,255,0.07);letter-spacing:2px}" +

    "</style></head><body>" +
    '<div class="bg-grid"></div><div class="bg-glow"></div>' +

    /* Silhouette */
    '<div class="silhouette">' +
    '<div class="sil-head"></div>' +
    '<div class="sil-shoulders"></div>' +
    '<div class="sil-torso"></div>' +
    "</div>" +

    '<div class="hero">' +
    '<div class="hero-logo">AAPL</div>' +
    titleHtml +
    '<div class="hero-line"></div>' +
    "</div>" +

    '<div class="numbers">' + numsHtml + "</div>" +
    '<div class="arguments">' + pointsHtml + "</div>" +

    '<div class="footer">' +
    '<div class="footer-line"></div>' +
    '<div class="footer-text">Yahoo Finance  ·  AI 辅助分析  ·  仅供参考</div>' +
    "</div>" +
    "</body></html>"
  );
}

(async () => {
  const outDir = path.join(process.cwd(), "covers", "AAPL_P1_V3");
  await fs.ensureDir(outDir);

  console.log("═══════════════════════════════════════");
  console.log("  AAPL P1 v3 — 投研报告封面");
  console.log("  视觉: 标题45% / 数字30% / 论点20%");
  console.log("═══════════════════════════════════════\n");

  for (const v of VERSIONS) {
    const html = buildP1(v);
    const outPath = path.join(outDir, "P1_v" + v.id + ".png");
    const htmlPath = path.join(outDir, "P1_v" + v.id + ".html");
    await fs.writeFile(htmlPath, html, "utf8");

    const ts = calcTitleSize(v.title);
    console.log('版本 ' + v.id + ': "' + v.title + '"');
    console.log("  标题: " + ts + "px  |  数字: 56px  |  论点: 22px");
    console.log("  " + v.numbers.map(function(n){return n.num + " " + n.label}).join("  ·  "));

    try {
      await screenshotHtml(html, outPath);
      const stat = fs.statSync(outPath);
      console.log("  ✅ P1_v" + v.id + ".png  (" + (stat.size / 1024).toFixed(0) + " KB)\n");
    } catch (e) {
      console.log("  ❌ 失败: " + e.message + "\n");
    }
  }

  await closeBrowser();
  console.log("📁 输出: " + outDir);
  console.log("✅ 3 张投研封面已完成\n");
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
