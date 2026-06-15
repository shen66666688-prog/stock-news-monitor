/**
 * videoCollector.ts — 短视频信号采集器
 *
 * 采集来源：
 *   - TikTok (需要 API key)
 *   - 抖音 (需要 API key)
 *   - YouTube (需要 API key)
 *
 * 当前状态：接口骨架（stub）
 * 接入方式：
 *   1. TikTok Research API — 获取视频 caption + 评论
 *   2. YouTube Data API v3 — 获取视频标题/描述/字幕
 *   3. 抖音开放平台 — 获取视频信息
 *
 * 关键约束：
 *   - 视频内容必须转为文本后才能进入 factLayer
 *   - ASR 字幕 > 标题 > 描述 > 评论（优先级递减）
 */

import type { Signal } from "./types";

// ═══════════════════════════════════════════════════════════════
// Collector interface
// ═══════════════════════════════════════════════════════════════

interface VideoSource {
  platform: "tiktok" | "douyin" | "youtube";
  query: string;
  maxResults: number;
}

interface VideoResult {
  id: string;
  title: string;
  description: string;
  caption?: string;       // Auto-generated subtitles / ASR
  transcript?: string;    // Full transcript if available
  hashtags: string[];
  views: number;
  likes: number;
  shares: number;
  comments: number;
  commentTexts: string[]; // Top comments (for sentiment)
  publishedAt: string;
  url: string;
}

// ═══════════════════════════════════════════════════════════════
// Video → Signal converter
// ═══════════════════════════════════════════════════════════════

function videoToSignal(video: VideoResult, platform: string): Signal {
  // Content priority: transcript > caption > description > title
  const contentText = [
    video.transcript,
    video.caption,
    video.description,
    ...video.commentTexts,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    source: "video",
    subSource: platform,
    title: video.title,
    content: contentText,
    url: video.url,
    tickers: [], // Will be enriched by normalizer
    engagement: {
      views: video.views,
      likes: video.likes,
      shares: video.shares,
      comments: video.comments,
    },
    timestamp: new Date(video.publishedAt).getTime(),
    metadata: {
      platform,
      videoId: video.id,
      hashtags: video.hashtags,
      hasTranscript: !!video.transcript,
      hasCaption: !!video.caption,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// Stub collector — returns empty until API keys configured
// ═══════════════════════════════════════════════════════════════

/**
 * Collect video signals for a list of stock tickers.
 *
 * STUB: Returns empty array until platform APIs are configured.
 * To activate:
 *   1. Set TIKTOK_API_KEY / YOUTUBE_API_KEY / DOUYIN_API_KEY env vars
 *   2. Implement the platform-specific fetch logic
 */
export async function collectVideoSignals(
  _tickers: string[],
  _sources: VideoSource[] = [],
): Promise<Signal[]> {
  // STUB — no API keys configured
  // When ready, implement:
  //   1. Search for ticker-related videos on each platform
  //   2. Fetch captions/transcripts
  //   3. Convert to Signals via videoToSignal()
  //   4. Return Signal[]

  console.log("[videoCollector] STUB: no video platforms configured. Set API keys to activate.");
  return [];
}

// ═══════════════════════════════════════════════════════════════
// Manual input — for copy-pasting video data
// ═══════════════════════════════════════════════════════════════

/**
 * Manually add a video signal (e.g., from a TikTok you watched).
 * Use this for manual research until API integration is ready.
 */
export function createManualVideoSignal(params: {
  platform: string;
  title: string;
  content: string;
  views?: number;
  likes?: number;
  tickers?: string[];
  url?: string;
}): Signal {
  return {
    source: "video",
    subSource: params.platform,
    title: params.title,
    content: params.content,
    url: params.url,
    tickers: params.tickers || [],
    engagement: {
      views: params.views,
      likes: params.likes,
    },
    timestamp: Date.now(),
    metadata: { manual: true, platform: params.platform },
  };
}
