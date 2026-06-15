/**
 * ranker.ts — 选题排名引擎
 *
 * 职责：
 *   1. 将 scored signals 按 ticker 聚合
 *   2. 计算每个 ticker 的综合得分
 *   3. 输出 Top 1-3 选题
 *   4. 附带推荐角度和核心叙事
 *
 * 排名逻辑：
 *   - 单一高分信号（>70）可以单独上榜
 *   - 多信号聚合的 ticker 获得加权加成
 *   - 跨源共振的 ticker 获得额外权重
 */

import type { ScoredSignal, RankedTopic } from "./dataCollector/types";

// ═══════════════════════════════════════════════════════════════
// Ticker aggregation
// ═══════════════════════════════════════════════════════════════

interface TickerAggregate {
  ticker: string;
  signals: ScoredSignal[];
  topScore: number;
  avgScore: number;
  signalCount: number;
  crossSourceCount: number;
  hasEarnings: boolean;
  hasPriceMove: boolean;
  compositeScore: number;
}

/**
 * Aggregate scored signals by ticker and compute composite scores.
 */
function aggregateByTicker(scored: ScoredSignal[]): TickerAggregate[] {
  const groups: Record<string, ScoredSignal[]> = {};

  for (const s of scored) {
    if (!groups[s.primaryTicker]) groups[s.primaryTicker] = [];
    groups[s.primaryTicker].push(s);
  }

  const aggregates: TickerAggregate[] = [];

  for (const [ticker, signals] of Object.entries(groups)) {
    const topScore = Math.max(...signals.map((s) => s.score));
    const avgScore = signals.reduce((sum, s) => sum + s.score, 0) / signals.length;
    const crossSourceCount = signals.filter((s) => s.hasCrossSourceMatch).length;
    const allText = signals.map((s) => s.title + " " + s.content).join(" ");

    // Composite score formula:
    //   topScore * 0.6 + avgScore * 0.2 + signalCount bonus + crossSource bonus
    const signalBonus = Math.min(10, signals.length * 3);
    const crossSourceBonus = Math.min(10, crossSourceCount * 5);
    const compositeScore = Math.round(
      topScore * 0.6 + avgScore * 0.2 + signalBonus + crossSourceBonus,
    );

    aggregates.push({
      ticker,
      signals,
      topScore,
      avgScore: Math.round(avgScore),
      signalCount: signals.length,
      crossSourceCount,
      hasEarnings: /财报|earnings|季报|Q\d|FY\d/i.test(allText),
      hasPriceMove: /暴跌|暴涨|跌|涨|surge|plunge|tumble|rally|%/.test(allText),
      compositeScore,
    });
  }

  return aggregates.sort((a, b) => b.compositeScore - a.compositeScore);
}

// ═══════════════════════════════════════════════════════════════
// Core narrative extraction
// ═══════════════════════════════════════════════════════════════

/**
 * Extract the core narrative from a ticker's signal cluster.
 * This is the "one-liner" that becomes the content hook.
 */
function extractCoreNarrative(agg: TickerAggregate): string {
  const allText = agg.signals.map((s) => s.title + " " + s.content).join(" ");

  // Pattern 1: Earnings beat + stock drop = strongest narrative
  if (/业绩.*超预期|earnings.*beat|beat.*estimate/i.test(allText) &&
      /跌|fall|drop|tumble|selloff|plunge/i.test(allText)) {
    return `${agg.ticker} 业绩超预期但股价暴跌——市场到底在怕什么？`;
  }

  // Pattern 2: Big price move
  if (/暴跌|暴涨|surge|plunge|tumble|rally|崩盘/i.test(allText)) {
    const direction = /暴跌|崩盘|plunge|tumble/i.test(allText) ? "暴跌" : "暴涨";
    return `${agg.ticker} ${direction}背后：多空分歧到达极点`;
  }

  // Pattern 3: AI/CapEx controversy
  if (/AI|人工智能|CapEx|资本开支|资本支出/i.test(allText) &&
      /风险|争议|担忧|泡沫|烧钱|回报/i.test(allText)) {
    return `${agg.ticker} 的AI赌注：烧钱竞赛还是下一代护城河？`;
  }

  // Pattern 4: Valuation debate
  if (/PE|估值|市盈率|泡沫|高估|低估/i.test(allText)) {
    return `${agg.ticker} 估值争议：当前价格到底贵不贵？`;
  }

  // Pattern 5: Analyst action
  if (/目标价|target|评级|rating|upgrade|downgrade/i.test(allText)) {
    return `${agg.ticker} 机构评级异动：华尔街在用钱投票`;
  }

  // Default: Use the highest-scoring signal's title
  return agg.signals[0].title;
}

/**
 * Recommend the best content angle based on signal patterns.
 */
function recommendAngle(agg: TickerAggregate): RankedTopic["recommendedAngle"] {
  const allText = agg.signals.map((s) => s.title + " " + s.content).join(" ");

  // If there's clear conflict between good/bad signals → "conflict"
  const hasBullish = /看多|bull|机会|低估|买入|buy/i.test(allText);
  const hasBearish = /看空|bear|风险|高估|卖出|sell/i.test(allText);
  if (hasBullish && hasBearish) return "conflict";

  // If mostly positive
  if (hasBullish && !hasBearish) return "bullish";

  // If mostly negative
  if (!hasBullish && hasBearish) return "bearish";

  // Default: let the data drive the narrative
  return "data_driven";
}

/**
 * Extract key data points that should appear in the content.
 */
function extractKeyDataPoints(agg: TickerAggregate): string[] {
  const points: Set<string> = new Set();
  const allText = agg.signals.map((s) => s.title + " " + s.content).join(" ");

  // Price levels
  const priceMatch = allText.match(/\$(\d+(?:\.\d+)?)/g);
  if (priceMatch) {
    for (const p of priceMatch.slice(0, 3)) {
      points.add(`股价: ${p}`);
    }
  }

  // PE ratios
  const peMatch = allText.match(/PE\s*[:：]?\s*(\d+(?:\.\d+)?)\s*[x倍×]/gi);
  if (peMatch) {
    for (const p of peMatch.slice(0, 2)) {
      points.add(p);
    }
  }

  // Growth rates
  const growthMatch = allText.match(/(\d+(?:\.\d+)?)\s*[%％]\s*(?:增长|增速|上涨|下跌|暴跌)/g);
  if (growthMatch) {
    for (const g of growthMatch.slice(0, 3)) {
      points.add(`增速: ${g}`);
    }
  }

  // Dollar amounts
  const dollarMatch = allText.match(/\$?(\d+(?:\.\d+)?)\s*[亿万][美]?[元金]/g);
  if (dollarMatch) {
    for (const d of dollarMatch.slice(0, 2)) {
      points.add(`金额: ${d}`);
    }
  }

  // Key terms
  const keyTerms = ["CapEx", "FCF", "RPO", "OCI", "OpenAI", "Blackwell", "FSD", "Robotaxi"];
  for (const term of keyTerms) {
    if (allText.includes(term)) {
      points.add(term);
    }
  }

  return [...points].slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════
// Main entry point
// ═══════════════════════════════════════════════════════════════

/**
 * Rank all scored signals, group by ticker, and output top picks.
 *
 * @param scored - Scored signals from scoringEngine
 * @param topN - Number of top picks to return (default 3)
 * @returns Ranked topics sorted by composite score
 */
export function rankTopics(
  scored: ScoredSignal[],
  topN: number = 3,
): RankedTopic[] {
  if (scored.length === 0) return [];

  // Aggregate by ticker
  const aggregates = aggregateByTicker(scored);

  // Build ranked topics
  const ranked: RankedTopic[] = [];
  const takenTickers = new Set<string>();

  for (let i = 0; i < Math.min(topN, aggregates.length); i++) {
    const agg = aggregates[i];

    // Skip duplicate tickers (shouldn't happen with proper aggregation)
    if (takenTickers.has(agg.ticker)) continue;
    takenTickers.add(agg.ticker);

    const coreNarrative = extractCoreNarrative(agg);
    const angle = recommendAngle(agg);
    const keyDataPoints = extractKeyDataPoints(agg);

    const rationaleParts: string[] = [];
    if (agg.hasEarnings && agg.hasPriceMove) {
      rationaleParts.push("财报+股价异动双重催化");
    }
    if (agg.crossSourceCount > 0) {
      rationaleParts.push(`${agg.crossSourceCount}条跨源共振信号`);
    }
    if (agg.topScore >= 70) {
      rationaleParts.push(`爆点评分${agg.topScore}`);
    }
    if (agg.signalCount >= 3) {
      rationaleParts.push(`多信号聚合(${agg.signalCount}条)`);
    }

    ranked.push({
      rank: i + 1,
      ticker: agg.ticker,
      score: agg.compositeScore,
      signals: agg.signals,
      coreNarrative,
      recommendedAngle: angle,
      keyDataPoints,
      rationale: rationaleParts.length > 0 ? rationaleParts.join(" + ") : "综合得分领先",
    });
  }

  return ranked;
}

// ═══════════════════════════════════════════════════════════════
// Formatting for display
// ═══════════════════════════════════════════════════════════════

/**
 * Format ranked topics as a human-readable "TOP PICKS" summary.
 */
export function formatTopPicks(ranked: RankedTopic[]): string {
  if (ranked.length === 0) return "无选题——今日无显著爆点信号";

  const lines = ["TOP PICKS:", ""];

  for (const topic of ranked) {
    const bar = "█".repeat(Math.min(20, Math.round(topic.score / 5)));
    const angleEmoji =
      topic.recommendedAngle === "conflict" ? "⚔️" :
      topic.recommendedAngle === "bullish" ? "📈" :
      topic.recommendedAngle === "bearish" ? "📉" : "📊";

    lines.push(`${topic.rank}. ${angleEmoji} ${topic.ticker} (${topic.score}) ${bar}`);
    lines.push(`   ${topic.coreNarrative}`);
    lines.push(`   角度: ${topic.recommendedAngle} | ${topic.rationale}`);
    if (topic.keyDataPoints.length > 0) {
      lines.push(`   数据点: ${topic.keyDataPoints.join(", ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
