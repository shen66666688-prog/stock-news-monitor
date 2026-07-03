/**
 * AI 财经内容 Copilot API
 *
 * 四个工具，一个端点：
 *   POST /api/copilot  { action, content, ticker? }
 *
 * action:
 *   check-facts       → 事实核查（复用 validator 逻辑）
 *   check-compliance  → 违规风险检测
 *   rewrite-safe      → 改写为平台安全表达
 *   generate-xhs      → 生成小红书版本
 */

import OpenAI from "openai";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// 双模型策略：
//   DeepSeek（便宜 4-5 倍）→ 规则型任务：事实核查、合规检测
//   智谱 GLM-4-Plus（中文最强）→ 创作型任务：安全改写、小红书生成
// ---------------------------------------------------------------------------

function getClient(model: "deepseek" | "zhipu"): { client: OpenAI; model: string } | null {
  if (model === "zhipu") {
    const key = process.env.ZHIPU_API_KEY;
    if (!key) return null;
    return {
      client: new OpenAI({ baseURL: "https://open.bigmodel.cn/api/paas/v4/", apiKey: key }),
      model: "glm-4-plus",
    };
  }
  // deepseek
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key || key === "your-deepseek-api-key-here") return null;
  return {
    client: new OpenAI({ baseURL: "https://api.deepseek.com", apiKey: key }),
    model: "deepseek-chat",
  };
}

// ---------------------------------------------------------------------------
// Action-specific prompts
// ---------------------------------------------------------------------------

const COMPLIANCE_RULES = `
【中国社交媒体财经内容合规规则 — 基于抖音/小红书2024-2026年实际处罚案例】

一、严禁行为（触发即下架/封号）：
1. 诱导跨境投资开户："港美股开户"、"入金"、"境外券商推荐"
2. 承诺收益："稳赚"、"必涨"、"翻倍"、"保本"、"躺赚"
3. 具体买卖建议："建议买入"、"赶紧卖出"、"现在抄底"
4. 无资质荐股：推荐具体股票代码+操作方向
5. 非法集资/代客理财暗示："跟单"、"带我操作"、"分成"

二、高风险表达（限流/警告）：
6. 夸大描述："暴涨"、"暴跌"、"崩盘"、"史诗级"、"历史性"
7. 制造焦虑："再不买就晚了"、"最后机会"、"错过后悔"
8. 缺乏风险提示：全文无"仅供参考"、"不构成投资建议"
9. 引用未经验证的数据：没有注明来源的财务数字
10. 煽动性标题："突发！"、"震惊！"、"紧急通知！"

三、内容最佳实践：
- 开头/结尾必须包含合规提示
- 所有数据注明来源和时间
- 使用"分析"而不做"预测"
- 讲逻辑不讲结论
- 讲风险不讲收益承诺
`;

const SYSTEM_PROMPT = `你是中国财经内容合规专家，精通抖音、小红书、微信公众号的金融内容审核规则。${COMPLIANCE_RULES}`;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, content, ticker } = body as {
      action?: string;
      content?: string;
      ticker?: string;
    };

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "请提供待处理的内容" }, { status: 400 });
    }

    if (!action || !["check-facts", "check-compliance", "rewrite-safe", "generate-xhs", "publish-ready"].includes(action)) {
      return NextResponse.json({ error: "请指定有效的 action" }, { status: 400 });
    }

    // DeepSeek 优先，智谱仅作备选
    let llm = getClient("deepseek");
    // 创作型任务智谱可用时升级
    if (!llm) llm = getClient("zhipu");
    if (!llm) {
      return NextResponse.json(
        { error: "AI 服务未配置。请设置 DEEPSEEK_API_KEY。" },
        { status: 503 },
      );
    }

    const { client, model } = llm;
    console.log(`[Copilot] action=${action} model=${model}`);

    switch (action) {
      case "check-facts":
        return handleCheckFacts(client, model, content, ticker);
      case "check-compliance":
        return handleCheckCompliance(client, model, content);
      case "rewrite-safe":
        return handleRewriteSafe(client, model, content);
      case "generate-xhs":
        return handleGenerateXHS(client, model, content, ticker);
      case "publish-ready":
        return handlePublishReady(client, model, content, ticker);
      default:
        return NextResponse.json({ error: "未知 action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Copilot API]", error);
    return NextResponse.json(
      { error: "处理失败", detail: (error as Error).message },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

/** ① 事实核查 */
async function handleCheckFacts(client: OpenAI, model: string, content: string, ticker?: string) {
  const prompt = `你是金融事实核查员。请逐一检查以下内容中出现的每个数字/数据声明。

【待检查内容】
${content}

【检查规则】
- 对每个数字判断：是否有明确来源？数值是否合理？
- 财务数字（营收/利润/PE/市值等）最容易编造，需重点标注
- 投机性表述（"预计"、"可能达到"、"分析师认为"）需要标注为"推测"
- 给出整体评级：✅ 可信 / ⚠️ 部分可信 / ❌ 存在编造

返回严格 JSON：
{
  "rating": "✅ 可信" | "⚠️ 部分可信" | "❌ 存在编造",
  "summary": "一句话总结",
  "numbersFound": [{ "value": "原文中的数字/表述", "status": "✅ 有来源" | "⚠️ 推测" | "❌ 无来源", "reason": "判断依据" }],
  "suggestions": ["修改建议1", "修改建议2"]
}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "你是金融事实核查专家。只返回严格 JSON，不含任何其他文字。" },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 1200,
  });

  return parseAIResponse(completion.choices[0]?.message?.content);
}

/** ② 违规风险检测 */
async function handleCheckCompliance(client: OpenAI, model: string, content: string) {
  const prompt = `${SYSTEM_PROMPT}

【待检测内容】
${content}

请逐条对照合规规则，检测违规风险。返回严格 JSON：
{
  "riskLevel": "🟢 低风险" | "🟡 中风险" | "🔴 高风险" | "⛔ 违规",
  "summary": "一句话总结",
  "issues": [{ "rule": "违规规则名称", "severity": "🔴 严重" | "🟡 警告" | "🟢 提示", "location": "内容中对应位置", "suggestion": "修改建议" }],
  "safeToPublish": true | false,
  "mustFixBeforePublish": ["必须修改的内容1"]
}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "你是财经内容合规审核专家。只返回严格 JSON，不含任何其他文字。" },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 1500,
  });

  return parseAIResponse(completion.choices[0]?.message?.content);
}

/** ③ 改写为安全表达 */
async function handleRewriteSafe(client: OpenAI, model: string, content: string) {
  const prompt = `${SYSTEM_PROMPT}

【原始内容】
${content}

请将以上内容改写为合规安全的版本。要求：
- 保留核心信息和逻辑
- 移除所有违规表达
- 替换高风险词汇
- 添加必要的风险提示
- 语气保持自然，不僵硬

返回严格 JSON：
{
  "rewritten": "改写后的完整内容",
  "changes": ["改动1：xxx → yyy", "改动2：..."],
  "addedDisclaimer": "添加的合规提示"
}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "你是财经内容合规改写专家。只返回严格 JSON，不含任何其他文字。" },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 1500,
  });

  return parseAIResponse(completion.choices[0]?.message?.content);
}

/** ④ 生成小红书版本 */
async function handleGenerateXHS(client: OpenAI, model: string, content: string, ticker?: string) {
  const tickerHint = ticker ? `（涉及股票：${ticker.toUpperCase()}）` : "";
  const prompt = `你是小红书美股财经爆款内容创作专家。已知爆款公式：钩子→情绪→数据→风险→互动。

【输入内容】
${content}
${tickerHint}

请将以上内容改写为小红书风格的财经笔记。要求：
- 标题不超过 20 字，必须有冲突感或数字
- 开头钩子前 15 字内制造悬念
- 正文分点清晰，每条配 emoji
- 包含具体数据（有来源的）
- 结尾必须有评论区互动引导（站队型问题）
- 标签 5-8 个
- 全文不超过 500 字
- 不包含违规表达

返回严格 JSON：
{
  "title": "小红书标题",
  "body": ["段落1（含钩子）", "段落2", "段落3"],
  "cta": "评论互动引导",
  "hashtags": ["标签1", "标签2", "标签3", "标签4", "标签5"]
}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "你是小红书美股财经爆款内容创作专家。只返回严格 JSON，不含任何其他文字。" },
      { role: "user", content: prompt },
    ],
    temperature: 0.6,
    max_tokens: 1200,
  });

  return parseAIResponse(completion.choices[0]?.message?.content);
}

// ---------------------------------------------------------------------------
// ⑤ 一键全流程：事实核查 → 合规检测 → 安全改写 → 小红书生成
// ---------------------------------------------------------------------------
async function handlePublishReady(client: OpenAI, model: string, content: string, ticker?: string) {
  const steps: Array<{ label: string; status: string; data?: unknown }> = [];

  // Step 1: 事实核查
  try {
    const r1 = await handleCheckFactsRaw(client, model, content, ticker);
    steps.push({ label: "事实核查", status: "done", data: r1 });
  } catch (e) {
    steps.push({ label: "事实核查", status: "error", data: { error: (e as Error).message } });
  }

  // Step 2: 合规检测
  try {
    const r2 = await handleCheckComplianceRaw(client, model, content);
    steps.push({ label: "合规检测", status: "done", data: r2 });
  } catch (e) {
    steps.push({ label: "合规检测", status: "error", data: { error: (e as Error).message } });
  }

  // Step 3: 安全改写
  let rewritten = content;
  try {
    const r3 = await handleRewriteSafeRaw(client, model, content);
    rewritten = r3.rewritten || content;
    steps.push({ label: "安全改写", status: "done", data: r3 });
  } catch (e) {
    steps.push({ label: "安全改写", status: "error", data: { error: (e as Error).message } });
  }

  // Step 4: 小红书生成
  try {
    const r4 = await handleGenerateXHSRaw(client, model, rewritten, ticker);
    steps.push({ label: "小红书生成", status: "done", data: r4 });
  } catch (e) {
    steps.push({ label: "小红书生成", status: "error", data: { error: (e as Error).message } });
  }

  const ready = steps.every((s) => s.status === "done");
  return NextResponse.json({ ready, steps });
}

// Raw versions (return data, not Response) for pipeline chaining
async function handleCheckFactsRaw(client: OpenAI, model: string, content: string, ticker?: string) {
  const prompt = `你是金融事实核查员。请检查以下内容的数字/数据是否可靠。返回严格 JSON：{"rating":"✅ 可信/⚠️ 部分可信/❌ 存在编造","summary":"一句话","numbersFound":[{"value":"数字","status":"✅/⚠️/❌","reason":"依据"}],"suggestions":["建议"]}`;
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: "只返回严格 JSON。" }, { role: "user", content: `${prompt}\n\n${content}` }],
    temperature: 0.1, max_tokens: 1200,
  });
  return parseRawJSON(completion.choices[0]?.message?.content);
}

async function handleCheckComplianceRaw(client: OpenAI, model: string, content: string) {
  const prompt = `${SYSTEM_PROMPT}\n\n请检测以下内容。返回严格 JSON：{"riskLevel":"🟢/🟡/🔴/⛔","summary":"一句话","issues":[{"rule":"规则","severity":"严重/警告/提示","location":"位置","suggestion":"建议"}],"safeToPublish":true/false,"mustFixBeforePublish":["必改项"]}\n\n${content}`;
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: "只返回严格 JSON。" }, { role: "user", content: prompt }],
    temperature: 0.1, max_tokens: 1500,
  });
  return parseRawJSON(completion.choices[0]?.message?.content);
}

async function handleRewriteSafeRaw(client: OpenAI, model: string, content: string) {
  const prompt = `${SYSTEM_PROMPT}\n\n改写为合规安全版本。保留核心信息，移除违规表达，添加风险提示。返回严格 JSON：{"rewritten":"改写后内容","changes":["改动"],"addedDisclaimer":"合规提示"}\n\n${content}`;
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: "只返回严格 JSON。" }, { role: "user", content: prompt }],
    temperature: 0.4, max_tokens: 1500,
  });
  return parseRawJSON(completion.choices[0]?.message?.content);
}

async function handleGenerateXHSRaw(client: OpenAI, model: string, content: string, ticker?: string) {
  const tickerHint = ticker ? `（涉及：${ticker.toUpperCase()}）` : "";
  const prompt = `你是小红书财经爆款创作专家。将以下内容改写为小红书笔记：标题≤20字有冲突感，正文分点配emoji，结尾互动引导，5-8个标签，≤500字。返回严格 JSON：{"title":"","body":["","",""],"cta":"","hashtags":["",""]}\n\n${content}\n${tickerHint}`;
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: "只返回严格 JSON。" }, { role: "user", content: prompt }],
    temperature: 0.6, max_tokens: 1200,
  });
  return parseRawJSON(completion.choices[0]?.message?.content);
}

function parseRawJSON(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return { _error: "AI 未返回内容" };
  let jsonStr = raw.trim();
  const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) jsonStr = m[1].trim();
  try { return JSON.parse(jsonStr); } catch { return { raw: jsonStr, _parseError: true }; }
}

/** Parse AI JSON response (handles markdown code fences) */
function parseAIResponse(raw: string | null | undefined) {
  if (!raw) {
    return NextResponse.json({ error: "AI 未返回内容" }, { status: 502 });
  }

  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  try {
    const data = JSON.parse(jsonStr);
    return NextResponse.json(data);
  } catch {
    // Return raw text if JSON parse fails
    return NextResponse.json({ raw: jsonStr, _parseError: true });
  }
}
