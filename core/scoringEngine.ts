/**
 * scoringEngine.ts — 爆点评分引擎 🔥
 *
 * 这是整个系统的核心价值层。评分决定"值不值得写"。
 *
 * 公式：
 *   score = 情绪冲突(0-30) + 传播性(0-25) + 资金影响(0-25) + 多源共振(0-20)
 *
 * 设计依据：
 *   历史爆款数据分析：
 *     - TSLA "被严重低估？" CTR 25.7% → 情绪冲突高 + 资金影响大
 *     - MSFT "持有微软的人今晚应该看什么？" CTR 28.5% → 传播性强 + 利益相关
 *     - TSLA "市场买的是特斯拉还是马斯克？" CTR 9.2% → 情绪冲突不足 + 传播性弱
 *
 * 爆点定义：
 *   - 多空争议大（情绪冲突 ≥ 20）
 *   - 新闻 + 社媒同时出现（多源共振 ≥ 10）
 *   - AI / 芯片 / 大盘股（资金影响 ≥ 15）
 *   - 情绪强分裂（不是温和叙事）
 */

import type { NormalizedSignal, ScoredSignal } from "./dataCollector/types";

// ═══════════════════════════════════════════════════════════════
// Dimension 1: 情绪冲突 (0-30)
//
// 衡量：内容中存在多空对立观点的强度。
// 高频冲突关键词 = 高分；中性温和叙事 = 低分。
// ═══════════════════════════════════════════════════════════════

const CONFLICT_PATTERNS: Array<{ regex: RegExp; weight: number }> = [
  // Strong conflict signals (weight 8-10 each)
  { regex: /暴跌.*超预期|业绩.*超预期.*跌|beat.*drop|beat.*fall/i, weight: 10 },
  { regex: /暴跌|崩盘|熔断|恐慌|crash|plunge|tumble|selloff/i, weight: 8 },
  { regex: /暴涨|飙升|surge|soar|rally|rocket/i, weight: 7 },
  { regex: /做空|short|空头|bear|看空|做多|long|bull|看多/i, weight: 9 },
  { regex: /分歧|争议|分裂|debate|divided|split/i, weight: 10 },

  // Moderate conflict
  { regex: /警告|风险|预警|warn|risk|威胁|threat/i, weight: 6 },
  { regex: /泡沫|bubble|高估|overvalued|贵了/i, weight: 7 },
  { regex: /机会|低估|undervalued|便宜|底部|bottom/i, weight: 6 },
  { regex: /反转|逆转|reversal|转折/i, weight: 6 },
  { regex: /质疑|怀疑|question|skeptic|doubt/i, weight: 5 },

  // Mild conflict
  { regex: /回调|pullback|调整|correction/i, weight: 4 },
  { regex: /不确定性|uncertain|不确定/i, weight: 3 },
  { regex: /超出预期|beat|超预期|低于预期|miss|不及预期/i, weight: 5 },
];

function scoreSentimentConflict(signal: NormalizedSignal): number {
  const text = signal.title + " " + signal.content;
  let score = 0;

  for (const pattern of CONFLICT_PATTERNS) {
    if (pattern.regex.test(text)) {
      score += pattern.weight;
    }
  }

  // Bonus: "业绩超预期但股价跌" pattern is the highest CTR pattern
  if (/业绩.*超预期/.test(text) && /跌|fall|drop|tumble|selloff/i.test(text)) {
    score += 5;
  }

  // Bonus: PE/估值争议
  if (/PE|估值|市盈率/.test(text) && /高|低|贵|便宜|泡沫|低估/.test(text)) {
    score += 3;
  }

  return Math.min(30, score);
}

// ═══════════════════════════════════════════════════════════════
// Dimension 2: 传播性 (0-25)
//
// 衡量：内容在小红书/抖音上的自然传播潜力。
// 具体数字 + 利益相关 + 悬念感 = 高传播性
// ═══════════════════════════════════════════════════════════════

function scoreSpreadability(signal: NormalizedSignal): number {
  let score = 0;
  const text = signal.title + " " + signal.content;

  // ── Numbers make content concrete and shareable ──
  const numberCount = (text.match(/\d+(?:\.\d+)?[%％万亿MBKx倍]/g) || []).length;
  score += Math.min(8, numberCount * 2);

  // ── Personal stake ("你的持仓", "持有XX的人") ──
  if (/你|持有|持仓|仓位|买入|卖出|抄底|减仓|观望/.test(text)) {
    score += 7;
  }

  // ── Curiosity gap / 悬念 ──
  if (/为什么|到底|究竟|背后|真相|发生了什么|怎么办/.test(text)) {
    score += 5;
  }

  // ── Question format (问题式标题 CTR 更高) ──
  if (/\?|？/.test(signal.title)) {
    score += 3;
  }

  // ── If the signal already has high engagement on social media ──
  if (signal.engagement) {
    const engagementScore = Math.min(4,
      ((signal.engagement.views || 0) > 10000 ? 2 : 0) +
      ((signal.engagement.likes || 0) > 500 ? 1 : 0) +
      ((signal.engagement.comments || 0) > 100 ? 1 : 0)
    );
    score += engagementScore;
  }

  return Math.min(25, score);
}

// ═══════════════════════════════════════════════════════════════
// Dimension 3: 资金影响 (0-25)
//
// 衡量：事件对投资者钱包的实际或感知影响。
// 大市值 + 大幅波动 + 直接影响持仓 = 高分
// ═══════════════════════════════════════════════════════════════

const HIGH_IMPACT_TICKERS = [
  "NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "GOOGL", "META",
  "ORCL", "AMD", "AVGO",
];

const MEDIUM_IMPACT_TICKERS = [
  "CRM", "ADBE", "NFLX", "INTC", "QCOM", "UBER", "PYPL",
  "BA", "JPM", "GS", "XOM",
];

function scoreCapitalImpact(signal: NormalizedSignal): number {
  let score = 0;
  const text = signal.title + " " + signal.content;

  // ── Ticker tier (market cap / retail interest) ──
  const ticker = signal.primaryTicker.toUpperCase();
  if (HIGH_IMPACT_TICKERS.includes(ticker)) {
    score += 12;
  } else if (MEDIUM_IMPACT_TICKERS.includes(ticker)) {
    score += 8;
  } else {
    score += 4;
  }

  // ── Magnitude of impact ──
  // Large % moves
  const pctMatch = text.match(/([-+]?\d+(?:\.\d+)?)\s*[%％]/g);
  if (pctMatch) {
    for (const match of pctMatch) {
      const val = parseFloat(match);
      if (Math.abs(val) >= 10) score += 5;
      else if (Math.abs(val) >= 5) score += 3;
      else if (Math.abs(val) >= 2) score += 1;
    }
  }

  // ── Directly affects portfolio decisions ──
  if (/财报|earnings|季报|年报|指引|guidance|展望/.test(text)) {
    score += 4;
  }
  if (/增发|dilution|稀释|分红|dividend|回购|buyback/.test(text)) {
    score += 3;
  }
  if (/目标价|target|评级|rating|升级|upgrade|降级|downgrade/.test(text)) {
    score += 3;
  }

  // ── Dollar amounts (larger = higher impact) ──
  const dollarMatch = text.match(/\$?(\d+(?:\.\d+)?)\s*[亿万][美]?[元金]|\$(\d+(?:\.\d+)?)\s*[BMKTB]|(\d+(?:\.\d+)?)\s*billion/i);
  if (dollarMatch) {
    score += 3;
  }

  return Math.min(25, score);
}

// ═══════════════════════════════════════════════════════════════
// Dimension 4: 多源共振 (0-20)
//
// 衡量：同一事件是否被多个独立来源报道/讨论。
// 新闻 + 社媒同时爆 = 最高质量信号（不太可能是假消息或噪音）
// ═══════════════════════════════════════════════════════════════

function scoreMultiSourceResonance(signal: NormalizedSignal): number {
  let score = 0;

  // ── Cross-source match (news + social + video) ──
  if (signal.hasCrossSourceMatch) {
    // Base score for any cross-source match
    score += 10;

    // Bonus: more sources = higher confidence
    const uniqueSources = new Set(signal.crossSourceMatches.map((id) => id.split("_")[0]));
    score += Math.min(6, uniqueSources.size * 3);
  }

  // ── Source diversity bonus ──
  // (even without explicit cross-matching, multiple sources inherently add weight)
  // This is a placeholder — actual cross-source matching happens in normalizer

  // ── Social engagement proxy ──
  if (signal.engagement) {
    const totalEngagement = (signal.engagement.views || 0) +
      (signal.engagement.likes || 0) * 10 +
      (signal.engagement.comments || 0) * 50;
    if (totalEngagement > 50000) score += 4;
    else if (totalEngagement > 10000) score += 2;
    else if (totalEngagement > 1000) score += 1;
  }

  return Math.min(20, score);
}

// ═══════════════════════════════════════════════════════════════
// Composite scorer
// ═══════════════════════════════════════════════════════════════

/**
 * Strength multiplier — signals from dailyReport (DeepSeek-processed) carry
 * 1.8x weight because the data has been verified and structured.
 */
function getStrengthMultiplier(signal: NormalizedSignal): number {
  const isStrong = signal.metadata?.isStrongSignal === true;
  if (!isStrong) return 1.0;

  const signalType = signal.metadata?.signalType as string | undefined;

  // Premium signals: sentiment and risk assessments from DeepSeek
  if (signalType === "sentiment") return 2.0;
  if (signalType === "risk") return 1.8;
  if (signalType === "keyPoint") return 1.6;

  // Market risk events and monitoring
  if (signalType === "marketRiskEvent") {
    const level = signal.metadata?.riskLevel as string;
    if (level === "高") return 1.8;
    if (level === "中") return 1.5;
    return 1.3;
  }

  return 1.5; // Default strong signal boost
}

/**
 * Score a single normalized signal across all four dimensions.
 * Returns a ScoredSignal with total score and dimension breakdown.
 *
 * Strong signals (from dailyReport/DeepSeek) receive premium weighting.
 */
export function scoreSignal(signal: NormalizedSignal): ScoredSignal {
  const sentimentConflict = scoreSentimentConflict(signal);
  const spreadability = scoreSpreadability(signal);
  const capitalImpact = scoreCapitalImpact(signal);
  const multiSourceResonance = scoreMultiSourceResonance(signal);

  const multiplier = getStrengthMultiplier(signal);
  const rawScore = sentimentConflict + spreadability + capitalImpact + multiSourceResonance;
  const score = Math.min(100, Math.round(rawScore * multiplier));

  // Generate rationale
  const parts: string[] = [];
  if (multiplier > 1.0) parts.push(`强信号×${multiplier}`);
  if (sentimentConflict >= 20) parts.push(`情绪冲突极高(${sentimentConflict})`);
  else if (sentimentConflict >= 12) parts.push(`情绪冲突明显(${sentimentConflict})`);
  if (spreadability >= 18) parts.push(`传播性强(${spreadability})`);
  if (capitalImpact >= 18) parts.push(`资金影响大(${capitalImpact})`);
  if (multiSourceResonance >= 12) parts.push(`多源共振(${multiSourceResonance})`);
  if (signal.hasCrossSourceMatch) parts.push("跨源确认");

  return {
    ...signal,
    score,
    dimensions: {
      sentimentConflict,
      spreadability,
      capitalImpact,
      multiSourceResonance,
    },
    scoringRationale: parts.length > 0 ? parts.join(" + ") : "综合评分一般",
  };
}

/**
 * Score all normalized signals.
 */
export function scoreAllSignals(signals: NormalizedSignal[]): ScoredSignal[] {
  return signals.map(scoreSignal).sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════════════════════════
// Scoring diagnostics
// ═══════════════════════════════════════════════════════════════

export function getScoringStats(scored: ScoredSignal[]): {
  avgScore: number;
  topScore: number;
  byTicker: Record<string, { count: number; avgScore: number }>;
  distribution: Record<string, number>;
} {
  const byTicker: Record<string, { total: number; count: number }> = {};
  const distribution: Record<string, number> = {
    "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0,
  };

  for (const s of scored) {
    if (!byTicker[s.primaryTicker]) {
      byTicker[s.primaryTicker] = { total: 0, count: 0 };
    }
    byTicker[s.primaryTicker].total += s.score;
    byTicker[s.primaryTicker].count++;

    if (s.score <= 20) distribution["0-20"]++;
    else if (s.score <= 40) distribution["21-40"]++;
    else if (s.score <= 60) distribution["41-60"]++;
    else if (s.score <= 80) distribution["61-80"]++;
    else distribution["81-100"]++;
  }

  const avgScore = scored.length > 0
    ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length
    : 0;

  const tickerStats: Record<string, { count: number; avgScore: number }> = {};
  for (const [t, d] of Object.entries(byTicker)) {
    tickerStats[t] = { count: d.count, avgScore: Math.round(d.total / d.count) };
  }

  return {
    avgScore: Math.round(avgScore),
    topScore: scored.length > 0 ? scored[0].score : 0,
    byTicker: tickerStats,
    distribution,
  };
}
