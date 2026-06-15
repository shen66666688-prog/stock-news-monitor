/**
 * newsCollector.ts — 新闻信号采集器
 *
 * 采集来源：
 *   - Yahoo Finance (已集成)
 *   - 未来可扩展：Reuters, Bloomberg, 财联社
 *
 * 输出：统一的 Signal[] 结构
 */

import type { Signal } from "./types";

// ═══════════════════════════════════════════════════════════════
// Yahoo Finance news → Signal converter
// ═══════════════════════════════════════════════════════════════

interface YahooNewsItem {
  title: string;
  publisher: string;
  link: string;
  tickers?: string[];
  publishedAt?: string;
}

/**
 * Convert Yahoo Finance news items to unified Signals.
 */
function yahooToSignals(news: YahooNewsItem[]): Signal[] {
  return news.map((n) => ({
    source: "news" as const,
    subSource: n.publisher || "Yahoo Finance",
    title: n.title,
    content: n.title, // Yahoo news API only gives titles in search results
    url: n.link || undefined,
    tickers: n.tickers || [],
    engagement: undefined,
    timestamp: n.publishedAt ? new Date(n.publishedAt).getTime() : Date.now(),
    metadata: {
      publisher: n.publisher,
    },
  }));
}

/**
 * Fetch news signals for a list of tickers.
 *
 * This wraps the existing Yahoo Finance integration in src/lib/news.ts
 * but is designed to work standalone or with a provided fetch function.
 */
export async function collectNewsSignals(
  tickers: string[],
  fetchNews?: (ticker: string, count: number) => Promise<YahooNewsItem[]>,
): Promise<Signal[]> {
  const allSignals: Signal[] = [];

  for (const ticker of tickers) {
    try {
      if (fetchNews) {
        const news = await fetchNews(ticker, 5);
        const signals = yahooToSignals(
          news.map((n) => ({ ...n, tickers: [ticker] })),
        );
        allSignals.push(...signals);
      }
    } catch (e) {
      console.warn(`[newsCollector] Failed to fetch news for ${ticker}: ${e}`);
    }
  }

  return allSignals;
}

/**
 * Collect news signals from a pre-fetched data object.
 * This is the integration point for dailyReportGenerator.js.
 */
export function collectFromNewsData(
  allNews: Record<string, Array<{ title: string; publisher: string; link: string }>>,
): Signal[] {
  const signals: Signal[] = [];

  for (const [ticker, newsItems] of Object.entries(allNews)) {
    for (const item of newsItems) {
      signals.push({
        source: "news",
        subSource: item.publisher || "Yahoo Finance",
        title: item.title,
        content: item.title,
        url: item.link || undefined,
        tickers: [ticker.toUpperCase()],
        engagement: undefined,
        timestamp: Date.now(),
        metadata: { publisher: item.publisher },
      });
    }
  }

  return signals;
}
