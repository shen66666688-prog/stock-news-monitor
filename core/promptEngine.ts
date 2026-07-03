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
  articleContents?: string[];
  factSheet?: FactSheet;
  fundamentals?: Record<string, string>;
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
  const { ticker, newsTitles, newsSources, articleContents, factSheet, fundamentals } = input;

  const newsBlock = newsTitles
    .map((t, i) => {
      const content = articleContents?.[i] || "";
      const snippet = content.length > 600 ? content.slice(0, 600) + "…" : content;
      return `${i + 1}. 《${t}》
   来源：${newsSources[i] ?? "未知"}
   原文：${snippet || "(无法获取原文)"}`;
    })
    .join("\n\n");

  // Fundamentals block
  let fundamentalsBlock = "";
  if (fundamentals && Object.keys(fundamentals).length > 0) {
    const f = fundamentals;
    fundamentalsBlock = `
【${ticker} 基本面快照】
${f.price ? `  最新股价：${f.price}` : ""}
${f.pe ? `  PE 估值：${f.pe}` : ""}
${f.marketCap ? `  市值：${f.marketCap}` : ""}
${f.range52w ? `  52周区间：${f.range52w}` : ""}
${f.volume ? `  成交量：${f.volume}` : ""}
（以上数据可引用到分析中）
`;
  }

  let factsBlock = "";
  if (factSheet && factSheet.facts.length > 0) {
    factsBlock = `
【可引用的事实数据 — 以下是你唯一可以使用的数字】
${toFactLines(factSheet).map((l) => `  ${l}`).join("\n")}

⚠️ 以上事实数据是你生成分析时唯一可引用的数字来源。
`;
  }

  return `你是华尔街对冲基金的分析师，以犀利敢言著称。你的分析从不泛泛而谈。

请基于以下 ${ticker} 的新闻原文+基本面，写一份简短犀利的分析：

${fundamentalsBlock}
【新闻原文】
${newsBlock}

${factsBlock}

【强制要求 — 不要写流水账】
- 从新闻中找到最反直觉、最让人意外的角度来写
- 如果有基本面数据，结合它分析估值/价格合理性
- 禁止使用模板化表述："分岔路口"、"多空交织"、"分化加剧"
- 每一条 keyPoints 必须是"具体事实 + 投资影响"
- 找到与其他股票/板块的对比点，制造冲突感

${ANTI_HALLUCINATION_RULES}

输出严格 JSON：
{
  "title": "字符串，不超过12个中文，从新闻中提炼最核心的一句话，禁止用'市场xxx'这类模糊标题",
  "hook": "字符串，不超过30字，这条新闻最让人意外的点，用于社交媒体开头抓眼球",
  "sentiment": "利好/利空/中性",
  "keyPoints": ["具体事件+影响（30字内）", "具体事件+影响", "具体事件+影响"],
  "risks": ["具体风险（30字内）", ...],
  "updatedAt": "ISO 8601"
}

反例（禁止产生这种垃圾）：
❌ title: "市场分化加剧" → 太模糊，改成 "苹果买入信号出现"
❌ keyPoints: "自动驾驶股票受关注" → 关注什么？改成 "机构推荐买入特斯拉替代股"
❌ risks: "市场情绪可能过度乐观" → 哪来的情绪？改成 "Joby Aviation 单月跌25%的同板块风险"`;
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
