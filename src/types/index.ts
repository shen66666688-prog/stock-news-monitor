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
}

export interface AISummaryNewsItem {
  title?: string;
  source?: string;
  link?: string;
}
