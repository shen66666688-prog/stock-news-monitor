import { NextRequest, NextResponse } from "next/server";
import { searchStock } from "@/lib/stocks";

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
    const stock = await searchStock(sym);
    if (!stock) {
      return NextResponse.json(
        { error: `未找到股票 "${sym}"` },
        { status: 404 },
      );
    }
    return NextResponse.json({ stock });
  } catch (error) {
    console.error(`/api/stocks/${sym} error:`, error);
    return NextResponse.json(
      { error: "获取股票数据失败，请稍后重试" },
      { status: 500 },
    );
  }
}
