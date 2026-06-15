/**
 * dataFetcher.js — Real market data pipeline for diagnostic dashboard
 *
 * Fetches live quotes from Yahoo Finance (yahoo-finance2) and computes
 * the metrics that drive HTML progress bars and labels.
 *
 * Connection to CSS:
 *   Each diagnostic row has `width:${d.pct}%` on the .dbar-fill div.
 *   The `pct` value comes directly from the calculations below.
 */

const YahooFinance = require("yahoo-finance2").default;

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// ═══════════════════════════════════════════════════════════════
// Fetch raw quote for a ticker
// ═══════════════════════════════════════════════════════════════
async function fetchQuote(ticker) {
  try {
    const q = await yf.quote(ticker.toUpperCase());
    return q;
  } catch (e) {
    console.warn(`  yahoo-finance2  ${ticker}: ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Compute diagnostic metrics from quote data
//
// Returns an object that maps 1:1 to buildDiagnostics() rows.
// Each metric includes a `pct` (0-100) that drives CSS width.
// ═══════════════════════════════════════════════════════════════
function computeMetrics(quote) {
  if (!quote) return null;

  const price = quote.regularMarketPrice || 0;
  const ma50  = quote.fiftyDayAverage || 0;
  const ma200 = quote.twoHundredDayAverage || 0;
  const pe    = quote.trailingPE || 0;
  const fwdPe = quote.forwardPE || 0;

  // ── 1. Price vs 50-day MA → growth momentum (0-100) ──
  // Above MA = strong (>50%), below = weak (<50%)
  let ma50Pct = 50;
  let ma50Label = "中性";
  if (ma50 > 0 && price > 0) {
    const dev = ((price - ma50) / ma50) * 100; // % deviation
    // Map deviation to 0-100: 0% dev = 50pct, +10% dev = 85pct, -10% dev = 15pct
    ma50Pct = Math.max(5, Math.min(95, 50 + dev * 3.5));
    if (dev > 8) ma50Label = "强劲上攻";
    else if (dev > 3) ma50Label = "偏强运行";
    else if (dev > -3) ma50Label = "区间整理";
    else if (dev > -8) ma50Label = "偏弱运行";
    else ma50Label = "深度回调";
  }

  // ── 2. PE ratio → valuation level (0-100, higher = more expensive) ──
  // Rough sector benchmarks for US tech:
  //   PE < 20 → cheap (20pct), PE 20-30 → fair (50pct),
  //   PE 30-50 → elevated (75pct), PE > 50 → expensive (90pct)
  let pePct = 50;
  let peLabel = "合理";
  const peVal = fwdPe > 0 ? fwdPe : pe;
  if (peVal > 0) {
    if (peVal < 18)      { pePct = 20; peLabel = "显著低估"; }
    else if (peVal < 25) { pePct = 38; peLabel = "相对低估"; }
    else if (peVal < 32) { pePct = 52; peLabel = "合理估值"; }
    else if (peVal < 45) { pePct = 70; peLabel = "偏高警戒"; }
    else                 { pePct = 88; peLabel = "估值过热"; }
  }

  // ── 3. Price vs 200-day MA → trend health ──
  let trendPct = 50;
  let trendLabel = "中性";
  if (ma200 > 0 && price > 0) {
    const dev200 = ((price - ma200) / ma200) * 100;
    trendPct = Math.max(5, Math.min(95, 50 + dev200 * 2.5));
    if (dev200 > 15) trendLabel = "长期牛市";
    else if (dev200 > 5) trendLabel = "趋势向上";
    else if (dev200 > -5) trendLabel = "横盘整理";
    else if (dev200 > -15) trendLabel = "趋势走弱";
    else trendLabel = "深度熊市";
  }

  // ── 4. Market cap class ──
  const mktCap = quote.marketCap || 0;
  let capLabel = "";
  if (mktCap > 1e12) capLabel = (mktCap / 1e12).toFixed(1) + "T";
  else if (mktCap > 1e9) capLabel = (mktCap / 1e9).toFixed(1) + "B";
  else capLabel = (mktCap / 1e6).toFixed(0) + "M";

  return {
    price,
    ma50, ma200, pe: peVal,
    // These feed directly into HTML progress bars
    growthMomentum:  { pct: Math.round(ma50Pct), label: ma50Label,  color: ma50Pct > 55 ? "#22c55e" : ma50Pct < 45 ? "#ef4444" : "#f59e0b" },
    valuationLevel:  { pct: Math.round(pePct),   label: peLabel,    color: pePct > 65 ? "#ef4444" : pePct > 50 ? "#f59e0b" : "#22c55e" },
    trendHealth:     { pct: Math.round(trendPct), label: trendLabel, color: trendPct > 55 ? "#22c55e" : trendPct < 45 ? "#ef4444" : "#f59e0b" },
    marketCap:       capLabel,
    raw: { price, ma50, ma200, pe, fwdPe, mktCap },
  };
}

// ═══════════════════════════════════════════════════════════════
// Merge real metrics into AI-derived diagnostics
//
// Takes the `diagnostics` array from buildDiagnostics() and
// overrides Row 1 (valuation) and Row 2 (growth) with real data.
// Row 3 (competition) and Row 4 (risk) stay AI-driven.
// ═══════════════════════════════════════════════════════════════
function mergeMetrics(diagnostics, metrics) {
  if (!metrics || !diagnostics) return diagnostics;

  const rows = [...diagnostics];

  // Find and override valuation row
  const valRow = rows.find(r => r.label === "估值水位");
  if (valRow) {
    valRow.pct   = metrics.valuationLevel.pct;
    valRow.value = metrics.valuationLevel.label;
    valRow.color = metrics.valuationLevel.color;
    valRow.detail = `PE ${metrics.raw.pe > 0 ? metrics.raw.pe.toFixed(1) : "N/A"}  |  市值 ${metrics.marketCap}`;
  }

  // Find and override growth/momentum row
  const growRow = rows.find(r => r.label === "增长动能");
  if (growRow) {
    growRow.pct   = metrics.growthMomentum.pct;
    growRow.value = metrics.growthMomentum.label;
    growRow.color = metrics.growthMomentum.color;
    growRow.detail = `现价 ${metrics.price.toFixed(0)}  |  50日均 ${metrics.ma50.toFixed(0)}`;
  }

  // Add trend row if there's space (or replace signal row)
  const trendRow = rows.find(r => r.label === "技术信号" || r.label === "跟踪指标");
  if (trendRow) {
    trendRow.label = "趋势健康";
    trendRow.icon  = "📉";
    trendRow.pct   = metrics.trendHealth.pct;
    trendRow.value = metrics.trendHealth.label;
    trendRow.color = metrics.trendHealth.color;
    trendRow.detail = `200日均 ${metrics.ma200.toFixed(0)}`;
  }

  return rows;
}

// ═══════════════════════════════════════════════════════════════
// Main entry: fetch quote + compute metrics
// ═══════════════════════════════════════════════════════════════
async function fetchDiagnosticData(ticker) {
  const quote = await fetchQuote(ticker);
  if (!quote) return null;
  return computeMetrics(quote);
}

module.exports = {
  fetchQuote,
  computeMetrics,
  mergeMetrics,
  fetchDiagnosticData,
};
