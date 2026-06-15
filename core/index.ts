/**
 * core/index.ts — AI美股内容工厂 (Unified V1)
 *
 * Barrel export for the complete pipeline:
 *
 *   dataCollector → normalizer → scoringEngine → ranker
 *        ↓
 *   factLayer → promptEngine → DeepSeek → validator → retryPipeline
 *        ↓
 *   content output (小红书 / 抖音 / 海报)
 *
 * Usage:
 *   import { collectNewsSignals, normalizeSignals, scoreAllSignals,
 *            rankTopics, createFactSheet, buildSummaryPrompt,
 *            runWithRetry } from "@/core";
 */

// ── Data Collection ──
export {
  collectNewsSignals,
  collectFromNewsData,
  collectVideoSignals,
  createManualVideoSignal,
  collectSocialSignals,
  collectRedditSignals,
} from "./dataCollector";

export type {
  Signal,
  NormalizedSignal,
  ScoredSignal,
  RankedTopic,
} from "./dataCollector/types";

// ── Normalizer ──
export {
  normalizeSignals,
  getNormalizationStats,
} from "./normalizer";

// ── Scoring Engine ──
export {
  scoreSignal,
  scoreAllSignals,
  getScoringStats,
} from "./scoringEngine";

// ── Ranker ──
export {
  rankTopics,
  formatTopPicks,
} from "./ranker";

// ── Fact Layer ──
export {
  createFact,
  createFactSheet,
  factSheetFromYahooQuote,
  buildStaticFactSheet,
  getFactsByCategory,
  getFactsBySource,
  getNumericFacts,
  hasMinimumCoverage,
  toFactLines,
} from "./factLayer";

export type {
  FactItem,
  FactSheet,
  FactSource,
  FactCategory,
} from "./factLayer";

// ── Analysis Layer ──
export {
  analyzeFactSheet,
  analysisToPromptContext,
} from "./analysisLayer";

export type {
  AnalysisPoint,
  TickerAnalysis,
} from "./analysisLayer";

// ── Prompt Engine ──
export {
  buildSummaryPrompt,
  buildAnalysisPrompt,
  buildTitlePoolPrompt,
  buildPostPrompt,
  validatePrompt,
  ANTI_HALLUCINATION_RULES,
  SYSTEM_PROMPTS,
} from "./promptEngine";

export type {
  SummaryPromptInput,
  AnalysisPromptInput,
  TitlePoolPromptInput,
  PostPromptInput,
} from "./promptEngine";

// ── Validator ──
export {
  validateAIOutput,
  validateSummary,
  preValidateFactSheet,
  formatValidationResult,
} from "./validator";

export type {
  ValidationResult,
  ValidationCheck,
  AIOutput,
} from "./validator";

// ── Pipeline Orchestrator ──
export {
  runPipeline,
  checkPipelineHealth,
} from "./pipeline";

export type {
  PipelineResult,
  PipelineDiagnostics,
} from "./pipeline";

// ── Poster Template (30%+ CTR verified) ──
export {
  buildPremiumP1,
  posterBaseCSS,
  calcTitleFont,
} from "./posterTemplate";

export type {
  PosterP1Data,
} from "./posterTemplate";

// ── Retry Pipeline ──
export {
  runWithRetry,
  generateWithRetry,
} from "./retryPipeline";

export type {
  RetryResult,
} from "./retryPipeline";
