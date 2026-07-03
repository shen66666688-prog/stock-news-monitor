import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock News Monitor - 热门股票新闻追踪",
  description:
    "追踪热门股票动态，实时新闻监控与AI智能总结，助力投资决策。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
        {children}
      </body>
    </html>
  );
}
