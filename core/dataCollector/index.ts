/**
 * dataCollector/index.ts — Unified multi-source signal collection
 */

export type {
  Signal,
  NormalizedSignal,
  ScoredSignal,
  RankedTopic,
} from "./types";

export {
  collectNewsSignals,
  collectFromNewsData,
} from "./newsCollector";

export {
  collectVideoSignals,
  createManualVideoSignal,
} from "./videoCollector";

export {
  collectSocialSignals,
  collectRedditSignals,
  collectXSignals,
  collectXueqiuSignals,
} from "./socialCollector";
