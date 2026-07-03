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
import { fetchArticleText, fetchFundamentals } from "./articleScraper";
import { trackCall, trackSuccess, trackFail } from "./apiTracker";

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
// Prompt template — delegates to V2 promptEngine, now with article content
// ---------------------------------------------------------------------------
function buildPrompt(newsTitles: string[], sources: string[], articleContents?: string[], fundamentals?: Record<string, string> | null): string {
  return buildSummaryPrompt({
    ticker: "",
    newsTitles,
    newsSources: sources,
    articleContents: articleContents || newsTitles,
    fundamentals: fundamentals || undefined,
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

  const hook = pick("hook") as string | undefined;
  const updatedAt = pick("updatedAt", "time", "timestamp", "generatedAt");

  return {
    title,
    sentiment,
    points: points.slice(0, 5),
    risks: risks.slice(0, 3),
    news,
    updatedAt: typeof updatedAt === "string" ? updatedAt : undefined,
    hook: typeof hook === "string" ? hook : undefined,
  };
}

// ---------------------------------------------------------------------------
// Build FactSheet from news data + fundamentals for validation
// ---------------------------------------------------------------------------
function buildNewsFactSheet(
  symbol: string,
  newsTitles: string[],
  newsSources: string[],
  fundamentals?: Record<string, string> | null,
  articleContents?: string[],
): FactSheet {
  const facts: ReturnType<typeof createFact>[] = [];

  // 1) Article titles as market_event facts (string values)
  for (let i = 0; i < newsTitles.length; i++) {
    facts.push(createFact({
      ticker: symbol,
      fact: newsTitles[i],
      value: newsTitles[i],
      category: "market_event" as const,
      source: newsSources[i] || "Yahoo Finance",
    }));
  }

  // 2) Article content snippets (first 300 chars per article for validator matching)
  if (articleContents) {
    for (let i = 0; i < articleContents.length; i++) {
      const snippet = articleContents[i]?.slice(0, 300);
      if (snippet && snippet.length > 50) {
        facts.push(createFact({
          ticker: symbol,
          fact: `[Article ${i + 1}] ${snippet}`,
          value: snippet,
          category: "market_event" as const,
          source: newsSources[i] || "Yahoo Finance",
        }));
      }
    }
  }

  // 2) Fundamentals as NUMERIC facts (so validator's extractNumbers can match them)
  if (fundamentals) {
    // Parse price
    const priceRaw = fundamentals.price;
    if (priceRaw) {
      const price = parseFloat(priceRaw);
      if (!isNaN(price) && price > 0) {
        facts.push(createFact({
          ticker: symbol,
          fact: `${symbol} 最新股价: $${price.toFixed(2)}`,
          value: price,
          category: "price",
          source: "Yahoo Finance",
        }));
      }
    }

    // Parse PE
    const peRaw = fundamentals.pe;
    if (peRaw) {
      const pe = parseFloat(peRaw);
      if (!isNaN(pe) && pe > 0) {
        facts.push(createFact({
          ticker: symbol,
          fact: `${symbol} 静态PE (TTM): ${pe.toFixed(1)}x`,
          value: pe,
          category: "valuation",
          source: "Yahoo Finance",
        }));
      }
    }

    // Parse market cap (handles "4.533T" / "453.3B" formats)
    const mcRaw = fundamentals.marketCap;
    if (mcRaw) {
      let mc: number | null = null;
      const mcClean = mcRaw.trim().toUpperCase();
      if (mcClean.endsWith("T")) {
        mc = parseFloat(mcClean) * 1e12;
      } else if (mcClean.endsWith("B")) {
        mc = parseFloat(mcClean) * 1e9;
      } else if (mcClean.endsWith("M")) {
        mc = parseFloat(mcClean) * 1e6;
      } else {
        mc = parseFloat(mcClean.replace(/,/g, ""));
      }
      if (mc !== null && !isNaN(mc) && mc > 0) {
        const capStr = mc >= 1e12
          ? `$${(mc / 1e12).toFixed(2)}T`
          : `$${(mc / 1e9).toFixed(1)}B`;
        facts.push(createFact({
          ticker: symbol,
          fact: `${symbol} 市值: ${capStr}`,
          value: mc,
          category: "market_cap",
          source: "Yahoo Finance",
        }));
      }
    }

    // Parse 52-week range ("201.50 - 317.40")
    const rangeRaw = fundamentals.range52w;
    if (rangeRaw) {
      const parts = rangeRaw.split(/[-–—]/);
      if (parts.length === 2) {
        const lo = parseFloat(parts[0].trim());
        const hi = parseFloat(parts[1].trim());
        if (!isNaN(lo) && lo > 0) {
          facts.push(createFact({
            ticker: symbol,
            fact: `${symbol} 52周最低价: $${lo.toFixed(2)}`,
            value: lo,
            category: "price",
            source: "Yahoo Finance",
          }));
        }
        if (!isNaN(hi) && hi > 0) {
          facts.push(createFact({
            ticker: symbol,
            fact: `${symbol} 52周最高价: $${hi.toFixed(2)}`,
            value: hi,
            category: "price",
            source: "Yahoo Finance",
          }));
        }
      }
    }
  }

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

  // 2) Scrape article content for top 3 news (so AI has real text, not just titles)
  console.log(`[ArticleScraper] ${symbol}: fetching content for top news…`);
  const enrichedNews = await Promise.all(
    news.slice(0, 3).map(async (n) => {
      if (n.url) {
        const text = fetchArticleText(n.url);
        return { ...n, contentSnippet: text };
      }
      return { ...n, contentSnippet: null };
    })
  );
  // Log what we got
  for (const en of enrichedNews) {
    const len = en.contentSnippet?.length || 0;
    console.log(`  📰 ${en.title.slice(0, 50)}… → ${len} chars`);
  }

  // 3) Check for API key
  const client = getDeepSeekClient();
  if (!client) {
    console.warn("DEEPSEEK_API_KEY not configured — returning mock summary");
    return MOCK_SUMMARY;
  }

  // 4) Fetch fundamentals (price, PE, market cap from Yahoo quote page)
  console.log(`[Fundamentals] ${symbol}: fetching…`);
  const fundamentals = fetchFundamentals(symbol);
  if (fundamentals && Object.keys(fundamentals).length > 0) {
    console.log(`  💰 ${symbol}: price=${fundamentals.price || "N/A"} PE=${fundamentals.pe || "N/A"}`);
  }

  // 5) Build fact sheet from enriched news + fundamentals (WITH numeric values)
  const titles = enrichedNews.map((n) => n.title);
  const sources = enrichedNews.map((n) => n.source);
  const articleContents = enrichedNews.map((n) => n.contentSnippet || n.title);

  const newsFactSheet = buildNewsFactSheet(symbol, titles, sources, fundamentals, articleContents);

  // 6) Call DeepSeek with V3 retry pipeline — real articles + fundamentals
  trackCall("deepseek");
  const prompt = buildPrompt(titles, sources, articleContents, fundamentals);

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

    trackSuccess("deepseek");
    return summary;
  } catch (error) {
    trackFail("deepseek", String(error));
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
