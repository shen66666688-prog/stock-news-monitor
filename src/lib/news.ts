import YahooFinance from "yahoo-finance2";
import type { NewsItem } from "@/types";

// ---------------------------------------------------------------------------
// Singleton client (same pattern as stocks.ts)
// ---------------------------------------------------------------------------
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60_000; // 5 minutes — news changes slower than quotes

const cache = new Map<string, CacheEntry<NewsItem[]>>();

function getCached(key: string): NewsItem[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: NewsItem[]): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Fallback (empty — news is optional, not critical)
// ---------------------------------------------------------------------------
const FALLBACK_NEWS: NewsItem[] = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch recent news for a single stock symbol using Yahoo Finance search.
 * Returns the top 5 news items, sorted by recency.
 */
export async function fetchStockNews(
  symbol: string,
  count = 5,
): Promise<{ news: NewsItem[]; fromCache: boolean }> {
  const cacheKey = `news_${symbol.toUpperCase()}`;

  // 1) Cache hit
  const cached = getCached(cacheKey);
  if (cached) {
    return { news: cached.slice(0, count), fromCache: true };
  }

  // 2) Live API
  try {
    const result = await yahooFinance.search(symbol.toUpperCase(), {
      newsCount: count,
    });

    // yahoo-finance2 search result includes a `news` array
    const rawNews: RawNewsItem[] = result.news ?? [];

    const mapped: NewsItem[] = rawNews.slice(0, count).map(normaliseNews);

    setCache(cacheKey, mapped);
    return { news: mapped, fromCache: false };
  } catch (error) {
    console.error(`fetchStockNews("${symbol}") failed:`, error);

    // 3) Stale cache fallback
    const stale = cache.get(cacheKey)?.data;
    if (stale) {
      return { news: stale.slice(0, count), fromCache: true };
    }
    return { news: FALLBACK_NEWS, fromCache: false };
  }
}

// ---------------------------------------------------------------------------
// Types & normalisation
// ---------------------------------------------------------------------------

// yahoo-finance2 returns SearchNews[] where providerPublishTime is a Date
interface RawNewsItem {
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: Date | number;
  type?: string;
  thumbnail?: unknown;
}

function normaliseNews(raw: RawNewsItem): NewsItem {
  // providerPublishTime can be Date or number (epoch seconds) depending on version
  let publishedAt = "";
  if (raw.providerPublishTime) {
    if (raw.providerPublishTime instanceof Date) {
      publishedAt = raw.providerPublishTime.toISOString();
    } else {
      publishedAt = new Date(raw.providerPublishTime * 1000).toISOString();
    }
  }

  return {
    id: raw.link ?? raw.title ?? `${Date.now()}-${Math.random()}`,
    title: raw.title ?? "无标题",
    source: raw.publisher ?? "未知来源",
    publishedAt,
    url: raw.link ?? "",
    relatedStocks: [],
  };
}
