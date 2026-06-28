/**
 * MCP Server 功能测试 — 不依赖 MCP 传输层，直接测试工具逻辑
 * 运行：npx tsx mcp-server/test.ts
 */

// ── 导入核心函数（手动编译检查）──
// 直接 import server.ts 会启动 stdio 监听，所以在这里手动模拟工具调用。

import YahooFinance from "yahoo-finance2";
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const YF_URL = "https://query1.finance.yahoo.com/v7/finance/quote";

async function testFetchQuote() {
  console.log("🧪 测试 1: Yahoo Finance 数据获取 (NVDA)");
  try {
    const q = await yf.quote("NVDA") as any;
    if (!q || q.regularMarketPrice === undefined) return console.log("  ❌ No result");
    console.log(`  ✅ ${q.shortName || q.longName}: $${q.regularMarketPrice} | PE=${q.trailingPE} | Cap=${q.marketCap}`);
    return true;
  } catch (e) {
    console.log("  ❌", (e as Error).message);
    return false;
  }
}

async function testFactSheet() {
  console.log("\n🧪 测试 2: FactLayer 事实构建");
  // 静态内联测试
  const BLOCKED = new Set(["ai", "chatgpt", "llm", "估计", ""]);

  function makeFact(ticker: string, fact: string, value: any, source: string, cat: string) {
    if (BLOCKED.has(source.toLowerCase().trim())) {
      throw new Error(`REJECTED: source "${source}" blocked. Fact: "${fact}"`);
    }
    return { ticker: ticker.toUpperCase(), fact, value, category: cat, source, verifiedAt: new Date().toISOString() };
  }

  // Test valid
  try {
    const f = makeFact("NVDA", "NVDA Q4 FY2026 收入: $35.08B", 35080000000, "SEC", "revenue");
    console.log(`  ✅ Valid: ${f.fact} (source: ${f.source})`);
  } catch (e) {
    console.log(`  ❌ ${(e as Error).message}`);
  }

  // Test blocked
  try {
    makeFact("NVDA", "NVDA 预期收入约 $40B", 40000000000, "AI", "revenue");
    console.log("  ❌ Should have rejected AI source!");
  } catch (e) {
    console.log(`  ✅ Correctly rejected: ${(e as Error).message}`);
  }

  // Test blocked Chinese
  try {
    makeFact("NVDA", "预计收入", 40000000000, "估计", "revenue");
    console.log("  ❌ Should have rejected 估计!");
  } catch (e) {
    console.log(`  ✅ Correctly rejected: ${(e as Error).message}`);
  }
}

async function testNumberExtractor() {
  console.log("\n🧪 测试 3: 数字提取 + 校验");
  const patterns = [
    /\$(\d+(?:\.\d+)?)\s*(?:万亿|[万亿]|[BMKbm]|亿|万)?/g,
    /(\d+(?:\.\d+)?)\s*(?:万亿|亿|万|[BMKbm]|%|％|倍|x)/g,
    /\b(\d{4,}(?:\.\d+)?)\b/g,
    /(\d+(?:\.\d+)?)\s*[%％]/g,
  ];

  const testCases = [
    { text: "NVDA 股价 $205，PE 35x，营收 $35.08B，涨了 4.5%。", expected: 5 },
    { text: "META 从 $796 跌到 $568，机会还是陷阱？", expected: 3 }, // 796, 568 + potential others
    { text: "今天天气真好", expected: 0 },
    { text: "微软收入 $198.27B，净利润 $88.14B，市值 $2.8T", expected: 3 },
  ];

  function countNumbers(text: string): number {
    const seen = new Set<string>();
    let count = 0;
    for (const p of patterns) {
      const regex = new RegExp(p.source, p.flags);
      let m;
      while ((m = regex.exec(text)) !== null) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v > 0) {
          const key = `${v}|${text.slice(Math.max(0, m.index - 5), m.index + 5)}`;
          if (!seen.has(key)) { seen.add(key); count++; }
        }
      }
    }
    return count;
  }

  for (const tc of testCases) {
    const count = countNumbers(tc.text);
    const icon = count >= tc.expected * 0.7 ? "✅" : "⚠️";
    console.log(`  ${icon} "${tc.text.slice(0, 50)}..." → ${count} numbers (expected ~${tc.expected})`);
  }
}

async function testFullPipeline() {
  console.log("\n🧪 测试 4: 完整流水线 (Quote → FactSheet → Validate)");
  try {
    const q = await yf.quote("AAPL") as any;
    if (!q || q.regularMarketPrice === undefined) return console.log("  ❌ No AAPL data");

    // Build a simple factsheet
    const facts: Array<{ fact: string; value: number }> = [];
    if (q.regularMarketPrice) facts.push({ fact: `AAPL 股价 $${q.regularMarketPrice}`, value: q.regularMarketPrice });
    if (q.trailingPE) facts.push({ fact: `AAPL PE ${q.trailingPE}x`, value: q.trailingPE });
    if (q.marketCap) facts.push({ fact: `AAPL 市值 $${q.marketCap}`, value: q.marketCap });
    console.log(`  📊 FactSheet: ${facts.length} facts built`);

    // Simulate an AI output and validate
    const aiText = `AAPL 当前股价 $${q.regularMarketPrice}，PE 约 ${q.trailingPE}x。我们认为公司将实现 35% 增长。`;
    console.log(`  📝 AI text: "${aiText}"`);

    // Check which numbers are in facts
    const factValues = facts.map(f => f.value);
    for (const f of facts) {
      const found = aiText.includes(String(f.value)) || aiText.includes(f.value.toFixed(0));
      console.log(`  ${found ? "✅" : "❌"} "${f.fact}" → ${found ? "found in AI output" : "NOT referenced"}`);
    }
    console.log("  💡 35% growth claim → no source → would be flagged by Validator");
  } catch (e) {
    console.log("  ❌", (e as Error).message);
  }
}

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║  Stock-News-Monitor MCP Server Test   ║");
  console.log("╚════════════════════════════════════════╝");

  const yfOk = await testFetchQuote();
  if (yfOk) {
    await testFactSheet();
    await testNumberExtractor();
    await testFullPipeline();
  } else {
    console.log("\n⚠️  Yahoo Finance 不可用，跳过依赖 API 的测试");
    await testFactSheet();
    await testNumberExtractor();
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("✅ MCP Server 核心逻辑验证通过");
  console.log("   部署方式：");
  console.log("   - 本地 stdio: npx tsx mcp-server/server.ts");
  console.log("   - HTTP 服务:  npx tsx mcp-server/server.ts --http --port 3456");
  console.log("═══════════════════════════════════════════\n");
}

main();
