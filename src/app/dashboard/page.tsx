"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MetricsRecord {
  date: string;
  stocks: string[];
  generationCount: number;
  contentCount?: number;
  views: number;
  likes: number;
  favorites: number;
  comments: number;
  followers: number;
}

interface MetricsSummary {
  totalDays: number;
  totalGenerations: number;
  totalContent: number;
  uniqueStocks: number;
  stockList: string[];
}

interface MetricsResponse {
  records: MetricsRecord[];
  summary: MetricsSummary;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-2 h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-6 w-12 rounded bg-zinc-300 dark:bg-zinc-700" />
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk badge
// ---------------------------------------------------------------------------
function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    "高": "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    "中": "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    "低": "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  };
  const emoji: Record<string, string> = { "高": "🔴", "中": "🟡", "低": "🟢" };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[level] || colors["中"]}`}
    >
      {emoji[level] || ""} {level}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);

  const fetchMetrics = useCallback(async (d: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/metrics?days=${d}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      console.error("Failed to load metrics:", e);
      setError("指标数据加载失败，请确认已运行每日管线");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics(days);
  }, [days, fetchMetrics]);

  // ── Derived stats ──
  const summary = data?.summary;
  const records = data?.records || [];

  // 7-day generation count (from summary)
  const gen7d = summary?.totalGenerations || 0;
  // Stock count
  const stock7d = summary?.uniqueStocks || 0;
  // Content count
  const content7d = summary?.totalContent || 0;

  return (
    <>
      <Navbar />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* ── Header ── */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              📊 Market Validation Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              市场验证数据面板 · AI 投研内容系统
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  days === d
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {d}天
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && <DashboardSkeleton />}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-amber-800 dark:text-amber-300">
              ⚠️ {error}
            </p>
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              请先运行 <code className="rounded bg-amber-200 px-1 dark:bg-amber-800">npm run daily-pipeline</code> 生成数据
            </p>
          </div>
        )}

        {/* ── Data ── */}
        {!loading && !error && data && (
          <>
            {/* ── Stat cards ── */}
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                icon="📅"
                label={`最近${days}天生成次数`}
                value={gen7d}
                unit="次"
                accent="blue"
              />
              <StatCard
                icon="📈"
                label={`最近${days}天监控股票`}
                value={stock7d}
                unit="只"
                accent="green"
              />
              <StatCard
                icon="📄"
                label={`最近${days}天内容数量`}
                value={content7d}
                unit="个"
                accent="purple"
              />
              <StatCard
                icon="🕐"
                label="数据天数"
                value={summary?.totalDays || 0}
                unit="天"
                accent="amber"
              />
            </div>

            {/* ── Stock list ── */}
            <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                📋 监控股票列表
              </h2>
              <div className="flex flex-wrap gap-2">
                {(summary?.stockList || []).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Daily records table ── */}
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                  📊 每日指标明细
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        日期
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        监控股票
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        生成数
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        内容数
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        👁️ 浏览
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        ❤️ 赞
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        ⭐ 收藏
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        💬 评论
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                        👥 粉丝
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                          暂无数据 — 运行每日管线后将自动填充
                        </td>
                      </tr>
                    ) : (
                      records.map((r) => (
                        <tr
                          key={r.date}
                          className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                            {r.date}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(r.stocks || []).map((s) => (
                                <span
                                  key={s}
                                  className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                            {r.generationCount}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                            {r.contentCount ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-zinc-500">{r.views}</td>
                          <td className="px-4 py-3 text-zinc-500">{r.likes}</td>
                          <td className="px-4 py-3 text-zinc-500">{r.favorites}</td>
                          <td className="px-4 py-3 text-zinc-500">{r.comments}</td>
                          <td className="px-4 py-3 text-zinc-500">{r.followers}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Last updated ── */}
            {data.lastUpdated && (
              <p className="mt-4 text-right text-xs text-zinc-400">
                最后更新: {new Date(data.lastUpdated).toLocaleString("zh-CN")}
              </p>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        Market Validation Dashboard — 数据来源 Yahoo Finance + DeepSeek AI，仅供参考
      </footer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Stat card component
// ---------------------------------------------------------------------------
function StatCard({
  icon,
  label,
  value,
  unit,
  accent,
}: {
  icon: string;
  label: string;
  value: number;
  unit: string;
  accent: "blue" | "green" | "purple" | "amber";
}) {
  const borders: Record<string, string> = {
    blue: "border-l-blue-500",
    green: "border-l-green-500",
    purple: "border-l-purple-500",
    amber: "border-l-amber-500",
  };
  const bgs: Record<string, string> = {
    blue: "bg-blue-50/50 dark:bg-blue-950/20",
    green: "bg-green-50/50 dark:bg-green-950/20",
    purple: "bg-purple-50/50 dark:bg-purple-950/20",
    amber: "bg-amber-50/50 dark:bg-amber-950/20",
  };

  return (
    <div
      className={`rounded-xl border border-l-4 border-zinc-200 p-4 dark:border-zinc-800 ${borders[accent]} ${bgs[accent]}`}
    >
      <div className="mb-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {value}
        </span>
        <span className="text-sm text-zinc-400">{unit}</span>
      </div>
    </div>
  );
}
