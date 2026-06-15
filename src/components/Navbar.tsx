import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">📈</span>
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Stock News Monitor
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <Link
            href="/"
            className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            热门股票
          </Link>
          <Link
            href="/dashboard"
            className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            📊 验证面板
          </Link>
          <span
            className="cursor-not-allowed text-zinc-300 dark:text-zinc-600"
            title="即将上线"
          >
            新闻监控
          </span>
          <span
            className="cursor-not-allowed text-zinc-300 dark:text-zinc-600"
            title="即将上线"
          >
            AI 总结
          </span>
        </nav>
      </div>
    </header>
  );
}
