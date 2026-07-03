"use client";

import { useState, useCallback, useEffect } from "react";

// Stats tracking
function track(event: string, meta?: Record<string, unknown>) {
  fetch("/api/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, meta }) }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StepResult {
  label: string;
  status: "running" | "done" | "error";
  data?: Record<string, unknown>;
}

interface Feedback {
  helpful: boolean;
  reasons?: string[];
  note?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CopilotPage() {
  const [content, setContent] = useState("");
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Track copy
  const [copied, setCopied] = useState(false);

  const charCount = content.length;
  const xhsData = steps.find((s) => s.label === "小红书生成")?.data;
  const complianceData = steps.find((s) => s.label === "合规检测")?.data;
  const factsData = steps.find((s) => s.label === "事实核查")?.data;
  const rewriteData = steps.find((s) => s.label === "安全改写")?.data;

  const safeToPublish = complianceData?.safeToPublish as boolean | undefined;
  const riskLevel = (complianceData?.riskLevel as string) || "";

  // Track pageview
  useEffect(() => { track("pageview"); }, []);

  const handleGenerate = useCallback(async () => {
    if (!content.trim()) { setError("请先输入内容"); return; }
    setError("");
    setFeedback(null);
    setCopied(false);
    setLoading(true);
    setSteps([
      { label: "事实核查", status: "running" },
      { label: "合规检测", status: "running" },
      { label: "安全改写", status: "running" },
      { label: "小红书生成", status: "running" },
    ]);
    const t0 = Date.now();
    setStartTime(t0);

    // Poll progress
    const interval = setInterval(() => setElapsed(Date.now() - t0), 200);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish-ready", content: content.trim(), ticker: ticker.trim() || undefined }),
      });
      const data = await res.json();
      clearInterval(interval);
      setElapsed(Date.now() - t0);

      if (!res.ok) {
        setError(data.error || "请求失败");
        setLoading(false);
        return;
      }

      track("generate", { charCount: content.length, elapsed: Date.now() - t0, steps: data.steps?.length });

      // Map API steps to UI steps
      const apiSteps = (data.steps as Array<{ label: string; status: string; data?: unknown }>) || [];
      setSteps(apiSteps.map((s) => ({
        label: s.label,
        status: s.status === "done" ? "done" : "error",
        data: s.data as Record<string, unknown> | undefined,
      })));
    } catch (err) {
      clearInterval(interval);
      setError(`失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [content, ticker]);

  // Reset
  const handleReset = () => {
    setSteps([]);
    setFeedback(null);
    setError("");
    setCopied(false);
    setElapsed(0);
  };

  // Copy full result
  const handleCopy = () => {
    if (!xhsData) return;
    const parts = [
      String(xhsData.title || ""), "",
      ...((xhsData.body as string[]) || [String(xhsData.body || "")]), "",
      String(xhsData.cta || ""), "",
      ((xhsData.hashtags as string[]) || []).map((t: string) => `#${t}`).join(" "),
    ];
    navigator.clipboard.writeText(parts.join("\n")).catch(console.error);
    setCopied(true);
    track("copy");
    setTimeout(() => setCopied(false), 2000);
  };

  // Feedback
  const handleFeedback = (helpful: boolean) => {
    setFeedback({ helpful, reasons: [], note: "" });
    track(helpful ? "feedback_good" : "feedback_bad");
  };
  const toggleReason = (r: string) => {
    if (!feedback) return;
    const reasons = feedback.reasons || [];
    setFeedback({ ...feedback, reasons: reasons.includes(r) ? reasons.filter((x) => x !== r) : [...reasons, r] });
  };

  const allDone = steps.length > 0 && steps.every((s) => s.status !== "running");
  const hasResult = allDone && !loading && !error;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero */}
      <div className="relative border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent dark:from-blue-900/20" />
        <div className="relative mx-auto max-w-2xl px-6 py-12 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            AI 财经内容 Copilot
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            输入内容，一键生成可发布的
            <span className="bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent"> 小红书笔记</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            自动完成事实核查 · 合规检测 · 安全改写 — 20分钟变2分钟
          </p>
        </div>
      </div>

      {/* Main */}
      <div className="mx-auto max-w-2xl px-6 py-8">
        {/* Input */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="粘贴你的财经内容…&#10;&#10;例：英伟达股价暴涨50%！AI芯片需求爆炸，现在不买就晚了！分析师预计下季度营收超300亿美元。"
            rows={6}
            disabled={loading}
            className="w-full resize-y border-0 bg-transparent px-5 py-4 text-sm leading-relaxed text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder-zinc-500"
          />

          {/* Examples */}
          {!hasResult && !loading && content.length === 0 && (
            <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-400">试试这些示例 ↓</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "苹果发布WWDC，AI功能全面升级，分析师上调目标价至250美元。iPhone销量超预期，服务业务增长强劲。",
                  "英伟达股价大跌8%，市场担心AI芯片需求见顶。但分析师指出数据中心订单仍在增长，可能是买入机会？",
                  "特斯拉Q3交付数据公布，低于市场预期。但FSD全自动驾驶在中国获批，长期利好能否抵消短期利空？",
                ].map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => { setContent(ex); setTicker(["AAPL", "NVDA", "TSLA"][i]); }}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs leading-relaxed text-zinc-600 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
                  >
                    {["🍎 苹果", "🟢 英伟达", "🚗 特斯拉"][i]} {["WWDC利好", "大跌抄底？", "FSD获批"][i]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom bar */}
          <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="代码"
                disabled={loading}
                className="w-20 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-mono text-zinc-600 placeholder-zinc-400 focus:border-blue-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                maxLength={5}
              />
              <span className="text-xs text-zinc-400 tabular-nums">{charCount} 字</span>
            </div>

            <div className="flex items-center gap-2">
              {!hasResult && (
                <button
                  onClick={handleGenerate}
                  disabled={loading || !content.trim()}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all ${
                    loading || !content.trim()
                      ? "cursor-not-allowed bg-zinc-300 dark:bg-zinc-700"
                      : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-sm hover:shadow-md active:scale-[0.98]"
                  }`}
                >
                  {loading ? <Spinner /> : <LightningIcon />}
                  {loading ? "处理中…" : "⚡ 一键生成可发布的小红书笔记"}
                </button>
              )}
              {hasResult && (
                <button onClick={handleReset} className="rounded-xl px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400">
                  重新生成
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-800 dark:bg-red-950/50">
            <span className="shrink-0 text-red-500">⚠</span>
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Progress */}
        {loading && (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">AI 正在处理…</p>
              <span className="text-xs text-zinc-400">{(elapsed / 1000).toFixed(1)}s</span>
            </div>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                  {s.status === "running" ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  ) : s.status === "done" ? (
                    <span className="text-emerald-500">✓</span>
                  ) : (
                    <span className="text-red-500">✕</span>
                  )}
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{s.label}</span>
                  {s.status === "done" && <span className="ml-auto text-[10px] text-zinc-400">完成</span>}
                  {s.status === "error" && <span className="ml-auto text-[10px] text-red-400">失败</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {hasResult && xhsData && (
          <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Risk badge */}
            {complianceData && (
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                safeToPublish ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"
              }`}>
                <span className="text-lg">{safeToPublish ? "✅" : "⚠️"}</span>
                <div>
                  <p className={`text-sm font-medium ${safeToPublish ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    {safeToPublish ? "合规通过，可直接发布" : `存在风险 — ${riskLevel}`}
                  </p>
                  <p className="text-xs text-zinc-500">{(elapsed / 1000).toFixed(1)} 秒完成</p>
                </div>
              </div>
            )}

            {/* Main XHS card */}
            <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-800 dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">📱 小红书版本</h3>
                <button
                  onClick={handleCopy}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    copied ? "bg-emerald-100 text-emerald-700" : "bg-rose-500 text-white hover:bg-rose-600"
                  }`}
                >
                  {copied ? "✓ 已复制" : "一键复制"}
                </button>
                <button
                  onClick={() => { handleCopy(); handleReset(); }}
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                >
                  复制并继续 →
                </button>
              </div>

              {/* Title */}
              <div className="rounded-xl bg-rose-50/50 p-4 dark:bg-rose-950/20">
                <p className="text-xs text-rose-500">标题</p>
                <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">{String(xhsData.title || "—")}</p>
              </div>

              {/* Body */}
              <div className="mt-3 space-y-2">
                {((xhsData.body as string[]) || [String(xhsData.body || "")]).map((p: string, i: number) => (
                  <p key={i} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{p}</p>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-3 rounded-xl bg-rose-50/50 p-3 dark:bg-rose-950/20">
                <p className="text-xs text-rose-500">互动引导</p>
                <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">{String(xhsData.cta || "—")}</p>
              </div>

              {/* Tags */}
              {((xhsData.hashtags as string[]) || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {((xhsData.hashtags as string[]) || []).map((t: string, i: number) => (
                    <span key={i} className="rounded-full bg-rose-100 px-2.5 py-1 text-xs text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Feedback */}
            {!feedback ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500">这个结果可以直接发布吗？</p>
                <div className="mt-2 flex justify-center gap-3">
                  <button onClick={() => handleFeedback(true)} className="rounded-lg border border-zinc-200 px-4 py-2 text-lg hover:bg-emerald-50 dark:border-zinc-700 dark:hover:bg-emerald-950/30">👍</button>
                  <button onClick={() => handleFeedback(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-lg hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-red-950/30">👎</button>
                </div>
              </div>
            ) : feedback.helpful ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
                👍 感谢反馈！
              </div>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-800 dark:bg-red-950/20">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">哪里不够好？</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["不够自然", "太像AI", "合规问题", "内容太短", "数据有误", "其他"].map((r) => (
                    <button
                      key={r}
                      onClick={() => toggleReason(r)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        feedback.reasons?.includes(r)
                          ? "border-red-400 bg-red-100 text-red-700 dark:border-red-600 dark:bg-red-900/50 dark:text-red-300"
                          : "border-zinc-200 text-zinc-600 hover:border-red-300 dark:border-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button onClick={() => setFeedback({ ...feedback, reasons: feedback.reasons || [] })} className="mt-3 text-xs text-blue-500 hover:underline">
                  提交反馈
                </button>
              </div>
            )}
          </div>
        )}

        {/* Detail disclosure */}
        {hasResult && (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400">
              查看详细检测结果
            </summary>
            <div className="mt-3 space-y-3">
              {factsData && <DetailBlock title="🔍 事实核查" data={factsData} />}
              {complianceData && <DetailBlock title="🛡️ 合规检测" data={complianceData} />}
              {rewriteData && <DetailBlock title="✍️ 安全改写" data={rewriteData} renderSpecial={(d) => (
                <div className="mt-2 rounded-lg bg-white/60 p-3 text-sm dark:bg-zinc-900/60">
                  <p className="text-zinc-700 dark:text-zinc-300">{String(d.rewritten || "—")}</p>
                  {(d.addedDisclaimer as string) && <p className="mt-2 text-xs text-blue-600">📝 {String(d.addedDisclaimer)}</p>}
                </div>
              )} />}
            </div>
          </details>
        )}

        {/* Advanced */}
        <details className="mt-4" open={showAdvanced}>
          <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500" onClick={() => setShowAdvanced(!showAdvanced)}>
            高级工具（单独使用）
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              ["check-facts", "🔍 事实核查"],
              ["check-compliance", "🛡️ 合规检测"],
              ["rewrite-safe", "✍️ 安全改写"],
              ["generate-xhs", "📱 小红书生成"],
            ].map(([action, label]) => (
              <button
                key={action}
                onClick={async () => {
                  if (!content.trim()) return;
                  setSteps([{ label: label.replace(/^[^\s]+\s/, ""), status: "running" }]);
                  const res = await fetch("/api/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, content: content.trim(), ticker: ticker.trim() || undefined }) });
                  const data = await res.json();
                  setSteps([{ label: label.replace(/^[^\s]+\s/, ""), status: "done", data }]);
                }}
                className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
              >
                {label}
              </button>
            ))}
          </div>
        </details>

        {/* Empty */}
        {!hasResult && !loading && content.length === 0 && (
          <div className="mt-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <span className="text-xl text-zinc-300 dark:text-zinc-600">⌘</span>
            </div>
            <p className="text-sm text-zinc-400">粘贴内容，点一下按钮</p>
          </div>
        )}
      </div>

      {/* Demo showcase */}
      {!hasResult && !loading && content.length === 0 && (
        <div className="mt-16 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">👇 AI 生成的示例</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-400">输入原文</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">苹果发布WWDC，AI功能全面升级，分析师上调目标价至250美元。iPhone销量超预期，服务业务增长强劲。但现在股价已经涨了不少，还值得追吗？</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-400">AI 输出（合规+可发布的版本）</p>
              <div className="mt-1 rounded-lg bg-rose-50/50 p-3 text-xs leading-relaxed dark:bg-rose-950/20">
                <p className="font-bold text-zinc-800 dark:text-zinc-200">🍎 苹果AI大招来了！WWDC后值得追吗？</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">📊 苹果最新动态：WWDC发布AI新功能，分析师将目标价上调至250美元。iPhone销量超预期，服务业务占比持续提升。</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">⚠️ 当前股价已反映部分乐观预期。历史数据显示，发布会后短期内存在回调风险。投资者需关注实际AI功能落地节奏。</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">💬 你看好苹果AI转型吗？A. 长期看好 B. 短期偏高 C. 等回调再进 评论区聊聊👇</p>
                <p className="mt-2 text-zinc-400">#苹果 #美股 #AI #WWDC #投资分析</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-16 border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        内容本地处理 · 不构成投资建议
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function DetailBlock({ title, data, renderSpecial }: { title: string; data: Record<string, unknown>; renderSpecial?: (d: Record<string, unknown>) => React.ReactNode }) {
  if (data._error) return <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800 dark:bg-red-950/20">{String(data._error)}</div>;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</p>
      {renderSpecial ? renderSpecial(data) : (
        <pre className="mt-2 max-h-48 overflow-auto text-xs text-zinc-500 dark:text-zinc-400">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}

function LightningIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
}
function Spinner() {
  return <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
}
