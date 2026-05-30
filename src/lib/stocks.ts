import YahooFinance from "yahoo-finance2";
import type { Stock } from "@/types";

// ---------------------------------------------------------------------------
// Yahoo Finance v3 client (class-based, singleton)
// ---------------------------------------------------------------------------
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

// ---------------------------------------------------------------------------
// Hot stocks configuration
// ---------------------------------------------------------------------------
export const HOT_SYMBOLS = ["AAPL", "TSLA", "NVDA", "MSFT", "PLTR"] as const;

// ---------------------------------------------------------------------------
// Simple in-memory cache
// ---------------------------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds to avoid hitting rate limits

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Fallback data — used when the API is unreachable
// ---------------------------------------------------------------------------
function getFallbackStocks(): Stock[] {
  return [
    { symbol: "AAPL", name: "Apple Inc.", price: 0, change: 0, changePercent: 0, volume: 0 },
    { symbol: "TSLA", name: "Tesla Inc.", price: 0, change: 0, changePercent: 0, volume: 0 },
    { symbol: "NVDA", name: "NVIDIA Corp.", price: 0, change: 0, changePercent: 0, volume: 0 },
    { symbol: "MSFT", name: "Microsoft Corp.", price: 0, change: 0, changePercent: 0, volume: 0 },
    { symbol: "PLTR", name: "Palantir Technologies", price: 0, change: 0, changePercent: 0, volume: 0 },
  ];
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Fetch quotes for the configured hot symbols.
 * Uses 60-second in-memory caching and falls back to a safe default on error.
 */
export async function fetchHotStocks(): Promise<{ stocks: Stock[]; fromCache: boolean }> {
  const cacheKey = "hot_stocks";

  // 1) Return cached data if still fresh
  const cached = getCached<Stock[]>(cacheKey);
  if (cached) {
    return { stocks: cached, fromCache: true };
  }

  // 2) Try the live API
  try {
    const quotes = await yahooFinance.quote([...HOT_SYMBOLS]);

    // Normalise array-vs-single response
    const results = (Array.isArray(quotes) ? quotes : [quotes]).map(mapQuoteToStock);

    // Sort back to config order
    const ordered = [...HOT_SYMBOLS]
      .map((sym) => results.find((s) => s.symbol === sym))
      .filter((s): s is Stock => s != null);

    setCache(cacheKey, ordered);
    return { stocks: ordered, fromCache: false };
  } catch (error) {
    console.error("fetchHotStocks failed, using fallback:", error);

    // 3) If we have stale cache, prefer it over the zero-filled fallback
    const stale = cache.get(cacheKey)?.data as Stock[] | undefined;
    if (stale) {
      return { stocks: stale, fromCache: true };
    }
    return { stocks: getFallbackStocks(), fromCache: false };
  }
}

/**
 * Search for a single stock by symbol.
 */
export async function searchStock(symbol: string): Promise<Stock | null> {
  const cacheKey = `stock_${symbol.toUpperCase()}`;

  const cached = getCached<Stock>(cacheKey);
  if (cached) return cached;

  try {
    // yahoo-finance2 v3 returns a single Quote object for a string argument.
    // Cast through unknown because the TypeScript types vary by overload.
    const quote = (await yahooFinance.quote(symbol.toUpperCase())) as unknown;

    if (
      !quote ||
      typeof quote !== "object" ||
      !("regularMarketPrice" in (quote as Record<string, unknown>))
    ) {
      return null;
    }

    const stock = mapQuoteToStock(quote);
    setCache(cacheKey, stock);
    return stock;
  } catch (error) {
    console.error(`searchStock("${symbol}") failed:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal mapper
// ---------------------------------------------------------------------------

// Map a raw yahoo-finance2 quote result to our Stock type.
// We accept unknown because the library returns different shapes based on
// whether you pass a string or string[].
function mapQuoteToStock(q: unknown): Stock {
  const r = q as Record<string, unknown>;
  return {
    symbol: (r.symbol as string) ?? "",
    name: (r.shortName as string) ?? (r.longName as string) ?? (r.symbol as string) ?? "",
    price: (r.regularMarketPrice as number) ?? 0,
    change: (r.regularMarketChange as number) ?? 0,
    changePercent: (r.regularMarketChangePercent as number) ?? 0,
    volume: (r.regularMarketVolume as number) ?? 0,
    marketCap: r.marketCap ? formatMarketCap(r.marketCap as number) : undefined,
  };
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  return `${value}`;
}
