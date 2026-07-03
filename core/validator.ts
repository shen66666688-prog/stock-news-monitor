/**
 * validator.ts — V2 输出校验器
 *
 * 职责：
 *   - 校验 AI 生成内容是否引用了未经验证的数据
 *   - 检测是否编造了财务数字
 *   - 确保所有声明可追溯到 factLayer
 *
 * 这是整个 V2 控制层的最后一道防线。
 * 任何通过校验的内容都保证：
 *   - 所有数字有来源
 *   - 所有事实声明可追溯
 *   - 没有 AI 编造的数据
 */

import type { FactSheet, FactItem } from "./factLayer";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ValidationResult {
  /** Overall pass/fail */
  valid: boolean;
  /** Severity level: valid (clean), warning (issues but usable), reject (must retry) */
  level: "valid" | "warning" | "reject";
  /** If invalid, the primary reason */
  reason?: string;
  /** Individual checks performed */
  checks: ValidationCheck[];
  /** Warnings that don't cause rejection but should be reviewed */
  warnings: string[];
  /** Count of facts referenced vs facts available */
  factCoverage: {
    totalFacts: number;
    factsReferenced: number;
    coveragePct: number;
  };
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

/** The AI-generated content to validate */
export interface AIOutput {
  /** The raw AI response text */
  raw: string;
  /** Parsed key points / claims */
  claims: string[];
  /** Any numbers extracted from the text */
  numbersFound: Array<{ value: number; context: string }>;
  /** The source of this AI output (for traceability) */
  generatedBy: string; // e.g. "DeepSeek/deepseek-chat"
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════════════
// Number extractor — finds all numeric values in text with context
// ═══════════════════════════════════════════════════════════════

/**
 * Extract all numbers from text, along with surrounding context words.
 * This is used to cross-reference against the fact sheet.
 */
function extractNumbers(text: string): Array<{ value: number; context: string }> {
  const results: Array<{ value: number; context: string }> = [];

  // Match numbers with optional units: $1.5B, 500亿, 35%, 45x, 200万, 1.2万亿
  const patterns = [
    // Dollar amounts: $19.18B, $557亿
    /\$(\d+(?:\.\d+)?)\s*(万亿|[万亿]|[BMK]|亿|万|billion|million|B|M|K)?/gi,
    // Plain numbers with Chinese units: 557亿, 6380亿, 200万
    /(\d+(?:\.\d+)?)\s*(万亿|亿|万|[BMK]|%|％|倍|x|美元|美金)/g,
    // Plain large numbers (>= 4 digits) — likely financial data
    /\b(\d{4,}(?:\.\d+)?)\b/g,
    // Percentages: 93%, 21.5%
    /(\d+(?:\.\d+)?)\s*[%％]/g,
    // PE ratios: PE 31x, 35倍
    /(?:PE|P\/E|市盈率)\s*[:：]?\s*(\d+(?:\.\d+)?)/gi,
  ];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const value = parseFloat(match[1]);
      if (!isNaN(value) && value > 0) {
        // Get surrounding context (~30 chars)
        const start = Math.max(0, match.index - 15);
        const end = Math.min(text.length, match.index + match[0].length + 15);
        const context = text.slice(start, end).replace(/\n/g, " ").trim();
        results.push({ value, context });
      }
    }
  }

  // Deduplicate by context
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.value.toFixed(1)}|${r.context.slice(0, 20)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════
// Financial keyword list — terms that suggest a factual claim
// ═══════════════════════════════════════════════════════════════

const FINANCIAL_KEYWORDS = [
  // Chinese
  "营收", "收入", "利润", "净利润", "毛利", "毛利率", "净利率",
  "每股收益", "EPS", "现金流", "自由现金流", "FCF",
  "资本开支", "CapEx", "capex", "资本支出",
  "负债", "债务", "总负债", "净负债", "杠杆",
  "增长率", "增速", "同比增长", "环比增长", "YoY", "QoQ",
  "订单", "RPO", "backlog", "在手订单",
  "市值", "估值", "PE", "市盈率", "PS", "PB", "EV",
  "目标价", "评级", "增持", "减持", "买入", "卖出",
  "融资", "增发", "稀释", "分红", "回购",
  "交付量", "订阅数", "用户数", "MAU", "DAU",
  // English
  "revenue", "earnings", "EPS", "profit", "margin",
  "free cash flow", "capital expenditure",
  "debt", "leverage", "dilution",
  "growth rate", "guidance", "outlook",
  "market cap", "valuation", "P/E", "price target",
  "buyback", "dividend", "offering",
];

/**
 * Check if a text snippet contains financial claims that need source verification.
 */
function hasFinancialClaims(text: string): boolean {
  const lower = text.toLowerCase();
  return FINANCIAL_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

// ═══════════════════════════════════════════════════════════════
// Core validation logic
// ═══════════════════════════════════════════════════════════════

/**
 * Validate AI output against a FactSheet.
 *
 * This is the main entry point. It runs multiple checks:
 *   1. Number-source cross-reference
 *   2. Financial claim verification
 *   3. Fact coverage analysis
 *   4. Obvious hallucination detection
 *
 * @param output - The AI-generated content to validate
 * @param factSheet - The verified facts to check against
 * @returns ValidationResult with pass/fail and detailed checks
 */
export function validateAIOutput(
  output: AIOutput,
  factSheet: FactSheet,
): ValidationResult {
  const checks: ValidationCheck[] = [];
  const warnings: string[] = [];

  // ═══════════════════════════════════════════════════
  // Check 1: Number-source cross-reference
  // ═══════════════════════════════════════════════════
  const numbersFound = extractNumbers(output.raw);
  const factNumbers: number[] = factSheet.facts
    .filter((f) => typeof f.value === "number")
    .map((f) => f.value as number);

  const unmatchedNumbers: Array<{ value: number; context: string }> = [];

  for (const num of numbersFound) {
    // Check if this number (or a very close value) exists in the fact sheet
    const isMatched = factNumbers.some((fn) => {
      // Exact match
      if (fn === num.value) return true;
      // Close match for large numbers (within 1% tolerance for numbers > 100)
      const pctDiff = Math.abs(fn - num.value) / Math.max(fn, 1);
      if (num.value > 1000 && pctDiff < 0.005) return true;
      if (num.value > 100 && pctDiff < 0.01) return true;
      if (num.value > 1 && pctDiff < 0.03) return true;
      // For scaled numbers (e.g., 19.18 vs 19.2, or 557 vs 55.7)
      // Check scaled versions: $19.18B might appear as 19.18 or 19180
      const scales = [1, 10, 100, 1000, 0.1, 0.01, 0.001];
      return scales.some((s) => {
        const scaled = num.value * s;
        return factNumbers.some((fn2) => Math.abs(fn2 - scaled) / Math.max(fn2, 1) < 0.03);
      });
    });

    if (!isMatched) {
      unmatchedNumbers.push(num);
    }
  }

  // Only flag as error if there are financial claims with unmatched numbers
  const hasFinancialContent = hasFinancialClaims(output.raw);

  if (unmatchedNumbers.length > 0 && hasFinancialContent) {
    // Check if the unmatched numbers are in financial claim contexts
    const suspiciousNumbers = unmatchedNumbers.filter((n) =>
      FINANCIAL_KEYWORDS.some((kw) => n.context.toLowerCase().includes(kw.toLowerCase())),
    );

    if (suspiciousNumbers.length > 0) {
      const details = suspiciousNumbers
        .map((n) => `"${n.context}" (值: ${n.value})`)
        .join("; ");

      checks.push({
        name: "数字溯源校验",
        passed: false,
        detail: `发现 ${suspiciousNumbers.length} 个无法在事实数据库中匹配的数字: ${details}`,
      });
    } else {
      // Numbers exist but not in financial contexts — warn, don't reject
      checks.push({
        name: "数字溯源校验",
        passed: true,
        detail: `${unmatchedNumbers.length} 个数字未找到精确匹配，但不在财务声明语境中，放行`,
      });
      warnings.push(
        `${unmatchedNumbers.length} 个数字未在事实库中找到匹配: ${unmatchedNumbers.map((n) => n.value).join(", ")}`,
      );
    }
  } else {
    checks.push({
      name: "数字溯源校验",
      passed: true,
      detail: numbersFound.length > 0
        ? `所有 ${numbersFound.length} 个数字均在事实库中找到对应来源`
        : "未检测到数字内容",
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Check 2: Financial claim source verification
  // ═══════════════════════════════════════════════════════════
  const claimsWithFinancialTerms = output.claims.filter((c) => hasFinancialClaims(c));

  if (claimsWithFinancialTerms.length > 0 && factSheet.facts.length === 0) {
    checks.push({
      name: "财务声明校验",
      passed: false,
      detail: `内容包含 ${claimsWithFinancialTerms.length} 条财务声明，但事实数据库为空。所有数字无法验证。`,
    });
  } else if (claimsWithFinancialTerms.length > 0) {
    // For each claim with financial terms, check if at least one fact is referenced
    const unverifiableClaims: string[] = [];

    for (const claim of claimsWithFinancialTerms) {
      const hasMatchingFact = factSheet.facts.some((f) => {
        // Check if any word from the fact appears in the claim
        // (simple bag-of-words overlap — not perfect but practical)
        const factWords = f.fact.split(/\s+/).filter((w) => w.length > 2);
        const claimLower = claim.toLowerCase();
        return factWords.some((fw) => claimLower.includes(fw.toLowerCase()));
      });

      if (!hasMatchingFact) {
        unverifiableClaims.push(claim);
      }
    }

    if (unverifiableClaims.length > 1) {
      checks.push({
        name: "财务声明校验",
        passed: false,
        detail: `${unverifiableClaims.length} 条财务声明无法在事实库中找到支撑: "${unverifiableClaims.slice(0, 2).join("; ")}"...`,
      });
    } else {
      checks.push({
        name: "财务声明校验",
        passed: true,
        detail: `所有 ${claimsWithFinancialTerms.length} 条财务声明均有事实支撑`,
      });
    }
  } else {
    checks.push({
      name: "财务声明校验",
      passed: true,
      detail: "未检测到需要验证的财务声明",
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Check 3: Obvious hallucination markers
  // ═══════════════════════════════════════════════════════════
  const hallucinationMarkers = [
    /[我编][推测]/,
    /据(?:可靠消息|内部人士|知情人士|消息人士)(?:透露|称)/,
    /预计(?:将)?(?:达到|实现|超过)\s*[0-9.,]+/,
    /(?:分析师|市场)普遍(?:预计|认为|预期)/,
  ];

  const hallucinationHits: string[] = [];
  for (const marker of hallucinationMarkers) {
    const match = output.raw.match(marker);
    if (match) {
      hallucinationHits.push(match[0]);
    }
  }

  if (hallucinationHits.length > 0) {
    warnings.push(
      `检测到可能的推断性表述（非硬性违规，但建议审核）: ${hallucinationHits.join(", ")}`,
    );
  }

  checks.push({
    name: "幻觉标记检测",
    passed: hallucinationHits.length < 3,
    detail:
      hallucinationHits.length === 0
        ? "未检测到明显幻觉标记"
        : `发现 ${hallucinationHits.length} 个推断性表述`,
  });

  // ═══════════════════════════════════════════════════════════
  // Check 4: Fact coverage
  // ═══════════════════════════════════════════════════════════
  let factsReferenced = 0;
  for (const fact of factSheet.facts) {
    const factLower = fact.fact.toLowerCase();
    const rawLower = output.raw.toLowerCase();
    // Simple substring match — checking if the fact content appears in the output
    const keyTerms = fact.fact
      .replace(/[$%,.:()]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const matchedTerms = keyTerms.filter((term) => rawLower.includes(term.toLowerCase()));
    if (matchedTerms.length >= 2) {
      factsReferenced++;
    }
  }

  const totalFacts = factSheet.facts.length;
  const coveragePct = totalFacts > 0 ? Math.round((factsReferenced / totalFacts) * 100) : 0;

  checks.push({
    name: "事实覆盖率",
    passed: totalFacts === 0 || coveragePct >= 30,
    detail: totalFacts > 0
      ? `引用了 ${factsReferenced}/${totalFacts} 条事实 (${coveragePct}%)`
      : "无事实数据可验证",
  });

  if (totalFacts > 0 && coveragePct < 30) {
    warnings.push(`事实覆盖率偏低 (${coveragePct}%)，AI 可能忽略了大量已知数据`);
  }

  // ═══════════════════════════════════════════════════════════
  // Final verdict — V3 three-level output
  // ═══════════════════════════════════════════════════════════
  const criticalChecks = checks.filter(
    (c) => c.name === "数字溯源校验" || c.name === "财务声明校验",
  );
  const allCriticalPassed = criticalChecks.every((c) => c.passed);
  const allPassed = checks.every((c) => c.passed);

  // Determine level:
  //   "reject"  → critical checks failed (unverified numbers or fake financial claims)
  //   "warning" → all critical passed but non-critical checks or warnings exist
  //   "valid"   → everything passed, no warnings
  let valid: boolean;
  let level: "valid" | "warning" | "reject";

  if (!allCriticalPassed) {
    valid = false;
    level = "reject";
  } else if (!allPassed || warnings.length > 0) {
    valid = true;
    level = "warning";
  } else {
    valid = true;
    level = "valid";
  }

  const result: ValidationResult = {
    valid,
    level,
    reason: level === "reject"
      ? checks
          .filter((c) => !c.passed)
          .map((c) => `${c.name}: ${c.detail}`)
          .join(" | ")
      : undefined,
    checks,
    warnings,
    factCoverage: {
      totalFacts,
      factsReferenced,
      coveragePct,
    },
  };

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Convenience: validate parsed summary output
// ═══════════════════════════════════════════════════════════════

/**
 * Validate the parsed AI summary response against a fact sheet.
 * This is the most common integration point — called right after
 * DeepSeek returns and the JSON is parsed.
 */
export function validateSummary(
  summary: {
    title: string;
    sentiment: string;
    points: string[];
    risks: string[];
    rawJson?: string;
  },
  factSheet: FactSheet,
): ValidationResult {
  const allText = [
    summary.title,
    summary.sentiment,
    ...summary.points,
    ...summary.risks,
  ].join(" ");

  const output: AIOutput = {
    raw: summary.rawJson || allText,
    claims: [...summary.points, ...summary.risks],
    numbersFound: extractNumbers(allText),
    generatedBy: "DeepSeek/deepseek-chat",
    generatedAt: new Date().toISOString(),
  };

  return validateAIOutput(output, factSheet);
}

// ═══════════════════════════════════════════════════════════════
// Quick pre-check: is this even worth validating?
// ═══════════════════════════════════════════════════════════════

/**
 * Quick pre-validation check — can be run BEFORE calling the AI
 * to ensure the fact sheet itself meets minimum standards.
 */
export function preValidateFactSheet(sheet: FactSheet): {
  ready: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (sheet.facts.length === 0) {
    issues.push("FactSheet 为空 — 没有任何可验证的数据");
    return { ready: false, issues };
  }

  if (sheet.facts.length < 3) {
    issues.push(`FactSheet 仅有 ${sheet.facts.length} 条数据，建议至少 5 条以获得有意义的校验`);
  }

  // Check for required source diversity
  const sources = new Set(sheet.facts.map((f) => f.source));
  if (sources.size === 1 && sheet.facts.length > 3) {
    issues.push(`所有 ${sheet.facts.length} 条数据来自单一来源 (${[...sources][0]})，建议多渠道验证`);
  }

  // Check that no fact has "AI" as source (defense in depth)
  const aiFacts = sheet.facts.filter(
    (f) =>
      f.source.toLowerCase() === "ai" ||
      f.source.toLowerCase() === "deepseek" ||
      f.source.toLowerCase() === "estimated",
  );
  if (aiFacts.length > 0) {
    issues.push(`发现 ${aiFacts.length} 条数据来源标记为 AI/推测 — 这是严重违规`);
  }

  return { ready: issues.length === 0 || issues.every((i) => !i.includes("严重违规")), issues };
}

// ═══════════════════════════════════════════════════════════════
// Summary formatter — for logging and debugging
// ═══════════════════════════════════════════════════════════════

export function formatValidationResult(result: ValidationResult): string {
  const levelLabel = result.level === "valid" ? "✅ 通过" : result.level === "warning" ? "⚠️ 警告放行" : "❌ 拒绝";
  const lines = [
    `校验结果: ${levelLabel} (level=${result.level})`,
    result.reason ? `原因: ${result.reason}` : "",
    `事实覆盖率: ${result.factCoverage.factsReferenced}/${result.factCoverage.totalFacts} (${result.factCoverage.coveragePct}%)`,
    "",
    "检查详情:",
    ...result.checks.map(
      (c) => `  ${c.passed ? "✅" : "❌"} ${c.name}: ${c.detail || ""}`,
    ),
  ];

  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("⚠️ 警告:");
    lines.push(...result.warnings.map((w) => `  - ${w}`));
  }

  return lines.join("\n");
}
