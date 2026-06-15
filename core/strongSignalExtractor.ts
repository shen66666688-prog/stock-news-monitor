/**
 * strongSignalExtractor.ts — 强信号提取器
 *
 * 职责：
 *   从 dailyReport.json（DeepSeek 结构化日报）中提取高质量 Signal，
 *   与 news/video/social 弱信号并行输入 scoringEngine。
 *
 * 为什么 dailyReport 是"强信号"：
 *   - DeepSeek 已识别出 per-ticker sentiment（利好/利空/中性）
 *   - 已提炼 keyPoints（3条核心要点）
 *   - 已识别 risks（风险因素）
 *   - 已评估 riskLevel（高/中/低）
 *
 * 对比 Yahoo Finance search：
 *   - Search 返回的是"提及该股票的任何新闻"（泛，弱）
 *   - dailyReport 返回的是"该股票今天最重要的信息"（精准，强）
 */

import type { Signal } from "./dataCollector/types";

// ═══════════════════════════════════════════════════════════════
// dailyReport.json structure
// ═══════════════════════════════════════════════════════════════

interface DailyReportStockData {
  sentiment: string;       // "利好" | "利空" | "中性"
  keyPoints: string[];     // 3 core points
  risks: string[];         // 1-3 risks
}

interface DailyReportMonitoring {
  hasNewsUpdate: boolean;
  hasMajorEvent: boolean;
  newsSummary: string;
  riskLevel: "高" | "中" | "低";
}

interface MarketRiskEvent {
  title: string;
  summary: string;
  affectedIndustries: string[];
  riskLevel: "高" | "中" | "低";
  uncertaintyNote: string;
}

interface DailyReportData {
  marketRiskEvents?: MarketRiskEvent[];
  stockMonitoring?: Record<string, DailyReportMonitoring>;
  marketSummary?: {
    mainRiskThemes?: string[];
    marketFocusPoints?: string[];
  };
  enrichedStockData?: Record<string, DailyReportStockData>;
}

// ═══════════════════════════════════════════════════════════════
// Extractor: dailyReport → Signal[]
// ═══════════════════════════════════════════════════════════════

/**
 * Extract strong signals from a dailyReport.json.
 *
 * Each signal is tagged with source="dailyReport" and carries
 * premium metadata for the scoring engine.
 */
export function extractStrongSignals(report: DailyReportData): Signal[] {
  const signals: Signal[] = [];
  const now = Date.now();

  // ── 1. Market risk events (macro, affects multiple tickers) ──
  const events = report.marketRiskEvents || [];
  for (const event of events) {
    // Extract tickers from affected industries + summary
    const tickerMatches = extractTickersFromText(event.summary);

    signals.push({
      source: "news", // Technically it IS news, but premium-processed
      subSource: "dailyReport/riskEvent",
      title: event.title,
      content: `${event.summary}\n不确定性: ${event.uncertaintyNote}`,
      tickers: tickerMatches,
      timestamp: now,
      metadata: {
        isStrongSignal: true,
        signalType: "marketRiskEvent",
        riskLevel: event.riskLevel,
        affectedIndustries: event.affectedIndustries,
      },
    });
  }

  // ── 2. Per-stock monitoring ──
  const monitoring = report.stockMonitoring || {};
  for (const [ticker, data] of Object.entries(monitoring)) {
    if (!data.hasNewsUpdate) continue;

    signals.push({
      source: "news",
      subSource: "dailyReport/monitoring",
      title: `${ticker} ${data.riskLevel === "高" ? "⚠️" : data.riskLevel === "中" ? "⚡" : "📌"} 风险等级: ${data.riskLevel}`,
      content: data.newsSummary,
      tickers: [ticker.toUpperCase()],
      timestamp: now,
      metadata: {
        isStrongSignal: true,
        signalType: "stockMonitoring",
        riskLevel: data.riskLevel,
        hasMajorEvent: data.hasMajorEvent,
      },
    });
  }

  // ── 3. Per-stock enriched data (highest quality) ──
  const enriched = report.enrichedStockData || {};
  for (const [ticker, data] of Object.entries(enriched)) {
    // Convert each keyPoint into its own signal
    for (const point of data.keyPoints) {
      if (!point || point === "暂无足够新闻数据进行分析" || point === "AI分析暂不可用") continue;

      signals.push({
        source: "news",
        subSource: "dailyReport/keyPoint",
        title: `${ticker}: ${point}`,
        content: point,
        tickers: [ticker.toUpperCase()],
        timestamp: now,
        metadata: {
          isStrongSignal: true,
          signalType: "keyPoint",
          sentiment: data.sentiment,
        },
      });
    }

    // Convert each risk into its own signal (bearish angle)
    for (const risk of data.risks) {
      if (!risk || risk === "无法评估当前风险" || risk === "信息不足，无法评估风险") continue;

      signals.push({
        source: "news",
        subSource: "dailyReport/risk",
        title: `${ticker} ⚠️ ${risk}`,
        content: risk,
        tickers: [ticker.toUpperCase()],
        timestamp: now,
        metadata: {
          isStrongSignal: true,
          signalType: "risk",
          sentiment: data.sentiment,
        },
      });
    }

    // Sentiment signal (the overall assessment)
    if (data.sentiment && data.sentiment !== "中性") {
      signals.push({
        source: "news",
        subSource: "dailyReport/sentiment",
        title: `${ticker} 今日情绪: ${data.sentiment}`,
        content: `${ticker} 综合情绪判定为${data.sentiment}。关键要点: ${data.keyPoints.slice(0, 2).join("; ")}`,
        tickers: [ticker.toUpperCase()],
        timestamp: now,
        metadata: {
          isStrongSignal: true,
          signalType: "sentiment",
          sentiment: data.sentiment,
        },
      });
    }
  }

  console.log(`[strongSignalExtractor] Extracted ${signals.length} strong signals from dailyReport`);
  console.log(`   Risk events: ${events.length}`);
  console.log(`   Stock monitoring: ${Object.keys(monitoring).length}`);
  console.log(`   Enriched data: ${Object.keys(enriched).length} tickers`);

  return signals;
}

// ═══════════════════════════════════════════════════════════════
// Helper: extract tickers from text
// ═══════════════════════════════════════════════════════════════

function extractTickersFromText(text: string): string[] {
  const tickers = [
    "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META",
    "ORCL", "AMD", "INTC", "QCOM", "AVGO", "CRM", "ADBE",
  ];

  const found = new Set<string>();
  const upperText = text.toUpperCase();

  for (const ticker of tickers) {
    if (upperText.includes(ticker)) {
      found.add(ticker);
    }
  }

  return [...found];
}
