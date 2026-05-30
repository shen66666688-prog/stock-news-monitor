"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Stock, NewsItem, AISummary } from "@/types";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PriceHeaderSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-5 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-8 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-4 w-48 rounded bg-zinc-100 dark:bg-zinc-800" />
    </div>
  );
}

function NewsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-2 h-5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex gap-4">
            <div className="h-3 w-20 rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-3 w-32 rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Map a freeform sentiment string to colour classes */
function getSentimentStyle(sentiment: string) {
  const s = sentiment.toLowerCase();
  if (s.includes("利好") || s.includes("positive") || s.includes("bullish"))
    return {
      bg: "bg-green-50 dark:bg-green-950/30",
      text: "text-green-700 dark:text-green-400",
      border: "border-green-200 dark:border-green-800",
      label: `📈 ${sentiment}`,
    };
  if (s.includes("利空") || s.includes("negative") || s.includes("bearish"))
    return {
      bg: "bg-red-50 dark:bg-red-950/30",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-200 dark:border-red-800",
      label: `📉 ${sentiment}`,
    };
  return {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    label: `⚖️ ${sentiment}`,
  };
}

/** Card shell shared by all AISummaryPanel states */
function AICard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 dark:border-indigo-800 dark:from-indigo-950/40 dark:to-purple-950/30">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-300/30 blur-2xl dark:bg-indigo-500/10" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Loading state — keep the beautiful animated skeleton */
function AILoading() {
  return (
    <AICard>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xl dark:bg-indigo-900/60">
          🤖
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
            AI 智能总结
          </h3>
          <p className="mt-1 text-xs text-indigo-500 dark:text-indigo-400">
            DeepSeek AI 正在深度解析新闻...
          </p>
          <div className="mt-4 flex items-end gap-1">
            {[8, 16, 6, 12, 10, 14, 7, 11].map((h, i) => (
              <div
                key={i}
                className="w-1.5 animate-bounce rounded-full bg-indigo-300 dark:bg-indigo-600"
                style={{
                  height: `${h}px`,
                  animationDelay: `${i * 0.12}s`,
                  animationDuration: "1.2s",
                }}
              />
            ))}
            <span className="ml-2 text-[10px] text-indigo-400">分析中...</span>
          </div>
        </div>
      </div>
    </AICard>
  );
}

/** Mock state — no API key configured */
function AIMock() {
  return (
    <AICard>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xl dark:bg-indigo-900/60">
          🤖
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
            AI 智能总结
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            未检测到 AI 密钥，请在环境变量中配置{" "}
            <code className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
              DEEPSEEK_API_KEY
            </code>{" "}
            以开启真正的 AI 深度解析。
          </p>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            创建 <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">.env.local</code>{" "}
            文件并添加你的 DeepSeek API Key 即可自动激活。
          </p>
          <div className="mt-3">
            <span className="inline-block rounded-full border border-indigo-200 bg-indigo-100/50 px-2.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              🔑 等待配置
            </span>
          </div>
        </div>
      </div>
    </AICard>
  );
}

/** Error state */
function AIError({ onRetry }: { onRetry: () => void }) {
  return (
    <AICard>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-xl dark:bg-red-900/40">
          ⚠️
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            AI 分析暂不可用
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            AI 引擎暂时无法响应，请检查网络或 API 密钥后重试。
          </p>
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            🔄 重新分析
          </button>
        </div>
      </div>
    </AICard>
  );
}

/** Data state — the real deal */
function AIData({ summary }: { summary: AISummary }) {
  const sent = getSentimentStyle(summary.sentiment);

  return (
    <AICard>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xl dark:bg-indigo-900/60">
          🤖
        </div>
        <div className="min-w-0 flex-1">
          {/* Header row: title + sentiment */}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
              {summary.title}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${sent.bg} ${sent.text} ${sent.border}`}
            >
              {sent.label}
            </span>
          </div>

          {/* Key Points */}
          {summary.points.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {summary.points.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400 dark:bg-indigo-500" />
                  <span className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Risk warnings */}
          {summary.risks.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 dark:border-amber-700/40 dark:bg-amber-950/20">
              <p className="mb-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                ⚠️ 风险提示
              </p>
              <ul className="space-y-1">
                {summary.risks.map((risk, i) => (
                  <li
                    key={i}
                    className="text-xs text-amber-800 dark:text-amber-300/80"
                  >
                    · {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Generated time */}
          {summary.updatedAt && (
            <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
              由 DeepSeek AI 生成 ·{" "}
              {new Date(summary.updatedAt).toLocaleString("zh-CN")} · 仅供参考，不构成投资建议
            </p>
          )}
          {!summary.updatedAt && (
            <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
              由 DeepSeek AI 生成 · 仅供参考，不构成投资建议
            </p>
          )}
        </div>
      </div>
    </AICard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = (params.symbol as string)?.toUpperCase() ?? "";

  // Stock detail
  const [stock, setStock] = useState<Stock | null>(null);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState("");

  // News
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState("");

  // AI Summary
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  // -----------------------------------------------------------------------
  // Fetch stock
  // -----------------------------------------------------------------------
  const loadStock = useCallback(async () => {
    if (!symbol) return;
    setStockLoading(true);
    setStockError("");
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setStock(data.stock ?? null);
    } catch (err) {
      setStockError(err instanceof Error ? err.message : "加载股票数据失败");
    } finally {
      setStockLoading(false);
    }
  }, [symbol]);

  // -----------------------------------------------------------------------
  // Fetch news
  // -----------------------------------------------------------------------
  const loadNews = useCallback(async () => {
    if (!symbol) return;
    setNewsLoading(true);
    setNewsError("");
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/news`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setNews(data.news ?? []);
    } catch (err) {
      setNewsError(err instanceof Error ? err.message : "加载新闻失败");
    } finally {
      setNewsLoading(false);
    }
  }, [symbol]);

  // -----------------------------------------------------------------------
  // Fetch AI summary
  // -----------------------------------------------------------------------
  const loadSummary = useCallback(async () => {
    if (!symbol) return;
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const res = await fetch(
        `/api/stocks/${encodeURIComponent(symbol)}/summary`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setSummary(data.summary ?? null);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "AI 总结加载失败");
    } finally {
      setSummaryLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadStock();
    loadNews();
    loadSummary();
  }, [loadStock, loadNews, loadSummary]);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  const isPositive = (stock?.change ?? 0) >= 0;
  const changeColor = isPositive ? "text-green-600" : "text-red-600";
  const changeSign = isPositive ? "+" : "";

  const formatTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 36e5);
    if (diffH < 1) return `${Math.floor(diffMs / 6e4)} 分钟前`;
    if (diffH < 24) return `${diffH} 小时前`;
    return d.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Back navigation */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          返回
        </button>
      </div>

      {/* ---- Stock Price Header ---- */}
      <section className="mb-8">
        {stockLoading ? (
          <PriceHeaderSkeleton />
        ) : stockError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {stockError}
            <button
              onClick={loadStock}
              className="ml-2 underline underline-offset-2"
            >
              重试
            </button>
          </div>
        ) : stock ? (
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {stock.symbol}
              </h1>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {stock.name}
              </span>
              {stock.marketCap && (
                <span className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  {stock.marketCap}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                ${stock.price.toFixed(2)}
              </span>
              <span
                className={`text-lg font-semibold tabular-nums ${changeColor}`}
              >
                {changeSign}
                {stock.change.toFixed(2)} ({changeSign}
                {stock.changePercent.toFixed(2)}%)
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              成交量: {(stock.volume / 1_000_000).toFixed(2)}M
            </p>
          </div>
        ) : null}
      </section>

      {/* ---- AI Summary ---- */}
      <section className="mb-8">
        {summaryLoading ? (
          <AILoading />
        ) : summaryError ? (
          <AIError onRetry={loadSummary} />
        ) : summary?.mock ? (
          <AIMock />
        ) : summary ? (
          <AIData summary={summary} />
        ) : null}
      </section>

      {/* ---- News ---- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            📰 最新新闻
          </h2>
          {news.length > 0 && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Yahoo Finance
            </span>
          )}
        </div>

        {newsLoading && <NewsSkeleton />}

        {!newsLoading && newsError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {newsError}
            <button
              onClick={loadNews}
              className="ml-2 underline underline-offset-2"
            >
              重试
            </button>
          </div>
        )}

        {!newsLoading && !newsError && news.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
            暂无相关新闻
          </div>
        )}

        {!newsLoading &&
          !newsError &&
          news.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80"
            >
              <h3 className="text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-100">
                {item.title}
              </h3>
              <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
                <span>{item.source}</span>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span>{formatTime(item.publishedAt)}</span>
                <span className="ml-auto text-[10px] text-zinc-300 dark:text-zinc-600">
                  ↗ 原文
                </span>
              </div>
            </a>
          ))}
      </section>

      <div className="h-8" />
    </div>
  );
}
