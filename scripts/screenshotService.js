/**
 * screenshotService.js — Puppeteer batch rendering service
 *
 * 职责：
 *   - 管理单例 browser 实例
 *   - 以 deviceScaleFactor:2 渲染 1080×1440 HTML → PNG
 *   - 批量输出 4 图序列到 /covers/[TICKER]_[DATE]/
 */

const fs = require("fs-extra");
const path = require("path");

// ═══════════════════════════════════════════════════════════════
// Browser singleton
// ═══════════════════════════════════════════════════════════════
let _browser = null;

async function getBrowser() {
  if (_browser) return _browser;
  const puppeteer = require("puppeteer");
  _browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });
  return _browser;
}

async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Single-page render
// ═══════════════════════════════════════════════════════════════
async function screenshotHtml(html, outPath, vpW = 1080, vpH = 1440) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: vpW, height: vpH, deviceScaleFactor: 3 });
  await page.setContent(html, { waitUntil: "networkidle0", timeout: 15_000 });
  await page.screenshot({ path: outPath, type: "png", fullPage: false });
  await page.close();
}

// ═══════════════════════════════════════════════════════════════
// Batch render 4-slide set
// ═══════════════════════════════════════════════════════════════
async function renderSlideSet(ticker, slides, outDir, opts = {}) {
  await fs.ensureDir(outDir);

  const vpW = opts.viewportWidth || 1080;
  const vpH = opts.viewportHeight || 1440;

  const files = [
    { name: "P1_cover.png",       html: slides.p1.html, vp: slides.p1._viewport },
    { name: "P2_conclusion.png",  html: slides.p2.html, vp: slides.p2._viewport },
    { name: "P3_logic.png",       html: slides.p3.html, vp: slides.p3._viewport },
    { name: "P4_action.png",      html: slides.p4.html, vp: slides.p4._viewport },
  ];

  const results = [];
  for (const f of files) {
    const pngPath = path.join(outDir, f.name);
    try {
      const fVpW = (f.vp && f.vp.w) || vpW;
      const fVpH = (f.vp && f.vp.h) || vpH;
      await screenshotHtml(f.html, pngPath, fVpW, fVpH);
      const stat = fs.statSync(pngPath);
      results.push({ name: f.name, path: pngPath, sizeKB: (stat.size / 1024).toFixed(0) });
    } catch (e) {
      console.error(`❌ ${ticker} ${f.name} failed:`, e.message);
      results.push({ name: f.name, error: e.message });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// Generate date-stamped folder name
// ═══════════════════════════════════════════════════════════════
function makeOutDirName(ticker, date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${ticker}_${y}${m}${day}`;
}

module.exports = {
  getBrowser,
  closeBrowser,
  screenshotHtml,
  renderSlideSet,
  makeOutDirName,
};
