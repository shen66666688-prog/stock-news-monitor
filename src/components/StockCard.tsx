import type { Stock } from "@/types";

interface StockCardProps {
  stock: Stock;
}

export default function StockCard({ stock }: StockCardProps) {
  const isPositive = stock.change >= 0;
  const changeColor = isPositive ? "text-green-600" : "text-red-600";
  const changeSign = isPositive ? "+" : "";

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {stock.symbol}
          </h3>
          <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {stock.name}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          成交量: {(stock.volume / 1_000_000).toFixed(2)}M
        </p>
      </div>
      <div className="ml-4 text-right">
        <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
          ${stock.price.toFixed(2)}
        </p>
        <p className={`text-sm font-medium tabular-nums ${changeColor}`}>
          {changeSign}
          {stock.change.toFixed(2)} ({changeSign}
          {stock.changePercent.toFixed(2)}%)
        </p>
      </div>
    </div>
  );
}
