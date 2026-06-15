/**
 * normalizer.ts — 多源信号归一化层
 *
 * 职责：
 *   1. 将不同来源的原始 Signal 统一为 NormalizedSignal
 *   2. 去重（基于标题相似度）
 *   3. 自动提取股票代码（从文本中匹配）
 *   4. 识别跨源共振（同一事件多源报道）
 *   5. 提取关键词用于后续评分
 */

import type { Signal, NormalizedSignal } from "./dataCollector/types";

// ═══════════════════════════════════════════════════════════════
// Known ticker list — used for auto-extraction from text
// ═══════════════════════════════════════════════════════════════

const KNOWN_TICKERS = [
  "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META",
  "ORCL", "AMD", "INTC", "QCOM", "AVGO", "CRM", "ADBE",
  "NFLX", "DIS", "UBER", "PYPL", "SQ", "SNAP",
  "BA", "CAT", "GE", "F", "GM",
  "JPM", "GS", "BAC", "WFC", "C",
  "XOM", "CVX", "COP",
  "PFE", "MRNA", "JNJ", "UNH",
  "SPY", "QQQ", "IWM", "DIA", "VIX",
];

// Also match by common name
const TICKER_ALIASES: Record<string, string[]> = {
  AAPL: ["苹果"],
  NVDA: ["英伟达", "Nvidia"],
  TSLA: ["特斯拉", "Tesla"],
  MSFT: ["微软", "Microsoft"],
  AMZN: ["亚马逊", "Amazon"],
  GOOGL: ["谷歌", "Google", "Alphabet"],
  META: ["Meta", "Facebook"],
  ORCL: ["甲骨文", "Oracle"],
  AMD: ["AMD", "超微"],
  INTC: ["英特尔", "Intel"],
};

// ═══════════════════════════════════════════════════════════════
// ID generator
// ═══════════════════════════════════════════════════════════════

let idCounter = 0;
function generateId(source: string): string {
  idCounter++;
  return `${source.slice(0, 4)}_${Date.now()}_${idCounter}`;
}

// ═══════════════════════════════════════════════════════════════
// Ticker extraction from text
// ═══════════════════════════════════════════════════════════════

/**
 * Extract tickers from text content when not already tagged.
 * Uses known ticker list and Chinese name aliases.
 */
function extractTickers(text: string, existingTickers: string[]): string[] {
  const found = new Set(existingTickers.map((t) => t.toUpperCase()));
  const upperText = text.toUpperCase();

  // Direct ticker match
  for (const ticker of KNOWN_TICKERS) {
    // Match $TICKER or "TICKER" as a standalone word
    const pattern = new RegExp(`\\$${ticker}\\b|\\b${ticker}\\b`, "gi");
    if (pattern.test(upperText)) {
      found.add(ticker);
    }
  }

  // Alias match (Chinese names)
  for (const [ticker, aliases] of Object.entries(TICKER_ALIASES)) {
    for (const alias of aliases) {
      if (text.includes(alias)) {
        found.add(ticker);
        break;
      }
    }
  }

  return [...found];
}

// ═══════════════════════════════════════════════════════════════
// Deduplication
// ═══════════════════════════════════════════════════════════════

/**
 * Simple Jaccard-like similarity for title dedup.
 * Returns 0-1 where 1 = identical.
 */
function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 1));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

/**
 * Deduplicate signals. Groups by ticker, then removes near-duplicate titles.
 */
function deduplicateSignals(signals: NormalizedSignal[]): NormalizedSignal[] {
  const kept: NormalizedSignal[] = [];

  for (const signal of signals) {
    const isDuplicate = kept.some(
      (k) =>
        k.primaryTicker === signal.primaryTicker &&
        titleSimilarity(k.title, signal.title) > 0.6,
    );

    if (!isDuplicate) {
      kept.push(signal);
    }
  }

  return kept;
}

// ═══════════════════════════════════════════════════════════════
// Cross-source matching
// ═══════════════════════════════════════════════════════════════

/**
 * Identify signals that appear across multiple sources (news + social, etc.)
 * This is the "共振" signal — highest quality indicator.
 */
function markCrossSourceMatches(signals: NormalizedSignal[]): NormalizedSignal[] {
  // Group by primary ticker
  const byTicker: Record<string, NormalizedSignal[]> = {};
  for (const s of signals) {
    if (!byTicker[s.primaryTicker]) byTicker[s.primaryTicker] = [];
    byTicker[s.primaryTicker].push(s);
  }

  // Within each ticker group, find signals from different sources with similar titles
  for (const ticker of Object.keys(byTicker)) {
    const group = byTicker[ticker];
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i].subSource !== group[j].subSource) {
          const sim = titleSimilarity(group[i].title, group[j].title);
          if (sim > 0.3) {
            group[i].hasCrossSourceMatch = true;
            group[j].hasCrossSourceMatch = true;
            group[i].crossSourceMatches.push(group[j].id);
            group[j].crossSourceMatches.push(group[i].id);
          }
        }
      }
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════
// Keyword extraction
// ═══════════════════════════════════════════════════════════════

const KEYWORD_PATTERNS = [
  // AI / Tech
  { regex: /AI|人工智能|大模型|LLM|GPU|算力|芯片|Blackwell|H100|H200|B200/i, kw: "AI/芯片" },
  { regex: /云|cloud|OCI|AWS|Azure|GCP|SaaS/i, kw: "云计算" },
  { regex: /自动驾驶|FSD|Robotaxi|robotaxi|无人驾驶/i, kw: "自动驾驶" },
  { regex: /电动车|EV|电动汽车|交付|delivery/i, kw: "电动车" },
  // Financial
  { regex: /财报|earnings|营收|revenue|EPS|利润|profit|季报/i, kw: "财报" },
  { regex: /暴跌|暴涨|崩盘|熔断|surge|plunge|crash|tumble/i, kw: "股价异动" },
  { regex: /增发|dilution|稀释|融资|offering|ATM/i, kw: "融资/稀释" },
  { regex: /CapEx|资本开支|资本支出|投资|spending/i, kw: "资本开支" },
  { regex: /债务|debt|杠杆|leverage|评级|downgrade/i, kw: "债务风险" },
  { regex: /目标价|target|upgrade|downgrade|评级|rating/i, kw: "机构评级" },
  { regex: /PE|估值|valuation|泡沫|bubble|高估|低估/i, kw: "估值争议" },
  // Macro
  { regex: /美联储|Fed|利率|加息|降息|rate|inflation|通胀/i, kw: "宏观/利率" },
  { regex: /制裁|监管|反垄断|antitrust|调查|investigation/i, kw: "监管风险" },
  { regex: /裁员|layoff|重组|restructure|调整/i, kw: "公司变动" },
];

function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();
  for (const pattern of KEYWORD_PATTERNS) {
    if (pattern.regex.test(text)) {
      keywords.add(pattern.kw);
    }
  }
  return [...keywords];
}

// ═══════════════════════════════════════════════════════════════
// Primary ticker selection
// ═══════════════════════════════════════════════════════════════

/**
 * When a signal mentions multiple tickers, pick the most prominent one.
 * Heuristic: first ticker mentioned in title/content is primary.
 */
function selectPrimaryTicker(tickers: string[], title: string, content: string): string {
  if (tickers.length === 1) return tickers[0];

  const combinedText = (title + " " + content).toUpperCase();
  for (const ticker of tickers) {
    if (combinedText.includes(ticker)) return ticker;
  }

  return tickers[0] || "UNKNOWN";
}

// ═══════════════════════════════════════════════════════════════
// Main entry point
// ═══════════════════════════════════════════════════════════════

/**
 * Normalize raw signals from all sources into a unified, deduplicated,
 * ticker-enriched, cross-source-matched dataset.
 */
export function normalizeSignals(rawSignals: Signal[]): NormalizedSignal[] {
  // Step 1: Convert to NormalizedSignal
  let normalized = rawSignals.map((s) => {
    const tickers = extractTickers(s.title + " " + s.content, s.tickers);
    const primaryTicker = selectPrimaryTicker(tickers, s.title, s.content);

    return {
      ...s,
      id: generateId(s.source),
      primaryTicker,
      keywords: extractKeywords(s.title + " " + s.content),
      hasCrossSourceMatch: false,
      crossSourceMatches: [],
    } as NormalizedSignal;
  });

  // Step 2: Filter out signals without tickers
  const withTickers = normalized.filter((s) => s.tickers.length > 0);
  const withoutTickers = normalized.filter((s) => s.tickers.length === 0);
  if (withoutTickers.length > 0) {
    console.log(`[normalizer] Dropped ${withoutTickers.length} signals with no ticker match`);
  }
  normalized = withTickers;

  // Step 3: Deduplicate
  const beforeDedup = normalized.length;
  normalized = deduplicateSignals(normalized);
  console.log(`[normalizer] Dedup: ${beforeDedup} → ${normalized.length} signals`);

  // Step 4: Mark cross-source matches
  normalized = markCrossSourceMatches(normalized);
  const crossCount = normalized.filter((s) => s.hasCrossSourceMatch).length;
  console.log(`[normalizer] Cross-source resonance: ${crossCount} signals`);

  return normalized;
}

// ═══════════════════════════════════════════════════════════════
// Stats helper
// ═══════════════════════════════════════════════════════════════

export function getNormalizationStats(signals: NormalizedSignal[]): {
  total: number;
  bySource: Record<string, number>;
  byTicker: Record<string, number>;
  crossSourceCount: number;
} {
  const bySource: Record<string, number> = {};
  const byTicker: Record<string, number> = {};

  for (const s of signals) {
    bySource[s.source] = (bySource[s.source] || 0) + 1;
    byTicker[s.primaryTicker] = (byTicker[s.primaryTicker] || 0) + 1;
  }

  return {
    total: signals.length,
    bySource,
    byTicker,
    crossSourceCount: signals.filter((s) => s.hasCrossSourceMatch).length,
  };
}
