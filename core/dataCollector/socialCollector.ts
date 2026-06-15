/**
 * socialCollector.ts — 社交媒体信号采集器
 *
 * 采集来源：
 *   - X (Twitter) — API v2 (需要 Bearer Token)
 *   - Reddit — r/wallstreetbets, r/stocks, r/investing
 *   - 雪球 (Xueqiu) — 热门帖子/讨论
 *
 * 当前状态：Reddit 可用（免费 API），X 和雪球需要 API key
 *
 * 为什么社媒重要：
 *   - 散户情绪是反向指标还是动量指标？
 *   - 多源共振（新闻 + 社媒同时爆）是最高质量信号
 */

import type { Signal } from "./types";

// ═══════════════════════════════════════════════════════════════
// Reddit collector (free, no API key needed)
// ═══════════════════════════════════════════════════════════════

interface RedditPost {
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  subreddit: string;
  created_utc: number;
  permalink: string;
}

const REDDIT_SUBREDDITS = [
  "wallstreetbets",
  "stocks",
  "investing",
  "stockmarket",
];

/**
 * Fetch hot posts from Reddit investment subreddits.
 * Uses Reddit's free JSON API (no auth required for read-only).
 */
export async function collectRedditSignals(
  tickers: string[],
  limit: number = 25,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  for (const subreddit of REDDIT_SUBREDDITS) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
      const response = await fetch(url, {
        headers: { "User-Agent": "AI-Stock-Content-Factory/1.0" },
      });

      if (!response.ok) continue;

      const json = await response.json();
      const posts: RedditPost[] = (json?.data?.children || [])
        .map((c: { data: RedditPost }) => c.data);

      for (const post of posts) {
        // Ticker extraction: check if post mentions any of our tickers
        const combinedText = `${post.title} ${post.selftext}`.toUpperCase();
        const matchedTickers = tickers.filter((t) =>
          combinedText.includes(t.toUpperCase()),
        );

        if (matchedTickers.length > 0) {
          signals.push({
            source: "social",
            subSource: `reddit/r/${subreddit}`,
            title: post.title,
            content: post.selftext || post.title,
            url: `https://www.reddit.com${post.permalink}`,
            tickers: matchedTickers,
            engagement: {
              views: post.score, // Reddit uses score as proxy for views
              likes: post.score,
              comments: post.num_comments,
            },
            timestamp: post.created_utc * 1000,
            metadata: {
              subreddit,
              score: post.score,
              numComments: post.num_comments,
            },
          });
        }
      }
    } catch (e) {
      console.warn(`[socialCollector] Reddit r/${subreddit} failed: ${e}`);
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════
// X (Twitter) collector — STUB
// ═══════════════════════════════════════════════════════════════

/**
 * Collect X (Twitter) signals for a list of tickers.
 *
 * STUB: Returns empty until X_BEARER_TOKEN env var is set.
 * To activate: set X_BEARER_TOKEN and implement the X API v2 call.
 */
export async function collectXSignals(
  _tickers: string[],
): Promise<Signal[]> {
  // STUB
  console.log("[socialCollector] X/Twitter: STUB — set X_BEARER_TOKEN to activate.");
  return [];
}

// ═══════════════════════════════════════════════════════════════
// 雪球 (Xueqiu) collector — STUB
// ═══════════════════════════════════════════════════════════════

/**
 * Collect 雪球 signals for a list of tickers.
 *
 * STUB: Xueqiu requires authenticated API access.
 */
export async function collectXueqiuSignals(
  _tickers: string[],
): Promise<Signal[]> {
  // STUB
  console.log("[socialCollector] 雪球: STUB — API integration pending.");
  return [];
}

// ═══════════════════════════════════════════════════════════════
// Unified social collector
// ═══════════════════════════════════════════════════════════════

/**
 * Collect social signals from all available platforms.
 * Currently only Reddit is active (free API).
 */
export async function collectSocialSignals(
  tickers: string[],
): Promise<Signal[]> {
  const results = await Promise.allSettled([
    collectRedditSignals(tickers),
    collectXSignals(tickers),
    collectXueqiuSignals(tickers),
  ]);

  const signals: Signal[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      signals.push(...result.value);
    }
  }

  console.log(`[socialCollector] Collected ${signals.length} social signals across platforms`);
  return signals;
}
