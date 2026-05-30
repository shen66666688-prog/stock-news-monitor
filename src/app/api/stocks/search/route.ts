import { NextRequest, NextResponse } from "next/server";
import { searchStock } from "@/lib/stocks";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toUpperCase();

  if (!q) {
    return NextResponse.json({ error: "请提供股票代码" }, { status: 400 });
  }

  // Basic validation — allow letters, numbers, dots, hyphens (e.g. BRK-B)
  if (!/^[A-Z0-9.\-]{1,10}$/.test(q)) {
    return NextResponse.json({ error: "无效的股票代码格式" }, { status: 400 });
  }

  try {
    const stock = await searchStock(q);
    if (!stock) {
      return NextResponse.json({ error: `未找到股票 "${q}"` }, { status: 404 });
    }
    return NextResponse.json({ stock });
  } catch (error) {
    console.error(`/api/stocks/search?q=${q} error:`, error);
    return NextResponse.json(
      { error: "搜索失败，请稍后重试" },
      { status: 500 }
    );
  }
}
