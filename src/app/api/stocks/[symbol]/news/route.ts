import { NextRequest, NextResponse } from "next/server";
import { fetchStockNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const sym = symbol.trim().toUpperCase();

  if (!/^[A-Z0-9.\-]{1,10}$/.test(sym)) {
    return NextResponse.json({ error: "无效的股票代码" }, { status: 400 });
  }

  try {
    const result = await fetchStockNews(sym);
    return NextResponse.json({
      symbol: sym,
      news: result.news,
      fromCache: result.fromCache,
    });
  } catch (error) {
    console.error(`/api/stocks/${sym}/news error:`, error);
    return NextResponse.json(
      { error: "获取新闻失败，请稍后重试" },
      { status: 500 },
    );
  }
}
