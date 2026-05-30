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
