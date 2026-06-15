/**
 * factLayer.ts — V2 事实层
 *
 * 职责：
 *   - 只允许存储"可验证数据"
 *   - 数据必须带 source 字段
 *   - 禁止任何 AI 推测数据进入
 *
 * 这是整个 V2 控制层的基础。所有进入分析层和内容层的数据，
 * 必须先经过事实层的校验。
 *
 * 设计原则：
 *   - Facts only. No interpretation.
 *   - Every datum has a traceable source.
 *   - AI cannot "fill in" missing numbers.
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Acceptable data sources */
export type FactSource =
  | "SEC"           // 10-Q, 10-K, 8-K filings
  | "Yahoo Finance" // Market data, quotes
  | "Reuters"       // News wire
  | "Bloomberg"     // Terminal data
  | "Company IR"    // Official investor relations / earnings call
  | "Earnings Call" // Transcript
  | "Benzinga"      // Earnings news
  | "CNBC"          // Financial news
  | "Nasdaq"        // Exchange data / news
  | "MarketBeat"    // Analyst ratings aggregator
  | "TipRanks"      // Analyst data
  | string;         // Allow other named sources (must be explicit, never "AI")

/** Category of fact — used for validation rules */
export type FactCategory =
  | "price"           // Stock price, 52w range
  | "valuation"       // PE, PS, PB, EV/EBITDA
  | "market_cap"      // Market capitalization
  | "revenue"         // Revenue, sales
  | "earnings"        // EPS, net income
  | "growth_rate"     // YoY / QoQ growth %
  | "capital_expense" // CapEx, capital expenditure
  | "free_cash_flow"  // FCF
  | "debt"            // Total debt, net debt
  | "fundraising"     // Equity/debt issuance plans
  | "backlog"         // RPO, order book
  | "customer"        // Customer concentration
  | "guidance"        // Company guidance / outlook
  | "analyst_rating"  // Analyst target price, rating
  | "cloud_metrics"   // Cloud revenue, OCI, AWS, Azure metrics
  | "competitor"      // Competitor data for context
  | "market_event"    // News event, market reaction
  | "sentiment"       // Market sentiment indicator
  | "other";          // Catch-all

/**
 * A single verifiable fact.
 *
 * Rules:
 *   - `value` must be a concrete datum (number or string), never an interpretation
 *   - `source` is required and must be traceable
 *   - `category` enables downstream validators to cross-check
 *   - `verifiedAt` is ISO timestamp
 *   - `sourceUrl` is optional but strongly recommended
 */
export interface FactItem {
  ticker: string;
  fact: string;         // Human-readable fact statement, e.g. "Q4 FY2026 revenue: $19.18B"
  value: number | string; // Machine-readable value
  category: FactCategory;
  source: FactSource;
  sourceUrl?: string;
  verifiedAt: string;   // ISO 8601
  notes?: string;       // Optional context (e.g. "Exceeded guidance of $19.10B")
}

/**
 * A collection of facts for a single ticker, forming the
 * complete input to the analysis layer.
 */
export interface FactSheet {
  ticker: string;
  generatedAt: string;
  facts: FactItem[];
  /** Count of facts by category, for quick validation */
  coverage: Partial<Record<FactCategory, number>>;
}

// ═══════════════════════════════════════════════════════════════
// Factory — the ONLY way to create a FactItem
// ═══════════════════════════════════════════════════════════════

/**
 * Create a single fact. This is the only entry point for fact creation.
 * All fields except `notes` and `sourceUrl` are required.
 *
 * @throws {Error} if source is "AI" or empty — this is a hard block
 * @throws {Error} if value is NaN when it should be a number
 */
export function createFact(params: {
  ticker: string;
  fact: string;
  value: number | string;
  category: FactCategory;
  source: FactSource;
  sourceUrl?: string;
  notes?: string;
}): FactItem {
  // ── Hard block: source cannot be AI ──
  const sourceLower = params.source.toLowerCase().trim();
  if (
    sourceLower === "ai" ||
    sourceLower === "deepseek" ||
    sourceLower === "chatgpt" ||
    sourceLower === "llm" ||
    sourceLower === "estimated" ||
    sourceLower === "推测" ||
    sourceLower === "估计" ||
    sourceLower === "合理估计" ||
    sourceLower === ""
  ) {
    throw new Error(
      `[factLayer] REJECTED: fact source cannot be "${params.source}". ` +
      `All facts must come from verifiable external sources (SEC, Yahoo Finance, Reuters, Bloomberg, etc.). ` +
      `Fact: "${params.fact}"`
    );
  }

  // ── Hard block: numeric values must be actual numbers ──
  if (typeof params.value === "number" && isNaN(params.value)) {
    throw new Error(
      `[factLayer] REJECTED: numeric value is NaN. Fact: "${params.fact}"`
    );
  }

  return {
    ticker: params.ticker.toUpperCase(),
    fact: params.fact,
    value: params.value,
    category: params.category,
    source: params.source,
    sourceUrl: params.sourceUrl,
    verifiedAt: new Date().toISOString(),
    notes: params.notes,
  };
}

// ═══════════════════════════════════════════════════════════════
// FactSheet builder
// ═══════════════════════════════════════════════════════════════

/**
 * Create a FactSheet from an array of FactItems.
 * Automatically computes coverage stats.
 */
export function createFactSheet(ticker: string, facts: FactItem[]): FactSheet {
  const coverage: Record<string, number> = {};

  for (const f of facts) {
    coverage[f.category] = (coverage[f.category] || 0) + 1;
  }

  return {
    ticker: ticker.toUpperCase(),
    generatedAt: new Date().toISOString(),
    facts,
    coverage,
  };
}

// ═══════════════════════════════════════════════════════════════
// Query helpers
// ═══════════════════════════════════════════════════════════════

/** Get all facts of a specific category */
export function getFactsByCategory(sheet: FactSheet, category: FactCategory): FactItem[] {
  return sheet.facts.filter((f) => f.category === category);
}

/** Get all facts from a specific source */
export function getFactsBySource(sheet: FactSheet, source: FactSource): FactItem[] {
  return sheet.facts.filter((f) => f.source === source);
}

/** Get all numeric facts */
export function getNumericFacts(sheet: FactSheet): FactItem[] {
  return sheet.facts.filter((f) => typeof f.value === "number");
}

/** Check if the sheet has at least one fact in each required category */
export function hasMinimumCoverage(
  sheet: FactSheet,
  requiredCategories: FactCategory[],
): { ok: boolean; missing: FactCategory[] } {
  const missing = requiredCategories.filter((cat) => !sheet.coverage[cat]);
  return { ok: missing.length === 0, missing };
}

/** Extract all fact statements as a plain string array (for prompt injection) */
export function toFactLines(sheet: FactSheet): string[] {
  return sheet.facts.map(
    (f) => `[${f.source}] ${f.fact}` + (f.notes ? ` (${f.notes})` : ""),
  );
}

// ═══════════════════════════════════════════════════════════════
// Yahoo Finance → FactSheet converter
// ═══════════════════════════════════════════════════════════════

/**
 * Convert Yahoo Finance quote data into a minimal FactSheet.
 * This bridges the existing dataFetcher.js into the V2 layer.
 */
export function factSheetFromYahooQuote(
  ticker: string,
  quote: {
    regularMarketPrice?: number;
    fiftyDayAverage?: number;
    twoHundredDayAverage?: number;
    trailingPE?: number;
    forwardPE?: number;
    marketCap?: number;
    regularMarketVolume?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    shortName?: string;
    longName?: string;
  },
): FactSheet {
  const facts: FactItem[] = [];
  const t = ticker.toUpperCase();
  const src: FactSource = "Yahoo Finance";

  if (quote.regularMarketPrice && quote.regularMarketPrice > 0) {
    facts.push(createFact({
      ticker: t,
      fact: `${t} 最新股价: $${quote.regularMarketPrice.toFixed(2)}`,
      value: quote.regularMarketPrice,
      category: "price",
      source: src,
    }));
  }

  if (quote.fiftyTwoWeekHigh && quote.fiftyTwoWeekHigh > 0) {
    facts.push(createFact({
      ticker: t,
      fact: `${t} 52周最高价: $${quote.fiftyTwoWeekHigh.toFixed(2)}`,
      value: quote.fiftyTwoWeekHigh,
      category: "price",
      source: src,
      notes: quote.fiftyTwoWeekLow ? `52周最低: $${quote.fiftyTwoWeekLow.toFixed(2)}` : undefined,
    }));
  }

  if (quote.trailingPE && quote.trailingPE > 0) {
    facts.push(createFact({
      ticker: t,
      fact: `${t} 静态PE (TTM): ${quote.trailingPE.toFixed(1)}x`,
      value: quote.trailingPE,
      category: "valuation",
      source: src,
    }));
  }

  if (quote.forwardPE && quote.forwardPE > 0) {
    facts.push(createFact({
      ticker: t,
      fact: `${t} 远期PE: ${quote.forwardPE.toFixed(1)}x`,
      value: quote.forwardPE,
      category: "valuation",
      source: src,
    }));
  }

  if (quote.marketCap && quote.marketCap > 0) {
    const capStr = quote.marketCap > 1e12
      ? `$${(quote.marketCap / 1e12).toFixed(2)}T`
      : `$${(quote.marketCap / 1e9).toFixed(1)}B`;
    facts.push(createFact({
      ticker: t,
      fact: `${t} 市值: ${capStr}`,
      value: quote.marketCap,
      category: "market_cap",
      source: src,
    }));
  }

  return createFactSheet(t, facts);
}

// ═══════════════════════════════════════════════════════════════
// Static fact builder — for manually researched data
// ═══════════════════════════════════════════════════════════════

/**
 * Build a FactSheet from manually curated data (e.g., from SEC filings,
 * earnings calls, Bloomberg/Reuters).
 *
 * Use this when you have hand-researched data that goes beyond
 * what Yahoo Finance provides.
 */
export function buildStaticFactSheet(
  ticker: string,
  facts: Array<{
    fact: string;
    value: number | string;
    category: FactCategory;
    source: FactSource;
    sourceUrl?: string;
    notes?: string;
  }>,
): FactSheet {
  const items = facts.map((f) => createFact({ ticker, ...f }));
  return createFactSheet(ticker, items);
}
