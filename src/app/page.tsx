"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import StockCard from "@/components/StockCard";
import type { Stock } from "@/types";

// ---------------------------------------------------------------------------
// Skeleton placeholder shown while hot stocks are loading
// ---------------------------------------------------------------------------
function StockCardSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div className="h-3 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="ml-4 space-y-2 text-right">
        <div className="ml-auto h-5 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="ml-auto h-4 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Home() {
  // Hot stocks state
  const [hotStocks, setHotStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [hotError, setHotError] = useState("");

  // Search state
  const [searchResult, setSearchResult] = useState<Stock | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // -----------------------------------------------------------------------
  // Fetch hot stocks on mount
  // -----------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setHotError("");
        const res = await fetch("/api/stocks/hot");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setHotStocks(data.stocks ?? []);
        }
      } catch (err) {
        console.error("Failed to load hot stocks:", err);
        if (!cancelled) {
          setHotError("热门股票数据加载失败，请刷新页面重试");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // -----------------------------------------------------------------------
  // Search handler
  // -----------------------------------------------------------------------
  const handleSearch = useCallback(async (query: string) => {
    setSearchError("");
    setSearching(true);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setSearchResult(null);
        setSearchError(data.error ?? "搜索失败");
      } else {
        setSearchResult(data.stock ?? null);
      }
    } catch {
      setSearchResult(null);
      setSearchError("搜索请求失败，请检查网络后重试");
    } finally {
      setSearching(false);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <>
      <Navbar />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* ---- Search ---- */}
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            🔍 搜索股票
          </h2>
          <SearchBar onSearch={handleSearch} />

          {/* Searching indicator */}
          {searching && (
            <p className="mt-3 animate-pulse text-sm text-zinc-400">
              正在搜索...
            </p>
          )}

          {/* Search result */}
          {!searching && searchResult && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2">
              <p className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                搜索结果:
              </p>
              <StockCard stock={searchResult} />
            </div>
          )}

          {/* Search error */}
          {!searching && searchError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              {searchError}
            </p>
          )}
        </section>

        {/* ---- Hot stocks ---- */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              🔥 热门股票
            </h2>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              实时数据 · Yahoo Finance
            </span>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <StockCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && hotError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {hotError}
              <button
                onClick={() => window.location.reload()}
                className="ml-2 underline underline-offset-2"
              >
                刷新
              </button>
            </div>
          )}

          {/* Data */}
          {!loading && !hotError && (
            <div className="grid gap-3 sm:grid-cols-2">
              {hotStocks.map((stock) => (
                <StockCard key={stock.symbol} stock={stock} />
              ))}
            </div>
          )}
        </section>

        {/* ---- Coming soon ---- */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            🚀 即将推出
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-dashed border-zinc-300 bg-amber-50/50 p-6 dark:border-zinc-700 dark:bg-amber-950/20">
              <span className="text-2xl">📰</span>
              <h3 className="mt-2 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                新闻监控
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                实时追踪关注股票的最新新闻，多来源聚合，智能去重。
              </p>
              <span className="mt-3 inline-block rounded-full bg-amber-200 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                开发中
              </span>
            </div>

            <div className="rounded-xl border border-dashed border-zinc-300 bg-purple-50/50 p-6 dark:border-zinc-700 dark:bg-purple-950/20">
              <span className="text-2xl">🤖</span>
              <h3 className="mt-2 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                AI 新闻总结
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                利用 AI 自动提炼新闻要点，分析市场情绪，辅助投资决策。
              </p>
              <span className="mt-3 inline-block rounded-full bg-purple-200 px-3 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                规划中
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        Stock News Monitor — 数据来源 Yahoo Finance，仅供参考，不构成投资建议
      </footer>
    </>
  );
}
