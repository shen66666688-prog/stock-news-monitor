"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Stock, NewsItem } from "@/types";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Skeleton for the stock price header */
function PriceHeaderSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-5 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-8 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-4 w-48 rounded bg-zinc-100 dark:bg-zinc-800" />
    </div>
  );
}

/** Skeleton for news list items */
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

/** AI Summary loading placeholder */
function AISummaryPlaceholder() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 dark:border-indigo-800 dark:from-indigo-950/40 dark:to-purple-950/30">
      {/* Decorative glow */}
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-300/30 blur-2xl dark:bg-indigo-500/10" />

      <div className="relative flex items-start gap-3">
        {/* Robot icon */}
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

          {/* Animated bars */}
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
            <span className="ml-2 text-[10px] text-indigo-400">
              分析中...
            </span>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            下一阶段将接入 DeepSeek 大模型，自动分析多篇新闻的市场情绪，
            提炼核心要点，生成结构化的投资参考摘要。
          </p>
        </div>
      </div>

      {/* Coming soon badge */}
      <div className="relative mt-3">
        <span className="inline-block rounded-full bg-indigo-200/70 px-2.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-800/50 dark:text-indigo-300">
          🚀 即将上线
        </span>
      </div>
    </div>
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

  // -----------------------------------------------------------------------
  // Fetch stock data
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

  useEffect(() => {
    loadStock();
    loadNews();
  }, [loadStock, loadNews]);

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

      {/* ---- AI Summary (placeholder) ---- */}
      <section className="mb-8">
        <AISummaryPlaceholder />
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

        {/* Loading */}
        {newsLoading && <NewsSkeleton />}

        {/* Error */}
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

        {/* Empty */}
        {!newsLoading && !newsError && news.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
            暂无相关新闻
          </div>
        )}

        {/* News list */}
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

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  );
}
