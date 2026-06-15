/**
 * dataCollector/types.ts — Unified signal type definitions
 *
 * All collectors (news, video, social) output this common structure,
 * enabling the downstream pipeline to process everything uniformly.
 */

/** Unified signal from any data source */
export interface Signal {
  /** Source category */
  source: "news" | "video" | "social";
  /** Specific platform or publisher */
  subSource: string;
  /** Headline / title */
  title: string;
  /** Full body text, transcript, or caption */
  content: string;
  /** Original URL */
  url?: string;
  /** Related stock tickers (extracted or tagged) */
  tickers: string[];
  /** Engagement metrics (views, likes, shares) if available */
  engagement?: {
    views?: number;
    likes?: number;
    shares?: number;
    comments?: number;
  };
  /** Unix ms timestamp */
  timestamp: number;
  /** Source-specific metadata */
  metadata?: Record<string, unknown>;
}

/** A normalized signal — enriched and deduplicated */
export interface NormalizedSignal extends Signal {
  /** Unique ID for dedup */
  id: string;
  /** Primary ticker (most relevant) */
  primaryTicker: string;
  /** Extracted keywords for scoring */
  keywords: string[];
  /** Whether this signal correlates with signals from other sources */
  hasCrossSourceMatch: boolean;
  /** Matched signal IDs from other sources */
  crossSourceMatches: string[];
}

/** A scored signal — ready for ranking */
export interface ScoredSignal extends NormalizedSignal {
  /** Composite score 0-100 */
  score: number;
  /** Dimension breakdown */
  dimensions: {
    sentimentConflict: number;   // 0-30
    spreadability: number;       // 0-25
    capitalImpact: number;       // 0-25
    multiSourceResonance: number; // 0-20
  };
  /** Why this score was given */
  scoringRationale: string;
}

/** A ranked topic — the final output before content generation */
export interface RankedTopic {
  /** Rank position (1-based) */
  rank: number;
  /** Primary ticker */
  ticker: string;
  /** Overall composite score */
  score: number;
  /** All signals contributing to this topic */
  signals: ScoredSignal[];
  /** The core conflict/narrative in one line */
  coreNarrative: string;
  /** Recommended angle for content */
  recommendedAngle: "bullish" | "bearish" | "conflict" | "data_driven";
  /** Key data points to include */
  keyDataPoints: string[];
  /** Why this ranked here */
  rationale: string;
}
