/**
 * promptEngine.ts — V2 Prompt 引擎
 *
 * 职责：
 *   - 统一管理所有 DeepSeek / OpenAI prompt
 *   - 所有 prompt 必须包含反幻觉规则
 *   - 所有 prompt 必须引用事实上下文
 *
 * 核心规则（注入到每一个 prompt 中）：
 *   1. 不允许生成财务数字（除非来自提供的 facts）
 *   2. 不允许编造事实
 *   3. 不确定的数据必须写"未披露"
 */

import type { FactSheet } from "./factLayer";
import { toFactLines } from "./factLayer";
import type { TickerAnalysis } from "./analysisLayer";
import { analysisToPromptContext } from "./analysisLayer";

// ═══════════════════════════════════════════════════════════════
// Anti-hallucination system prompt (injected into EVERY prompt)
// ═══════════════════════════════════════════════════════════════

export const ANTI_HALLUCINATION_RULES = `
【⚠️ 强制规则 — 违反即为不合格输出】

1. 禁止编造任何财务数字。
   - 你不能生成营收、利润、EPS、CapEx、增长率、PE、市值、股价等数字。
   - 除非该数字明确出现在下方"事实数据"区域中。
   - 如果某个数字你不知道 → 写"未披露"，不要猜。

2. 禁止编造事实。
   - 你不能"合理推测"公司战略、管理层意图、市场反应。
   - 你只能基于下方提供的事实数据进行总结和对比。

3. 禁止引用事实之外的数据。
   - 如果某条分析需要的数字不在 facts 中 → 使用定性描述，不要补数字。
   - 例：不能说"营收增长15%"，除非 facts 中有这条数字。

4. 不确定时必须标注。
   - 任何基于推断而非直接事实的表述，必须加"据公开信息"或"市场普遍认为"限定。
   - 任何你无法从 facts 确认的数据 → 写"未披露"。

5. 输出格式：严格 JSON，不含 Markdown 代码块标记。
`.trim();

// ═══════════════════════════════════════════════════════════════
// Prompt template types
// ═══════════════════════════════════════════════════════════════

export interface SummaryPromptInput {
  ticker: string;
  newsTitles: string[];
  newsSources: string[];
  factSheet?: FactSheet;
}

export interface AnalysisPromptInput {
  ticker: string;
  analysis: TickerAnalysis;
}

export interface TitlePoolPromptInput {
  ticker: string;
  factSheet: FactSheet;
  coreConflict?: string; // e.g. "业绩超预期但股价暴跌"
}

export interface PostPromptInput {
  ticker: string;
  factSheet: FactSheet;
  platform: "xiaohongshu" | "douyin" | "zhihu";
  targetCTR?: boolean; // If true, optimize for CTR patterns
}

// ═══════════════════════════════════════════════════════════════
// Prompt builders
// ═══════════════════════════════════════════════════════════════

/**
 * Build a summary-generation prompt.
 *
 * This replaces the inline prompt in src/lib/summary.ts's buildPrompt().
 * Key difference: if a FactSheet is provided, the AI is constrained to
 * only use those facts. Otherwise, it's limited to summarizing the news
 * without fabricating numbers.
 */
export function buildSummaryPrompt(input: SummaryPromptInput): string {
  const { ticker, newsTitles, newsSources, factSheet } = input;

  const newsBlock = newsTitles
    .map((t, i) => `${i + 1}. ${t}（来源：${newsSources[i] ?? "未知"}）`)
    .join("\n");

  let factsBlock = "";
  if (factSheet && factSheet.facts.length > 0) {
    factsBlock = `
【可引用的事实数据 — 以下是你唯一可以使用的数字】
${toFactLines(factSheet).map((l) => `  ${l}`).join("\n")}

⚠️ 以上事实数据是你生成分析时唯一可引用的数字来源。
如果你需要的某个数据不在上面 → 写"未披露"，不要编造。
`;
  } else {
    factsBlock = `
【事实数据】
（本次未提供结构化事实数据。你只能基于新闻标题进行定性总结，
不得生成任何具体的财务数字、估值数据或增长率。）
`;
  }

  return `你是一位华尔街资深投资分析师，拥有 20 年以上的金融市场经验。

请基于以下与 ${ticker} 相关的新闻标题及来源，进行专业的投资分析：

【新闻数据】
${newsBlock}

${factsBlock}

${ANTI_HALLUCINATION_RULES}

请严格以 JSON 格式输出，不要包含任何 Markdown 标记、代码块符号或额外说明文字。输出必须是一个合法的 JSON 对象，包含以下字段：

1. title: 字符串，给这份分析一个简短的标题，不超过 15 个中文字符。
2. sentiment: 字符串，市场综合情绪，只能是 "利好"、"利空" 或 "中性" 之一。
3. keyPoints: 字符串数组，固定 3 条最核心的投资要点提炼，每条不超过 30 个中文字符。
   - 每条 keyPoint 必须能在新闻或事实数据中找到直接依据。
   - 如果某条要点涉及数字，数字必须来自上方的事实数据区域。
4. risks: 字符串数组，提炼 1-3 条潜在风险或利空因素。每条不超过 30 个中文字符。
   - 风险可以从专业角度推断，但不能引用未在事实中出现的具体数字。
5. updatedAt: 字符串，当前 UTC 时间，格式为 ISO 8601。

示例输出格式：
{"title":"科技股回暖信号","sentiment":"利好","keyPoints":["新产品发布超预期","机构普遍上调目标价","短期面临技术性回调压力"],"risks":["估值偏高存在回调风险","宏观经济不确定性仍在"],"updatedAt":"${new Date().toISOString()}"}`;
}

/**
 * Build a structured analysis prompt for bull/bear content generation.
 *
 * This prompt takes the output of analysisLayer.analyzeFactSheet()
 * and asks the AI to turn it into polished, platform-ready content.
 */
export function buildAnalysisPrompt(input: AnalysisPromptInput): string {
  const { ticker, analysis } = input;
  const context = analysisToPromptContext(analysis);

  return `你是一位资深财经内容编辑，擅长将复杂的投资分析转化为普通投资者能理解的内容。

以下是关于 ${ticker} 的结构化分析数据：

${context}

${ANTI_HALLUCINATION_RULES}

请基于以上分析数据，生成以下内容（严格 JSON 格式）：

{
  "bullNarrative": "多头叙事（一段话，150字以内，只使用上方提供的数据）",
  "bearNarrative": "空头叙事（一段话，150字以内，只使用上方提供的数据）",
  "verdict": "综合判断（一句话，不超过40字）",
  "keyNumbers": ["关键数字1（来自facts）", "关键数字2", "关键数字3"]
}

⚠️ keyNumbers 中的每个数字必须能在上方"事实基础"区域中找到对应的 [来源]。
如果找不到 → 不要放进 keyNumbers。`;
}

/**
 * Build a title pool generation prompt.
 *
 * Generates 10 A/B test titles optimized for Xiaohongshu CTR patterns.
 */
export function buildTitlePoolPrompt(input: TitlePoolPromptInput): string {
  const { ticker, factSheet, coreConflict } = input;

  const conflictLine = coreConflict
    ? `核心冲突：${coreConflict}`
    : "请根据事实数据自行提炼核心冲突";

  return `你是小红书美股内容专家，CTR优化是你的核心能力。

【任务】为 ${ticker} 生成 10 个标题，用于 A/B 测试。

【事实数据】
${toFactLines(factSheet).map((l) => `  ${l}`).join("\n")}

【定位】
${conflictLine}

【CTR 优化原则 — 基于历史爆款数据】
- ✅ 用户喜欢：价格、估值、涨跌、买卖、风险、机会
- ❌ 用户不喜欢：企业家故事、商业哲学、宏大叙事
- ✅ 爆款模式：具体数字 + 冲突/悬念 + 利益相关
- ✅ 句式：问题式 > 陈述式 > 感叹式

【标题要求】
- 每个标题不超过 25 个中文字符
- 必须包含具体数字或明确的利益冲突
- 5 个偏多头角度，5 个偏空头/冲突角度
- 不要使用"震惊"、"炸裂"、"必看"等营销词

${ANTI_HALLUCINATION_RULES}

输出格式（严格 JSON）：
{
  "titles": ["标题1", "标题2", ...共10个]
}`;
}

/**
 * Build a post-generation prompt for a specific platform.
 *
 * Platform-specific tone and structure rules are baked in.
 */
export function buildPostPrompt(input: PostPromptInput): string {
  const { ticker, factSheet, platform } = input;

  const platformRules: Record<string, string> = {
    xiaohongshu: `
【小红书发布要求】
- 开头钩子必须在前 15 字内制造悬念或利益关联
- 正文分点清晰，每条配 emoji
- 结尾必须有评论区互动引导（站队型问题，不是"怎么看"）
- 标签 5-8 个，包含 #美股 #${ticker} #投资
- 全文不超过 500 字
`,
    douyin: `
【抖音发布要求】
- 封面大字标题，冲突前置
- 正文极简，每行不超过 15 字
- 3 张图配文结构：冲突 → 数据对比 → 站队引导
- 标题不超过 15 字
- 评论区引导必须简短有力
`,
    zhihu: `
【知乎发布要求】
- 开头要有"先说结论"
- 正文结构化：事实 → 分析 → 观点（三段式）
- 每个论点配数据引用
- 结尾开放性问题
- 专业但不晦涩
`,
  };

  const rules = platformRules[platform] || platformRules.xiaohongshu;

  return `你是专业的 ${platform} 美股内容创作者。

${rules}

【事实数据 — 你只能使用以下数据】
${toFactLines(factSheet).map((l) => `  ${l}`).join("\n")}

${ANTI_HALLUCINATION_RULES}

请生成以下内容（严格 JSON）：
{
  "title": "标题（符合平台规则）",
  "hook": "开头钩子（一句话）",
  "body": ["段落1", "段落2", "段落3"],
  "cta": "评论区互动引导",
  "hashtags": ["标签1", "标签2", ...]
}`;
}

// ═══════════════════════════════════════════════════════════════
// System prompts (used as the "system" role in chat completions)
// ═══════════════════════════════════════════════════════════════

export const SYSTEM_PROMPTS = {
  /** Default system prompt for all financial analysis tasks */
  financialAnalyst: `你是一个专业的金融分析师。${ANTI_HALLUCINATION_RULES.replace(/\n/g, " ")} 你的回答必须始终是严格的 JSON 格式，不包含任何其他文字。`,

  /** For content writing tasks — allows natural language but still bans fabrication */
  contentWriter: `你是一个专业的美股财经内容创作者，擅长为中文社交平台（小红书、抖音、知乎）创作高互动率内容。${ANTI_HALLUCINATION_RULES.replace(/\n/g, " ")}`,

  /** Lightweight system prompt for simple classification tasks */
  classifier: "你是一个金融数据分类助手。只输出 JSON，不要其他文字。不确定时标注'未披露'。",
};

// ═══════════════════════════════════════════════════════════════
// Prompt validation (meta: does the prompt itself follow the rules?)
// ═══════════════════════════════════════════════════════════════

/**
 * Validate that a generated prompt includes the mandatory anti-hallucination rules.
 * This is a self-check: if a prompt is missing the rules, it's a bug.
 */
export function validatePrompt(prompt: string): { valid: boolean; reason?: string } {
  const requiredPhrases = [
    "禁止编造",
    "未披露",
  ];

  for (const phrase of requiredPhrases) {
    if (!prompt.includes(phrase)) {
      return {
        valid: false,
        reason: `Prompt 缺少必要的反幻觉规则关键词: "${phrase}"`,
      };
    }
  }

  return { valid: true };
}
