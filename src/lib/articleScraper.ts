import * as cheerio from "cheerio";
import { execSync } from "child_process";

const PROXY_URL = process.env.HTTP_PROXY || "http://127.0.0.1:7892";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

function curlHtml(url: string, timeoutMs = 15000): string {
  const cmd = `curl -x "${PROXY_URL}" -s --compressed -L "${url}" --connect-timeout 8 --max-time 12 -H "User-Agent: ${UA}" -H "Accept-Encoding: gzip, deflate"`;
  return execSync(cmd, {
    encoding: "utf-8",
    maxBuffer: 2 * 1024 * 1024,
    timeout: timeoutMs,
  });
}

/**
 * Extract clean article body text using cheerio.
 * Targets common financial news site content selectors.
 */
function extractContent(html: string): string {
  const $ = cheerio.load(html);

  // Remove noise: scripts, styles, nav, footer, ads, sidebars
  $("script, style, nav, footer, aside, iframe, .ad, .advertisement, .sidebar, .nav, .footer, .header-nav, .cookie-banner, .related, .comments, [role='navigation'], [role='banner'], .caas-da, .show-more").remove();

  // Try common article body selectors (ordered by prevalence on financial sites)
  const selectors = [
    "article",
    ".article-content",
    ".article-body",
    ".post-content",
    ".story-body",
    ".caas-body",
    '[data-testid="article-body"]',
    ".body",
    ".content-body",
    "main",
    "#article-body",
    ".article__body",
  ];

  let text = "";
  for (const sel of selectors) {
    const el = $(sel);
    if (el.length > 0) {
      text = el.text();
      if (text.trim().length > 200) break; // found real content
    }
  }

  // Fallback: grab the largest text block on the page
  if (text.trim().length < 200) {
    const body = $("body").text();
    text = body;
  }

  // Clean: normalize whitespace, remove excessive newlines
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch article text from a URL.
 * Returns up to 1200 chars of clean article body.
 */
export function fetchArticleText(url: string): string | null {
  if (!url) return null;
  try {
    const html = curlHtml(url);
    const text = extractContent(html);

    if (text.length < 50) return null;

    // Return first ~1200 meaningful chars for DeepSeek context
    return text.slice(0, 1200);
  } catch {
    return null;
  }
}

/**
 * Fetch stock fundamentals — hybrid approach:
 * - Price & 52-week range from Yahoo v8 chart API (reliable)
 * - PE & market cap from Yahoo Finance HTML page (parsed with regex)
 */
export function fetchFundamentals(symbol: string): {
  price?: string;
  pe?: string;
  marketCap?: string;
  range52w?: string;
} | null {
  const metrics: Record<string, string> = {};

  try {
    // ── Part 1: Price + 52-week range from chart v8 API ──
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
    const chartJson = curlHtml(chartUrl, 10000);
    const data = JSON.parse(chartJson);
    const result = data?.chart?.result?.[0];
    if (result) {
      const meta = result.meta || {};
      if (meta.regularMarketPrice != null) metrics.price = String(meta.regularMarketPrice);
      if (meta.fiftyTwoWeekLow != null && meta.fiftyTwoWeekHigh != null) {
        metrics.range52w = `${meta.fiftyTwoWeekLow} - ${meta.fiftyTwoWeekHigh}`;
      }
    }
  } catch {
    // Chart API failed — non-fatal, PE may still come from HTML
  }

  try {
    // ── Part 2: PE + market cap from Yahoo Finance HTML page ──
    const quoteUrl = `https://finance.yahoo.com/quote/${symbol}/`;
    const html = curlHtml(quoteUrl, 15000);

    // Extract formatted values from <fin-streamer> elements
    const peMatch = html.match(/data-field="trailingPE"[^>]*>([^<]+)</);
    const mcMatch = html.match(/data-field="marketCap"[^>]*>([^<]+)</);

    if (peMatch && peMatch[1]) metrics.pe = peMatch[1].trim();
    if (mcMatch && mcMatch[1]) metrics.marketCap = mcMatch[1].trim();

    // Fallback: try raw JSON values embedded in the page
    if (!metrics.pe) {
      const peRaw = html.match(/"trailingPE"\s*:\s*\{\s*"raw"\s*:\s*([0-9.]+)/);
      if (peRaw) metrics.pe = String(Math.round(parseFloat(peRaw[1]) * 10) / 10);
    }
    if (!metrics.marketCap) {
      const mcRaw = html.match(/"marketCap"\s*:\s*\{\s*"raw"\s*:\s*([0-9.E]+)/);
      if (mcRaw) {
        const val = parseFloat(mcRaw[1]);
        metrics.marketCap = val >= 1e12 ? `${(val / 1e12).toFixed(2)}T` : `${Math.round(val / 1e9)}B`;
      }
    }
  } catch {
    // HTML parsing failed — non-fatal, we may still have price from chart
  }

  return Object.keys(metrics).length > 0 ? metrics : null;
}
