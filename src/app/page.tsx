"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import StockCard from "@/components/StockCard";
import { hotStocks } from "@/data/hotStocks";
import type { Stock } from "@/types";

export default function Home() {
  const [searchResult, setSearchResult] = useState<Stock | null>(null);
  const [searchError, setSearchError] = useState("");

  const handleSearch = (query: string) => {
    // 先在热门股票中查找
    const found = hotStocks.find(
      (s) => s.symbol.toUpperCase() === query.toUpperCase()
    );
    if (found) {
      setSearchResult(found);
      setSearchError("");
    } else {
      setSearchResult(null);
      setSearchError(`未找到股票 "${query}"，请检查代码后重试`);
    }
  };

  return (
    <>
      <Navbar />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* 搜索区域 */}
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            🔍 搜索股票
          </h2>
          <SearchBar onSearch={handleSearch} />

          {/* 搜索结果 */}
          {searchResult && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2">
              <p className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                搜索结果:
              </p>
              <StockCard stock={searchResult} />
            </div>
          )}
          {searchError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              {searchError}
            </p>
          )}
        </section>

        {/* 热门股票 */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              🔥 热门股票
            </h2>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              数据仅供参考
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {hotStocks.map((stock) => (
              <StockCard key={stock.symbol} stock={stock} />
            ))}
          </div>
        </section>

        {/* 即将推出的功能 */}
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
        Stock News Monitor — 数据仅供参考，不构成投资建议
      </footer>
    </>
  );
}
