/**
 * deepImageScan.js — 截图深度结构分析
 * 用法: node scripts/deepImageScan.js "文件名"
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { PNG } = require("pngjs");

const file = process.argv[2]
  ? path.join(os.homedir(), "Desktop", "claude的眼睛", process.argv[2])
  : null;

if (!file || !fs.existsSync(file)) {
  const dir = path.join(os.homedir(), "Desktop", "claude的眼睛");
  const files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f));
  console.log("用法: node scripts/deepImageScan.js <文件名>");
  console.log("可用的 PNG 文件:");
  files.forEach((f) => console.log("  " + f));
  process.exit(1);
}

const buf = fs.readFileSync(file);
const png = PNG.sync.read(buf);

// 1. Layout bands
const bands = [];
const BH = 40;
for (let y = 0; y < png.height; y += BH) {
  let dark = 0, total = 0;
  for (let by = y; by < Math.min(y + BH, png.height); by += 4) {
    for (let x = 0; x < png.width; x += 8) {
      const idx = (by * png.width + x) * 4;
      const bri = (png.data[idx] + png.data[idx + 1] + png.data[idx + 2]) / 3;
      if (bri < 80) dark++;
      total++;
    }
  }
  bands.push({ y, density: total > 0 ? dark / total * 100 : 0 });
}

// 2. Left-side analysis (navigation panel?)
const leftDark = [];
for (let y = 0; y < png.height; y += 4) {
  let dark = 0, total = 0;
  for (let x = 0; x < 260; x += 4) {
    const idx = (y * png.width + x) * 4;
    const bri = (png.data[idx] + png.data[idx + 1] + png.data[idx + 2]) / 3;
    if (bri < 80) dark++;
    total++;
  }
  leftDark.push(dark / Math.max(1, total));
}
const leftPanelDensity = leftDark.reduce((a, b) => a + b, 0) / leftDark.length * 100;

// 3. Detect horizontal divider lines
const dividers = [];
for (let y = 0; y < png.height; y += 2) {
  let linePx = 0;
  for (let x = 0; x < png.width; x += 3) {
    const idx = (y * png.width + x) * 4;
    const r = png.data[idx], g = png.data[idx + 1], b = png.data[idx + 2];
    if (r > 200 && g > 200 && b > 200) continue; // white bg
    if (Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && r < 210) linePx++;
  }
  if (linePx > png.width * 0.7) {
    const last = dividers[dividers.length - 1];
    if (!last || y - last > 5) dividers.push(y);
  }
}

// 4. Color clusters in center area
const colors = {};
for (let y = png.height * 0.1; y < png.height * 0.9; y += 20) {
  for (let x = png.width * 0.1; x < png.width * 0.9; x += 20) {
    const idx = (y * png.width + x) * 4;
    const r = Math.round(png.data[idx] / 32) * 32;
    const g = Math.round(png.data[idx + 1] / 32) * 32;
    const b = Math.round(png.data[idx + 2] / 32) * 32;
    const key = r + "," + g + "," + b;
    colors[key] = (colors[key] || 0) + 1;
  }
}
const topColors = Object.entries(colors)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([k, c]) => {
    const [r, g, b] = k.split(",").map(Number);
    const pct = (c / Object.values(colors).reduce((a, b) => a + b, 0) * 100).toFixed(1);
    return { color: `rgb(${r},${g},${b})`, pct };
  });

// ── Output ──
console.log("╔══════════════════════════════════════╗");
console.log("║     👁️  截图深度结构分析            ║");
console.log("╚══════════════════════════════════════╝");
console.log("");
console.log(`📐 ${png.width}×${png.height} | ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
console.log("");

console.log("🎨 主色调:");
for (const c of topColors) {
  const bar = "█".repeat(Math.round(parseFloat(c.pct) / 2));
  console.log(`  ${c.color.padEnd(20)} ${c.pct}% ${bar}`);
}

console.log("");
console.log("📐 布局结构:");
console.log(`  左侧面板密度: ${leftPanelDensity.toFixed(0)}% ${leftPanelDensity > 10 ? "(可能有导航栏)" : "(无侧栏)"}`);
console.log(`  水平分割线: ${dividers.length} 条`);

if (dividers.length > 0) {
  console.log("  分割线位置:");
  dividers.slice(0, 10).forEach((y) => {
    console.log(`    y=${y} (页面${(y / png.height * 100).toFixed(0)}%)`);
  });
}

console.log("");
console.log("📊 纵向密度分布:");
const zoneSize = Math.floor(bands.length / 6);
for (let i = 0; i < 6; i++) {
  const slice = bands.slice(i * zoneSize, (i + 1) * zoneSize);
  const avg = slice.reduce((s, b) => s + b.density, 0) / slice.length;
  const bar = "█".repeat(Math.round(avg));
  const label = ["顶部", "上部", "中部上", "中部下", "下部", "底部"][i];
  console.log(`  ${label.padEnd(8)} 密度 ${avg.toFixed(1)}% ${bar}`);
}

console.log("");
console.log("💡 判断:");
if (png.width > 2000 && leftPanelDensity < 10) {
  console.log("  → 宽屏内容页（可能是数据仪表盘/后台）");
}
if (topColors.some((c) => c.color.includes("rgb(224") || c.color.includes("rgb(240"))) {
  console.log("  → 浅色主题界面");
}
if (dividers.length > 3) {
  console.log("  → 有表格或卡片分隔结构");
}
if (topColors.some((c) => c.color.includes("rgb(0,0,0") || c.color.includes("rgb(32,32"))) {
  console.log("  → 包含深色文字或深色区块");
}
