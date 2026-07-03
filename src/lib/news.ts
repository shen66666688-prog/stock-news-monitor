import type { NewsItem } from "@/types";
import { execSync } from "child_process";
import { trackCall, trackSuccess, trackFail, trackCacheHit } from "./apiTracker";

// ---------------------------------------------------------------------------
// Yahoo Finance via curl (the ONLY reliable proxy path from Node.js)
// ---------------------------------------------------------------------------
const PROXY_URL = process.env.HTTP_PROXY || "http://127.0.0.1:7892";
const YAHOO_SEARCH = "https://query2.finance.yahoo.com/v1/finance/search";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

function yahooFetch(url: string): any {
  const cmd = `curl -x "${PROXY_URL}" -s "${url}" --connect-timeout 15 --max-time 20 -H "User-Agent: ${UA}"`;
  const raw = execSync(cmd, { encoding: "utf-8", maxBuffer: 2 * 1024 * 1024, timeout: 25000 });
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// In-memory cache (10 min TTL — Yahoo is rate-sensitive but not quota-capped)
// ---------------------------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, CacheEntry<NewsItem[]>>();

function getCached(key: string): NewsItem[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: NewsItem[]): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface YahooNewsRaw {
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number;
  relatedTickers?: string[];
}

// Company name / ticker keyword map for title-based filtering
const TICKER_KEYWORDS: Record<string, string[]> = {
  AAPL: ["apple", "aapl", "iphone", "ipad", "macbook", "tim cook"],
  NVDA: ["nvidia", "nvda", "jensen huang", "黄仁勋"],
  TSLA: ["tesla", "tsla", "elon musk", "马斯克", "cybertruck", "model y", "model 3"],
  MSFT: ["microsoft", "msft", "satya nadella", "azure", "openai", "copilot"],
  AMZN: ["amazon", "amzn", "andy jassy", "aws"],
  GOOGL: ["google", "googl", "alphabet", "gemini", "sundar pichai"],
  META: ["meta", "facebook", "instagram", "zuckerberg", "threads", "whatsapp"],
};

/**
 * Check if an article is primarily about the given ticker.
 * Uses: (1) ticker/company keywords in title, (2) position in relatedTickers.
 */
function isArticleAboutTicker(article: YahooNewsRaw, ticker: string): boolean {
  const title = (article.title || "").toLowerCase();
  const keywords = TICKER_KEYWORDS[ticker.toUpperCase()] || [ticker.toLowerCase()];

  // Rule 1: Title contains ticker name or company keywords → primary article
  for (const kw of keywords) {
    if (title.includes(kw)) return true;
  }

  // Rule 2: Ticker is FIRST in relatedTickers → article is primarily about this stock
  // (idx=1 means secondary mention — too noisy, skip)
  const related = article.relatedTickers || [];
  const idx = related.findIndex(
    (t) => t.toUpperCase() === ticker.toUpperCase(),
  );
  if (idx === 0) return true;

  return false;
}

export async function fetchStockNews(
  symbol: string,
  count = 5,
): Promise<{ news: NewsItem[]; fromCache: boolean }> {
  const cacheKey = `yh_news_${symbol.toUpperCase()}`;

  const cached = getCached(cacheKey);
  if (cached) {
    trackCacheHit("yahoo_search");
    return { news: cached.slice(0, count), fromCache: true };
  }

  try {
    trackCall("yahoo_search");
    const url = `${YAHOO_SEARCH}?q=${symbol.toUpperCase()}&newsCount=${count}`;
    console.log(`[Yahoo Finance] curl fetch for ${symbol}…`);
    const json = yahooFetch(url);
    const rawNews: YahooNewsRaw[] = json.news || [];

    // Filter: only articles primarily about this ticker
    const relevant = rawNews.filter((n) => isArticleAboutTicker(n, symbol));

    const mapped: NewsItem[] = relevant.slice(0, count).map((n) => ({
      id: n.link || n.title || `${Date.now()}-${Math.random()}`,
      title: n.title || "无标题",
      source: n.publisher || "Yahoo Finance",
      publishedAt: n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toISOString()
        : "",
      url: n.link || "",
      relatedStocks: n.relatedTickers || [symbol.toUpperCase()],
    }));

    setCache(cacheKey, mapped);
    trackSuccess("yahoo_search");
    console.log(`[Yahoo Finance] ${symbol}: ${mapped.length} articles`);
    return { news: mapped, fromCache: false };
  } catch (error) {
    trackFail("yahoo_search", String(error));
    console.error(`fetchStockNews Yahoo failed:`, error);
    const stale = cache.get(cacheKey)?.data;
    if (stale) return { news: stale.slice(0, count), fromCache: true };
    return { news: [], fromCache: false };
  }
}
