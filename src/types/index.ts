export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment?: "positive" | "negative" | "neutral";
  relatedStocks: string[];
}

export interface HotStock extends Stock {
  reason?: string;
  newsCount: number;
}

export interface AISummary {
  title: string;
  sentiment: string;
  points: string[];
  risks: string[];
  news: AISummaryNewsItem[];
  updatedAt?: string;
  /** Populated only when API key is not configured or fallback used */
  mock?: boolean;
  /** V2 validation metadata — added by the content control layer */
  v2?: AISummaryV2Meta;
}

/** V2 Content Control Layer validation metadata */
export interface AISummaryV2Meta {
  /** Whether the AI output passed all validation checks */
  validationPassed: boolean;
  /** Number of facts used as ground truth for validation */
  factCount: number;
  /** Validation warnings (non-blocking) */
  warnings: string[];
  /** Timestamp of V2 layer processing */
  validatedAt: string;
}

export interface AISummaryNewsItem {
  title?: string;
  source?: string;
  link?: string;
}
