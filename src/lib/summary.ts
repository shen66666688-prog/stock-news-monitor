import OpenAI from "openai";
import { fetchStockNews } from "./news";
import type { AISummary } from "@/types";

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
// Prompt template — asks for a richer structured response
// ---------------------------------------------------------------------------
function buildPrompt(newsTitles: string[], sources: string[]): string {
  const newsBlock = newsTitles
    .map((t, i) => `${i + 1}. ${t}（来源：${sources[i] ?? "未知"}）`)
    .join("\n");

  return `你是一位华尔街资深投资分析师，拥有 20 年以上的金融市场经验。

请基于以下与该股票相关的 5 条最新新闻标题及来源，进行专业的投资分析：

${newsBlock}

请严格以 JSON 格式输出，不要包含任何 Markdown 标记、代码块符号或额外说明文字。输出必须是一个合法的 JSON 对象，包含以下字段：

1. title: 字符串，给这份分析一个简短的标题（例如"科技股回暖信号"），不超过 15 个中文字符。
2. sentiment: 字符串，市场综合情绪，只能是 "利好"、"利空" 或 "中性" 之一。
3. keyPoints: 字符串数组，固定 3 条最核心的投资要点提炼，每条不超过 30 个中文字符。
4. risks: 字符串数组，提炼 1-3 条潜在风险或利空因素。如果新闻中没有明确风险，也请从专业角度推断。每条不超过 30 个中文字符。
5. updatedAt: 字符串，当前 UTC 时间，格式为 ISO 8601（例如 "2026-05-30T12:00:00.000Z"）。

示例输出格式：
{"title":"科技股回暖信号","sentiment":"利好","keyPoints":["新产品发布超预期","机构普遍上调目标价","短期面临技术性回调压力"],"risks":["估值偏高存在回调风险","宏观经济不确定性仍在"],"updatedAt":"2026-05-30T12:00:00.000Z"}`;
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an AI-powered news summary for a stock symbol.
 * Gracefully falls back to a mock response when DEEPSEEK_API_KEY is not set.
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

  // 3) Call DeepSeek
  const titles = news.map((n) => n.title);
  const sources = news.map((n) => n.source);
  const prompt = buildPrompt(titles, sources);

  try {
    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "你是一个专业的金融分析师。你的回答必须始终是严格的 JSON 格式，不包含任何其他文字。",
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

    // Normalise through the robust cross-provider parser
    return normalizeSummary(parsed);
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
