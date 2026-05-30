import { NextResponse } from "next/server";
import { fetchHotStocks } from "@/lib/stocks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await fetchHotStocks();
    return NextResponse.json({
      stocks: result.stocks,
      fromCache: result.fromCache,
    });
  } catch (error) {
    console.error("/api/stocks/hot error:", error);
    return NextResponse.json(
      { error: "获取热门股票数据失败，请稍后重试" },
      { status: 500 }
    );
  }
}
