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
    // DeepSeek doesn't support these, keep them undefined
    organization: undefined,
    project: undefined,
  });
}

// ---------------------------------------------------------------------------
// Mock response when no API key is configured
// ---------------------------------------------------------------------------
const MOCK_SUMMARY: AISummary = {
  marketSentiment: "中性",
  keyPoints: [
    "未检测到 AI 密钥",
    "请在环境变量中配置 DEEPSEEK_API_KEY",
    "以开启真正的 AI 深度解析",
  ],
  investmentNote:
    "请创建 .env.local 文件，添加 DEEPSEEK_API_KEY=你的密钥 以启用 AI 智能总结功能。",
  mock: true,
};

// ---------------------------------------------------------------------------
// Prompt template
// ---------------------------------------------------------------------------
function buildPrompt(newsTitles: string[]): string {
  const newsBlock = newsTitles
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n");

  return `你是一位华尔街资深投资分析师，拥有 20 年以上的金融市场经验。

请基于以下与该股票相关的 5 条最新新闻标题，进行专业的投资分析：

${newsBlock}

请严格以 JSON 格式输出，不要包含任何 Markdown 标记、代码块符号或额外说明文字。输出必须是一个合法的 JSON 对象，包含以下三个字段：

1. marketSentiment: 字符串，只能是 "利好"、"利空" 或 "中性" 之一。
2. keyPoints: 字符串数组，固定 3 条最核心的投资要点提炼，每条不超过 30 个中文字符。
3. investmentNote: 字符串，一句话投资参考，不超过 50 个中文字符，必须严谨专业，避免绝对化表述。

示例输出格式：
{"marketSentiment":"利好","keyPoints":["新产品发布超预期","机构普遍上调目标价","短期面临技术性回调压力"],"investmentNote":"整体偏积极，可关注回调后的布局机会，但需留意短期估值过高的风险。"}`;
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
      marketSentiment: "中性",
      keyPoints: ["暂无相关新闻数据"],
      investmentNote: "当前没有足够的新闻信息进行分析，请稍后重试。",
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
  const prompt = buildPrompt(titles);

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
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    // Parse the response — handle potential markdown code fences
    let jsonStr = raw;
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    // Validate and normalise
    const sentiment = validateSentiment(parsed.marketSentiment);
    const keyPoints = validateKeyPoints(parsed.keyPoints);
    const investmentNote = validateInvestmentNote(parsed.investmentNote);

    return { marketSentiment: sentiment, keyPoints, investmentNote };
  } catch (error) {
    console.error("DeepSeek API call failed:", error);
    // Fallback: return a friendly error summary
    return {
      marketSentiment: "中性",
      keyPoints: ["AI 分析服务暂时不可用", "请稍后重试"],
      investmentNote: "AI 引擎暂时无法响应，请检查 API 密钥或网络连接后重试。",
      mock: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------
function validateSentiment(value: unknown): AISummary["marketSentiment"] {
  if (value === "利好" || value === "利空" || value === "中性") return value;
  const s = String(value ?? "");
  if (s.includes("利好") || s.toLowerCase().includes("positive")) return "利好";
  if (s.includes("利空") || s.toLowerCase().includes("negative")) return "利空";
  return "中性";
}

function validateKeyPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return ["AI 返回数据格式异常"];
  const points = value
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);
  if (points.length < 3) {
    // Pad to 3 with generic messages
    while (points.length < 3) points.push("数据不足，无法生成更多要点");
  }
  return points.slice(0, 3);
}

function validateInvestmentNote(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "当前无法提供明确的投资参考。";
  return s.length > 80 ? s.slice(0, 80) + "..." : s;
}
