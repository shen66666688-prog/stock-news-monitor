import OpenAI from "openai";
import { fetchStockNews } from "./news";
import type { AISummary } from "@/types";
import {
  buildSummaryPrompt,
  validateSummary,
  formatValidationResult,
  createFactSheet,
  createFact,
  runWithRetry,
} from "@/core";
import type { ValidationResult, FactSheet } from "@/core";

// ---------------------------------------------------------------------------
// DeepSeek client (lazy init — won't throw if key is missing at import time)
// ---------------------------------------------------------------------------
function getDeepSeekClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === "your-deepseek-api-key-here") return null;

  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey,
    organization: undefined,
    project: undefined,
  });
}

// ---------------------------------------------------------------------------
// Mock response when no API key is configured
// ---------------------------------------------------------------------------
const MOCK_SUMMARY: AISummary = {
  title: "今日投研速览",
  sentiment: "中性",
  points: [
    "未检测到 AI 密钥",
    "请在环境变量中配置 DEEPSEEK_API_KEY",
    "以开启真正的 AI 深度解析",
  ],
  risks: ["API 密钥未配置"],
  news: [],
  mock: true,
};

// ---------------------------------------------------------------------------
// Prompt template — delegates to V2 promptEngine
// ---------------------------------------------------------------------------
function buildPrompt(newsTitles: string[], sources: string[]): string {
  return buildSummaryPrompt({
    ticker: "",
    newsTitles,
    newsSources: sources,
    // factSheet is not available at prompt-build time;
    // it will be injected by generateSummaryV2 if data is available
  });
}

// ---------------------------------------------------------------------------
// Response normaliser — robust to key-name variations across providers
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSummary(raw: any): AISummary {
  const pick = (...keys: string[]): string | string[] | undefined => {
    for (const k of keys) {
      const v = raw?.[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };

  const title = String(
    pick("title", "headline", "summaryTitle", "mainTitle") || "今日投研速览",
  );

  const sentiment = String(
    pick("sentiment", "emotion", "signal", "stance", "polarity") || "中性",
  );

  const pointsRaw =
    pick("keyPoints", "bullets", "arguments", "points", "corePoints") || [];
  const points: string[] = Array.isArray(pointsRaw)
    ? pointsRaw.map(String).filter(Boolean)
    : String(pointsRaw)
        .split(/\n|•|- /)
        .map((s) => s.trim())
        .filter(Boolean);

  const risksRaw = pick("risks", "riskPoints", "warnings", "bearCase");
  let risks: string[] = [];
  if (Array.isArray(risksRaw)) {
    risks = risksRaw.map(String).filter(Boolean);
  } else if (typeof risksRaw === "string") {
    risks = risksRaw
      .split(/\n|•/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Fallback: extract risk-like points from the main points array
  if (risks.length === 0) {
    risks = points
      .filter((p) =>
        /但|不过|风险|警惕|不确定|下调|监管|疲软|放缓|波动/i.test(p),
      )
      .slice(0, 3);
  }

  const newsRaw = pick("news", "articles", "sources");
  const news: AISummary["news"] = (() => {
    if (!Array.isArray(newsRaw)) return [];
    return newsRaw
      .map((item) => {
        if (typeof item === "string") return { title: item };
        if (typeof item === "object" && item !== null) {
          const n = item as Record<string, unknown>;
          return {
            title: typeof n.title === "string" ? n.title : undefined,
            source: typeof n.source === "string" ? n.source : undefined,
            link: typeof n.link === "string" ? n.link : undefined,
          };
        }
        return { title: undefined, source: undefined, link: undefined };
      })
      .filter(
        (n) => n.title !== undefined || n.source !== undefined || n.link !== undefined,
      );
  })();

  const updatedAt = pick("updatedAt", "time", "timestamp", "generatedAt");

  return {
    title,
    sentiment,
    points: points.slice(0, 5),
    risks: risks.slice(0, 3),
    news,
    updatedAt: typeof updatedAt === "string" ? updatedAt : undefined,
  };
}

// ---------------------------------------------------------------------------
// Build a minimal FactSheet from news data for validation
// ---------------------------------------------------------------------------
function buildNewsFactSheet(symbol: string, newsTitles: string[], newsSources: string[]): FactSheet {
  const facts = newsTitles.map((title, i) =>
    createFact({
      ticker: symbol,
      fact: title,
      value: title,
      category: "market_event" as const,
      source: newsSources[i] || "Yahoo Finance",
    }),
  );
  return createFactSheet(symbol, facts);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an AI-powered news summary for a stock symbol.
 * Gracefully falls back to a mock response when DEEPSEEK_API_KEY is not set.
 *
 * V2: Now includes validation metadata (v2 field) from the content control layer.
 */
export async function generateSummary(symbol: string): Promise<AISummary> {
  // 1) Fetch news first
  const { news } = await fetchStockNews(symbol, 5);
  if (news.length === 0) {
    return {
      title: "暂无新闻数据",
      sentiment: "中性",
      points: ["暂无相关新闻数据"],
      risks: [],
      news: [],
      mock: true,
    };
  }

  // 2) Check for API key
  const client = getDeepSeekClient();
  if (!client) {
    console.warn("DEEPSEEK_API_KEY not configured — returning mock summary");
    return MOCK_SUMMARY;
  }

  // 3) Build fact sheet from news (V2: fact layer)
  const titles = news.map((n) => n.title);
  const sources = news.map((n) => n.source);
  const newsFactSheet = buildNewsFactSheet(symbol, titles, sources);

  // 4) Call DeepSeek with V3 retry pipeline
  const prompt = buildPrompt(titles, sources);

  try {
    // ── V3: generate + validate + retry (up to 3 attempts) ──
    const result = await runWithRetry(
      // generateFn: call DeepSeek → parse → normalize
      async () => {
        const completion = await client.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "你是一个专业的金融分析师。你的回答必须始终是严格的 JSON 格式，不包含任何其他文字。禁止编造财务数字，不确定时写'未披露'。",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 800,
        });

        const raw = completion.choices[0]?.message?.content?.trim() ?? "";

        // Parse — handle potential markdown code fences
        let jsonStr = raw;
        const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
          jsonStr = fenceMatch[1].trim();
        }

        const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

        return {
          summary: normalizeSummary(parsed),
          rawJson: raw,
        };
      },
      // validateFn: check against fact sheet
      (output) => {
        const validation = validateSummary(
          {
            title: output.summary.title,
            sentiment: output.summary.sentiment,
            points: output.summary.points,
            risks: output.summary.risks,
            rawJson: output.rawJson,
          },
          newsFactSheet,
        );
        return {
          valid: validation.valid,
          level: validation.level,
          reason: validation.reason,
        };
      },
      3,
    );

    // Log retry pipeline result
    const emoji = result.status === "valid" ? "✅" : result.status === "warning" ? "⚠️" : "❌";
    console.log(
      `[V3 Pipeline] ${symbol}: ${emoji} ${result.status} (${result.attempts} attempt${result.attempts > 1 ? "s" : ""})`,
    );
    for (const a of result.attemptLog) {
      if (a.reason) console.warn(`[V3 Pipeline] ${symbol} #${a.attempt}: ${a.status} — ${a.reason}`);
    }

    const summary = result.output.summary;

    // Attach V3 metadata
    summary.v2 = {
      validationPassed: result.status !== "reject_final",
      factCount: newsFactSheet.facts.length,
      warnings: result.status === "warning" || result.status === "reject_final"
        ? result.attemptLog.filter((a) => a.reason).map((a) => a.reason!)
        : [],
      validatedAt: new Date().toISOString(),
    };

    return summary;
  } catch (error) {
    console.error("DeepSeek API call failed:", error);
    return {
      title: "AI 分析暂不可用",
      sentiment: "中性",
      points: ["AI 分析服务暂时不可用", "请稍后重试"],
      risks: ["无法评估当前风险"],
      news: [],
      mock: true,
    };
  }
}
