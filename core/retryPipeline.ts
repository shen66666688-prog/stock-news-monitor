/**
 * retryPipeline.ts — V3 重试管道
 *
 * 职责：
 *   - 生成内容后自动校验
 *   - valid → 直接输出
 *   - warning → 输出但记录警告
 *   - reject → 自动重跑（最多 3 次）
 *
 * 这是 V3 相对于 V2 的核心升级：
 *   V2: generate → validate → return (pass or fail, no retry)
 *   V3: generate → validate → retry if reject (up to 3 attempts)
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Generic async generator function */
type GenerateFn<T> = () => Promise<T>;

/** V3-compatible validation function (must return level field) */
type ValidateFn<T> = (output: T) => {
  valid: boolean;
  level: "valid" | "warning" | "reject";
  reason?: string;
};

/** Result of a retry pipeline run */
export interface RetryResult<T> {
  /** The final output (best attempt even on final failure) */
  output: T;
  /** Final status */
  status: "valid" | "warning" | "reject_final";
  /** Number of attempts made */
  attempts: number;
  /** Per-attempt log for debugging */
  attemptLog: Array<{
    attempt: number;
    status: "valid" | "warning" | "reject";
    reason?: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// Core retry logic
// ═══════════════════════════════════════════════════════════════

/**
 * Run a generator function with automatic retry on validation rejection.
 *
 * Flow:
 *   1. Call generateFn() → get output
 *   2. Call validateFn(output) → get { valid, level, reason }
 *   3. If level is "valid" or "warning" → return immediately
 *   4. If level is "reject" and retries remain → go back to step 1
 *   5. If out of retries → return best effort with status "reject_final"
 *
 * @param generateFn - Async function that produces content (e.g. call DeepSeek)
 * @param validateFn - Sync function that validates the output
 * @param maxRetry - Maximum retry attempts (default 3)
 */
export async function runWithRetry<T>(
  generateFn: GenerateFn<T>,
  validateFn: ValidateFn<T>,
  maxRetry: number = 3,
): Promise<RetryResult<T>> {
  let lastOutput!: T;
  let attempts = 0;
  const attemptLog: RetryResult<T>["attemptLog"] = [];

  while (attempts < maxRetry) {
    attempts++;

    // ── Generate ──
    const output = await generateFn();
    lastOutput = output;

    // ── Validate ──
    const result = validateFn(output);
    attemptLog.push({
      attempt: attempts,
      status: result.level,
      reason: result.reason,
    });

    // ✅ Passed clean
    if (result.level === "valid") {
      return {
        output,
        status: "valid",
        attempts,
        attemptLog,
      };
    }

    // ⚠️ Warning — also pass, but flag it
    if (result.level === "warning") {
      return {
        output,
        status: "warning",
        attempts,
        attemptLog,
      };
    }

    // ❌ Reject — retry if attempts remain
    console.warn(
      `[retryPipeline] Attempt ${attempts}/${maxRetry} rejected: ${result.reason || "unknown"}. ${attempts < maxRetry ? "Retrying..." : "Max retries reached."}`,
    );
  }

  // ❌ All retries exhausted — return best effort
  return {
    output: lastOutput,
    status: "reject_final",
    attempts,
    attemptLog,
  };
}

// ═══════════════════════════════════════════════════════════════
// Convenience: generate content with DeepSeek + retry + validate
// ═══════════════════════════════════════════════════════════════

/**
 * Example integration pattern — wraps an AI content generator with retry.
 *
 * Usage:
 *   const result = await generateWithRetry(
 *     () => deepseekGenerateContent(prompt),
 *     (output) => validateAIOutput(output, factSheet),
 *   );
 *
 *   if (result.status === "valid") { ... publish ... }
 *   else if (result.status === "warning") { ... publish with caveat ... }
 *   else { ... manual review needed ... }
 */
export async function generateWithRetry<T>(
  generateFn: GenerateFn<T>,
  validateFn: ValidateFn<T>,
  maxRetry: number = 3,
): Promise<RetryResult<T>> {
  return runWithRetry(generateFn, validateFn, maxRetry);
}
