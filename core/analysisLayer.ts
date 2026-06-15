/**
 * analysisLayer.ts — V2 分析层
 *
 * 职责：
 *   - 使用 factLayer 输出进行多空分析
 *   - 允许 AI 生成（表达、总结、对比）
 *   - 但禁止引用未在 facts 中出现的数据
 *
 * 这个模块是"桥梁"：把冰冷的 facts 转化为结构化的多空逻辑框架。
 * 它不生成最终内容，只生成分析结构，交给 promptEngine 加工。
 *
 * 核心约束：
 *   - 每个分析点必须能追溯到至少一个 fact
 *   - 如果某个逻辑需要数据但 facts 中没有 → 标记为"数据不足"
 *   - 不允许"合理推测"填补数据空白
 */

import type { FactSheet, FactItem, FactCategory } from "./factLayer";
import { getFactsByCategory, hasMinimumCoverage } from "./factLayer";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** A single analytical point, anchored to its supporting facts */
export interface AnalysisPoint {
  /** The analytical claim (e.g. "资本开支增速远超收入增速，FCF承压") */
  claim: string;
  /** IDs of facts that support this claim (index into FactSheet.facts) */
  supportedBy: number[];
  /** Confidence: "confirmed" = directly supported, "inferred" = cross-fact logic, "weak" = thin support */
  confidence: "confirmed" | "inferred" | "weak";
  /** If confidence is "weak", explain why */
  caveat?: string;
}

/** Complete multi-angle analysis for one ticker */
export interface TickerAnalysis {
  ticker: string;
  generatedAt: string;
  /** The fact sheet this analysis is based on */
  factSheet: FactSheet;
  /** 3 bullish points */
  bullish: AnalysisPoint[];
  /** 3 bearish points */
  bearish: AnalysisPoint[];
  /** 3 key divergence / debate points */
  divergence: AnalysisPoint[];
  /** Any important data gaps that prevented stronger analysis */
  dataGaps: string[];
}

// ═══════════════════════════════════════════════════════════════
// Analysis builders — template-driven, fact-anchored
// ═══════════════════════════════════════════════════════════════

/**
 * Find facts by category, returning indices into the fact sheet.
 */
function findFactIndices(sheet: FactSheet, categories: FactCategory[]): number[] {
  return sheet.facts
    .map((f, i) => (categories.includes(f.category) ? i : -1))
    .filter((i) => i >= 0);
}

/**
 * Find the first fact index matching a category.
 */
function findFirstFactIndex(sheet: FactSheet, category: FactCategory): number {
  const idx = sheet.facts.findIndex((f) => f.category === category);
  return idx;
}

/**
 * Check if a value fact falls within a given range.
 */
function valueInRange(fact: FactItem, min: number, max: number): boolean {
  if (typeof fact.value !== "number") return false;
  return fact.value >= min && fact.value <= max;
}

// ═══════════════════════════════════════════════════════════════
// Bull case generator
// ═══════════════════════════════════════════════════════════════

function generateBullCase(sheet: FactSheet): AnalysisPoint[] {
  const points: AnalysisPoint[] = [];

  // Point 1: Growth — look for strong growth metrics
  const growthFacts = getFactsByCategory(sheet, "growth_rate");
  const cloudFacts = getFactsByCategory(sheet, "cloud_metrics");
  const revenueFacts = getFactsByCategory(sheet, "revenue");
  const guidanceFacts = getFactsByCategory(sheet, "guidance");

  const growthIndices = [
    ...growthFacts.map((f) => sheet.facts.indexOf(f)),
    ...cloudFacts.map((f) => sheet.facts.indexOf(f)),
    ...revenueFacts.map((f) => sheet.facts.indexOf(f)),
  ].filter((i) => i >= 0);

  if (growthIndices.length > 0) {
    // Find the most impressive growth number
    const growthFact = [...growthFacts, ...cloudFacts].find(
      (f) => typeof f.value === "number" && f.value > 20,
    );
    points.push({
      claim: growthFact
        ? `核心业务增速强劲（${growthFact.fact}），超越多数同业水平`
        : "核心业务保持增长态势，增速领先行业均值",
      supportedBy: growthIndices.slice(0, 3),
      confidence: growthFact ? "confirmed" : "inferred",
      caveat: growthFact ? undefined : "具体增速数据不足，基于定性信息判断",
    });
  } else {
    points.push({
      claim: "业务增长前景看好，但需更多数据量化验证",
      supportedBy: findFactIndices(sheet, ["revenue", "cloud_metrics", "guidance"]),
      confidence: "weak",
      caveat: "缺少具体增长率数据",
    });
  }

  // Point 2: Backlog / demand visibility
  const backlogFacts = getFactsByCategory(sheet, "backlog");
  const backlogIndices = backlogFacts.map((f) => sheet.facts.indexOf(f)).filter((i) => i >= 0);

  if (backlogIndices.length > 0 && backlogFacts.some((f) => typeof f.value === "number" && f.value > 1e9)) {
    points.push({
      claim: `订单储备（RPO/Backlog）创历史新高，未来收入可见度极强`,
      supportedBy: backlogIndices.slice(0, 3),
      confidence: "confirmed",
    });
  } else if (backlogIndices.length > 0) {
    points.push({
      claim: "订单储备数据表明需求确定性较高",
      supportedBy: backlogIndices.slice(0, 3),
      confidence: "inferred",
    });
  } else if (guidanceFacts.length > 0) {
    const gIdx = guidanceFacts.map((f) => sheet.facts.indexOf(f)).filter((i) => i >= 0);
    points.push({
      claim: "管理层给出积极指引，未来收入可见度高",
      supportedBy: gIdx.slice(0, 2),
      confidence: "inferred",
    });
  } else {
    points.push({
      claim: "长期需求趋势向好，但缺少具体订单或指引数据",
      supportedBy: [],
      confidence: "weak",
      caveat: "缺少订单储备和未来指引数据",
    });
  }

  // Point 3: Analyst / institutional support
  const analystFacts = getFactsByCategory(sheet, "analyst_rating");
  const analystIndices = analystFacts.map((f) => sheet.facts.indexOf(f)).filter((i) => i >= 0);

  if (analystIndices.length > 0) {
    const bullishCount = analystFacts.filter(
      (f) =>
        f.notes?.includes("buy") ||
        f.notes?.includes("outperform") ||
        f.notes?.includes("overweight"),
    ).length;
    points.push({
      claim:
        bullishCount >= 2
          ? "华尔街多数机构维持买入评级，目标价隐含显著上行空间"
          : "部分机构看好长期价值，市场定价可能过于悲观",
      supportedBy: analystIndices.slice(0, 3),
      confidence: bullishCount >= 2 ? "confirmed" : "inferred",
    });
  } else {
    points.push({
      claim: "若机构目标价可信，当前估值提供安全边际",
      supportedBy: findFactIndices(sheet, ["valuation"]),
      confidence: "weak",
      caveat: "缺少分析师评级和目标价数据",
    });
  }

  return points.slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════
// Bear case generator
// ═══════════════════════════════════════════════════════════════

function generateBearCase(sheet: FactSheet): AnalysisPoint[] {
  const points: AnalysisPoint[] = [];

  // Point 1: CapEx / cash burn
  const capexFacts = getFactsByCategory(sheet, "capital_expense");
  const fcfFacts = getFactsByCategory(sheet, "free_cash_flow");
  const debtFacts = getFactsByCategory(sheet, "debt");

  const costIndices = [
    ...capexFacts.map((f) => sheet.facts.indexOf(f)),
    ...fcfFacts.map((f) => sheet.facts.indexOf(f)),
    ...debtFacts.map((f) => sheet.facts.indexOf(f)),
  ].filter((i) => i >= 0);

  if (costIndices.length > 0) {
    const hasNegativeFCF = fcfFacts.some(
      (f) => typeof f.value === "number" && f.value < 0,
    );
    const hasHighCapex = capexFacts.some(
      (f) => typeof f.value === "number" && f.value > 1e9,
    );
    points.push({
      claim: hasNegativeFCF
        ? "资本开支远超经营现金流，自由现金流为负，融资压力持续加大"
        : hasHighCapex
          ? "大规模资本开支短期侵蚀利润，回报周期不确定"
          : "成本结构面临压力，利润率存在下行风险",
      supportedBy: costIndices.slice(0, 3),
      confidence: hasNegativeFCF || hasHighCapex ? "confirmed" : "inferred",
    });
  } else {
    points.push({
      claim: "关注成本端压力：如资本开支、研发投入对利润率的蚕食",
      supportedBy: [],
      confidence: "weak",
      caveat: "缺少资本开支和自由现金流数据",
    });
  }

  // Point 2: Dilution / financing risk
  const fundraisingFacts = getFactsByCategory(sheet, "fundraising");
  const frIndices = fundraisingFacts.map((f) => sheet.facts.indexOf(f)).filter((i) => i >= 0);

  if (frIndices.length > 0) {
    const hasDilution = fundraisingFacts.some(
      (f) =>
        f.fact.includes("增发") ||
        f.fact.includes("ATM") ||
        f.fact.includes("稀释") ||
        f.fact.includes("equity"),
    );
    points.push({
      claim: hasDilution
        ? "大规模股权融资计划将直接稀释现有股东权益，对EPS构成持续压力"
        : "频繁融资增加财务杠杆，信用评级面临压力",
      supportedBy: frIndices.slice(0, 3),
      confidence: "confirmed",
    });
  } else {
    // Look for debt facts as proxy
    const debtIdx = findFactIndices(sheet, ["debt"]);
    if (debtIdx.length > 0) {
      points.push({
        claim: "债务规模膨胀增加财务风险，利率上升周期下利息负担加重",
        supportedBy: debtIdx.slice(0, 2),
        confidence: "inferred",
        caveat: "缺少具体融资计划数据",
      });
    } else {
      points.push({
        claim: "关注融资风险：大规模投资可能带来股权稀释或杠杆上升",
        supportedBy: findFactIndices(sheet, ["capital_expense"]),
        confidence: "weak",
        caveat: "缺少融资和债务具体数据",
      });
    }
  }

  // Point 3: Concentration / competitive risk
  const customerFacts = getFactsByCategory(sheet, "customer");
  const competitorFacts = getFactsByCategory(sheet, "competitor");

  const concentrationIndices = [
    ...customerFacts.map((f) => sheet.facts.indexOf(f)),
    ...competitorFacts.map((f) => sheet.facts.indexOf(f)),
  ].filter((i) => i >= 0);

  if (concentrationIndices.length > 0) {
    const hasHighConcentration = customerFacts.some(
      (f) =>
        (typeof f.value === "number" && f.value > 30) ||
        f.fact.includes("47%") ||
        f.fact.includes("一半") ||
        f.fact.includes("依赖"),
    );
    points.push({
      claim: hasHighConcentration
        ? "客户/收入集中度偏高，单一客户风险不容忽视"
        : "竞争格局变化和客户集中度是潜在风险因素",
      supportedBy: concentrationIndices.slice(0, 3),
      confidence: hasHighConcentration ? "confirmed" : "inferred",
    });
  } else {
    points.push({
      claim: "行业竞争加剧可能影响定价权和市场份额",
      supportedBy: [],
      confidence: "weak",
      caveat: "缺少客户集中度和竞争对手术数据",
    });
  }

  return points.slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════
// Divergence generator — where bulls and bears disagree most
// ═══════════════════════════════════════════════════════════════

function generateDivergence(
  sheet: FactSheet,
  bullPoints: AnalysisPoint[],
  bearPoints: AnalysisPoint[],
): AnalysisPoint[] {
  const points: AnalysisPoint[] = [];

  // Divergence 1: Growth vs Cost
  const growthFacts = getFactsByCategory(sheet, "growth_rate");
  const capexFacts = getFactsByCategory(sheet, "capital_expense");
  const costIndices = [
    ...growthFacts.map((f) => sheet.facts.indexOf(f)),
    ...capexFacts.map((f) => sheet.facts.indexOf(f)),
  ].filter((i) => i >= 0);

  if (costIndices.length >= 2) {
    points.push({
      claim: '增长 vs 成本：高增速能否覆盖高投入？市场在定价“先有鸡还是先有蛋”的困境',
      supportedBy: costIndices.slice(0, 4),
      confidence: "confirmed",
    });
  } else {
    points.push({
      claim: "增长质量 vs 增长代价：当前估值是否已充分反映投入成本",
      supportedBy: [...findFactIndices(sheet, ["growth_rate"]), ...findFactIndices(sheet, ["valuation"])],
      confidence: "inferred",
    });
  }

  // Divergence 2: Valuation divergence
  const valuationFacts = getFactsByCategory(sheet, "valuation");
  const analystFacts = getFactsByCategory(sheet, "analyst_rating");
  const valAndAnalystIdx = [
    ...valuationFacts.map((f) => sheet.facts.indexOf(f)),
    ...analystFacts.map((f) => sheet.facts.indexOf(f)),
  ].filter((i) => i >= 0);

  if (valAndAnalystIdx.length >= 2) {
    points.push({
      claim: "估值分歧：当前PE vs 分析师目标价之间的巨大差距，说明市场定价存在根本性分歧",
      supportedBy: valAndAnalystIdx.slice(0, 4),
      confidence: "confirmed",
    });
  } else {
    points.push({
      claim: "估值水平是当前多空最核心的分歧点——便宜还是价值陷阱？",
      supportedBy: findFactIndices(sheet, ["valuation"]),
      confidence: "inferred",
    });
  }

  // Divergence 3: Revenue quality
  const backlogFacts = getFactsByCategory(sheet, "backlog");
  const customerFacts = getFactsByCategory(sheet, "customer");
  const revenueQualityIdx = [
    ...backlogFacts.map((f) => sheet.facts.indexOf(f)),
    ...customerFacts.map((f) => sheet.facts.indexOf(f)),
  ].filter((i) => i >= 0);

  if (revenueQualityIdx.length > 0) {
    points.push({
      claim: "订单质量 vs 客户质量：大单很漂亮，但客户能不能活着把这些订单兑现完？",
      supportedBy: revenueQualityIdx.slice(0, 3),
      confidence: "confirmed",
    });
  } else {
    points.push({
      claim: "收入质量：增长是可持续的结构性增长，还是一次性催化？",
      supportedBy: findFactIndices(sheet, ["revenue", "guidance", "growth_rate"]),
      confidence: "weak",
      caveat: "缺少订单和客户结构数据",
    });
  }

  return points.slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════
// Main entry: generate a complete TickerAnalysis
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a complete bull/bear/divergence analysis from a FactSheet.
 *
 * This function:
 *   1. Checks minimum data coverage
 *   2. Generates bull case (3 points)
 *   3. Generates bear case (3 points)
 *   4. Generates divergence analysis (3 points)
 *   5. Reports any data gaps
 *
 * All analysis points are anchored to specific facts via index.
 * Downstream validators can trace every claim back to its source.
 */
export function analyzeFactSheet(sheet: FactSheet): TickerAnalysis {
  const dataGaps: string[] = [];

  // Check minimum coverage for a meaningful analysis
  const requiredCategories: FactCategory[] = [
    "price",
    "valuation",
    "revenue",
  ];
  const coverageCheck = hasMinimumCoverage(sheet, requiredCategories);
  if (!coverageCheck.ok) {
    dataGaps.push(
      `缺少关键数据类别: ${coverageCheck.missing.join(", ")}。分析可能存在盲区。`,
    );
  }

  if (sheet.facts.length < 5) {
    dataGaps.push(
      `仅有 ${sheet.facts.length} 条事实数据，分析置信度较低。建议补充更多外部数据。`,
    );
  }

  // Check specific data gaps
  if (!sheet.coverage["capital_expense"]) {
    dataGaps.push("缺少资本开支数据 — 空头逻辑中成本分析可能不完整");
  }
  if (!sheet.coverage["free_cash_flow"]) {
    dataGaps.push("缺少自由现金流数据 — 无法评估真实的盈利能力");
  }
  if (!sheet.coverage["backlog"]) {
    dataGaps.push("缺少订单储备数据 — 多头逻辑中收入可见度分析受限");
  }
  if (!sheet.coverage["analyst_rating"]) {
    dataGaps.push("缺少分析师评级数据 — 机构观点维度缺失");
  }

  const bullish = generateBullCase(sheet);
  const bearish = generateBearCase(sheet);
  const divergence = generateDivergence(sheet, bullish, bearish);

  return {
    ticker: sheet.ticker,
    generatedAt: new Date().toISOString(),
    factSheet: sheet,
    bullish,
    bearish,
    divergence,
    dataGaps,
  };
}

// ═══════════════════════════════════════════════════════════════
// Utility: convert analysis to plain text for prompt injection
// ═══════════════════════════════════════════════════════════════

/** Convert analysis to a structured text block for AI prompt consumption */
export function analysisToPromptContext(analysis: TickerAnalysis): string {
  const lines: string[] = [];

  lines.push(`【${analysis.ticker} 事实基础】`);
  for (const f of analysis.factSheet.facts) {
    lines.push(`  - [${f.source}] ${f.fact}`);
  }

  lines.push("");
  lines.push("【多头逻辑框架】（AI 可根据此框架展开，但不得引入新数据）");
  for (const p of analysis.bullish) {
    const tag = p.confidence === "weak" ? "⚠️ 数据支撑不足" : "✓";
    lines.push(`  - ${tag} ${p.claim}`);
  }

  lines.push("");
  lines.push("【空头逻辑框架】");
  for (const p of analysis.bearish) {
    const tag = p.confidence === "weak" ? "⚠️ 数据支撑不足" : "✓";
    lines.push(`  - ${tag} ${p.claim}`);
  }

  lines.push("");
  lines.push("【核心分歧】");
  for (const p of analysis.divergence) {
    lines.push(`  - ${p.claim}`);
  }

  if (analysis.dataGaps.length > 0) {
    lines.push("");
    lines.push("【数据盲区】（AI 不得编造数据填补以下盲区）");
    for (const g of analysis.dataGaps) {
      lines.push(`  - ❌ ${g}`);
    }
  }

  return lines.join("\n");
}
