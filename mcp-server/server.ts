/**
 * Stock-News-Monitor MCP Server
 *
 * 把 FactLayer + Validator + Yahoo Finance 封装成标准 MCP Tools
 * 供 Coze / Claude Code / Cursor 调用
 *
 * 传输层：
 *   - stdio 模式：mcp-server 直接在本地运行（Claude Code/Cursor 可用）
 *   - HTTP 模式：Express + SSE（Coze 平台需要 HTTP 端点）
 *
 * 启动：
 *   stdio:  npx tsx mcp-server/server.ts
 *   HTTP:   npx tsx mcp-server/server.ts --http --port 3456
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import express from "express";

// ═══════════════════════════════════════════════════════════════
// Type definitions (inlined from core/ to keep server standalone)
// ═══════════════════════════════════════════════════════════════

type FactSource =
  | "SEC" | "Yahoo Finance" | "Reuters" | "Bloomberg"
  | "Company IR" | "Earnings Call" | "Benzinga" | "CNBC"
  | "Nasdaq" | "MarketBeat" | "TipRanks" | string;

type FactCategory =
  | "price" | "valuation" | "market_cap" | "revenue"
  | "earnings" | "growth_rate" | "capital_expense" | "free_cash_flow"
  | "debt" | "fundraising" | "backlog" | "customer"
  | "guidance" | "analyst_rating" | "cloud_metrics"
  | "competitor" | "market_event" | "sentiment" | "other";

interface FactItem {
  ticker: string;
  fact: string;
  value: number | string;
  category: FactCategory;
  source: FactSource;
  sourceUrl?: string;
  verifiedAt: string;
  notes?: string;
}

interface FactSheet {
  ticker: string;
  generatedAt: string;
  facts: FactItem[];
  coverage: Record<string, number>;
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

interface ValidationResult {
  valid: boolean;
  level: "valid" | "warning" | "reject";
  reason?: string;
  checks: ValidationCheck[];
  warnings: string[];
  factCoverage: {
    totalFacts: number;
    factsReferenced: number;
    coveragePct: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// FactLayer — 禁止 AI 来源，强制溯源
// ═══════════════════════════════════════════════════════════════

const BLOCKED_SOURCES = new Set([
  "ai", "deepseek", "chatgpt", "llm", "estimated",
  "推测", "估计", "合理估计", ""
]);

function createFact(params: {
  ticker: string; fact: string; value: number | string;
  category: FactCategory; source: FactSource;
  sourceUrl?: string; notes?: string;
}): FactItem {
  const sl = params.source.toLowerCase().trim();
  if (BLOCKED_SOURCES.has(sl)) {
    throw new Error(
      `[factLayer] REJECTED: source "${params.source}" is forbidden. ` +
      `AI/estimates are not allowed. Fact: "${params.fact}"`
    );
  }
  if (typeof params.value === "number" && isNaN(params.value)) {
    throw new Error(`[factLayer] REJECTED: NaN value. Fact: "${params.fact}"`);
  }
  return {
    ticker: params.ticker.toUpperCase(),
    fact: params.fact,
    value: params.value,
    category: params.category,
    source: params.source,
    sourceUrl: params.sourceUrl,
    verifiedAt: new Date().toISOString(),
    notes: params.notes,
  };
}

function createFactSheet(ticker: string, facts: FactItem[]): FactSheet {
  const coverage: Record<string, number> = {};
  for (const f of facts) { coverage[f.category] = (coverage[f.category] || 0) + 1; }
  return { ticker: ticker.toUpperCase(), generatedAt: new Date().toISOString(), facts, coverage };
}

// ═══════════════════════════════════════════════════════════════
// Yahoo Finance → FactSheet
// ═══════════════════════════════════════════════════════════════

function factSheetFromQuote(ticker: string, quote: Record<string, unknown>): FactSheet {
  const facts: FactItem[] = [];
  const t = ticker.toUpperCase();
  const src: FactSource = "Yahoo Finance";

  const price = quote.regularMarketPrice as number | undefined;
  if (price && price > 0) {
    facts.push(createFact({ ticker: t, fact: `${t} 最新股价: $${price.toFixed(2)}`, value: price, category: "price", source: src }));
  }
  const high = quote.fiftyTwoWeekHigh as number | undefined;
  const low = quote.fiftyTwoWeekLow as number | undefined;
  if (high && high > 0) {
    facts.push(createFact({ ticker: t, fact: `${t} 52周最高: $${high.toFixed(2)}`, value: high, category: "price", source: src, notes: low ? `52周最低: $${low.toFixed(2)}` : undefined }));
  }
  const tpe = quote.trailingPE as number | undefined;
  if (tpe && tpe > 0) {
    facts.push(createFact({ ticker: t, fact: `${t} 静态PE(TTM): ${tpe.toFixed(1)}x`, value: tpe, category: "valuation", source: src }));
  }
  const fpe = quote.forwardPE as number | undefined;
  if (fpe && fpe > 0) {
    facts.push(createFact({ ticker: t, fact: `${t} 远期PE: ${fpe.toFixed(1)}x`, value: fpe, category: "valuation", source: src }));
  }
  const cap = quote.marketCap as number | undefined;
  if (cap && cap > 0) {
    const capStr = cap > 1e12 ? `$${(cap / 1e12).toFixed(2)}T` : `$${(cap / 1e9).toFixed(1)}B`;
    facts.push(createFact({ ticker: t, fact: `${t} 市值: ${capStr}`, value: cap, category: "market_cap", source: src }));
  }
  return createFactSheet(t, facts);
}

// ═══════════════════════════════════════════════════════════════
// Validator — 数字溯源 + 财务声明校验 + 幻觉标记
// ═══════════════════════════════════════════════════════════════

const FINANCIAL_KW = [
  "营收","收入","利润","净利润","毛利","毛利率","净利率","EPS","每股收益",
  "现金流","自由现金流","FCF","资本开支","CapEx","负债","债务","杠杆",
  "增长率","增速","YoY","QoQ","市值","估值","PE","市盈率","PS","PB",
  "目标价","评级","增持","减持","买入","卖出","分红","回购","融资",
  "交付量","用户数","MAU","DAU",
  "revenue","earnings","profit","margin","free cash flow","debt",
  "growth rate","guidance","market cap","valuation","P/E","price target",
];

function extractNumbers(text: string): { value: number; context: string }[] {
  const results: { value: number; context: string }[] = [];
  const patterns = [
    /\$(\d+(?:\.\d+)?)\s*(?:万亿|[万亿]|[BMKbm]|亿|万)?/g,
    /(\d+(?:\.\d+)?)\s*(?:万亿|亿|万|[BMKbm]|%|％|倍|x)/g,
    /\b(\d{4,}(?:\.\d+)?)\b/g,
    /(\d+(?:\.\d+)?)\s*[%％]/g,
    /(?:PE|P\/E|市盈率)\s*[:：]?\s*(\d+(?:\.\d+)?)/gi,
  ];
  for (const p of patterns) {
    const regex = new RegExp(p.source, p.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const v = parseFloat(m[1]);
      if (!isNaN(v) && v > 0) {
        const start = Math.max(0, m.index - 15);
        const end = Math.min(text.length, m.index + m[0].length + 15);
        results.push({ value: v, context: text.slice(start, end).replace(/\n/g, " ").trim() });
      }
    }
  }
  const seen = new Set<string>();
  return results.filter(r => { const k = `${r.value}|${r.context.slice(0, 20)}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

function validateAgainstFacts(rawText: string, sheet: FactSheet): ValidationResult {
  const checks: ValidationCheck[] = [];
  const warnings: string[] = [];
  const numsFound = extractNumbers(rawText);
  const factNums = sheet.facts.filter(f => typeof f.value === "number").map(f => f.value as number);

  // Check 1: number-source cross-ref
  const unmatched = numsFound.filter(n => {
    return !factNums.some(fn => {
      if (fn === n.value) return true;
      if (n.value > 100 && Math.abs(fn - n.value) / fn < 0.01) return true;
      return [1, 10, 100, 1000, 0.1, 0.01].some(s => {
        const sc = n.value * s;
        return factNums.some(f2 => Math.abs(f2 - sc) / Math.max(f2, 1) < 0.02);
      });
    });
  });

  const hasFin = FINANCIAL_KW.some(kw => rawText.toLowerCase().includes(kw.toLowerCase()));
  if (unmatched.length > 0 && hasFin) {
    const suspicious = unmatched.filter(n => FINANCIAL_KW.some(kw => n.context.toLowerCase().includes(kw.toLowerCase())));
    if (suspicious.length > 0) {
      checks.push({ name: "数字溯源校验", passed: false, detail: `${suspicious.length} 个数字无法在事实库匹配: ${suspicious.map(n => n.context).join("; ")}` });
    } else {
      checks.push({ name: "数字溯源校验", passed: true, detail: `${unmatched.length} 个非财务数字放行` });
    }
  } else {
    checks.push({ name: "数字溯源校验", passed: true, detail: numsFound.length > 0 ? `${numsFound.length} 个数字均匹配` : "无数字内容" });
  }

  // Check 2: hallucination markers
  const hallucinationMarkers = [/预计将达到\s*[0-9.,]+/, /据内部人士透露/, /分析师普遍认为/];
  const hits = hallucinationMarkers.filter(m => m.test(rawText));
  checks.push({ name: "幻觉标记检测", passed: hits.length === 0, detail: hits.length > 0 ? `发现 ${hits.length} 个推断性表述` : "无幻觉标记" });

  // Check 3: fact coverage
  let refd = 0;
  for (const f of sheet.facts) {
    const terms = f.fact.replace(/[$%,.:()]/g, " ").split(/\s+/).filter(w => w.length > 3);
    if (terms.filter(t => rawText.toLowerCase().includes(t.toLowerCase())).length >= 2) refd++;
  }
  const pct = sheet.facts.length > 0 ? Math.round((refd / sheet.facts.length) * 100) : 0;
  checks.push({ name: "事实覆盖率", passed: sheet.facts.length === 0 || pct >= 30, detail: `${refd}/${sheet.facts.length} 条事实引用 (${pct}%)` });

  const critical = checks.filter(c => c.name === "数字溯源校验");
  const allCriticalOk = critical.every(c => c.passed);
  const allOk = checks.every(c => c.passed);

  let valid: boolean; let level: "valid" | "warning" | "reject";
  if (!allCriticalOk) { valid = false; level = "reject"; }
  else if (!allOk || warnings.length > 0) { valid = true; level = "warning"; }
  else { valid = true; level = "valid"; }

  return { valid, level, checks, warnings, factCoverage: { totalFacts: sheet.facts.length, factsReferenced: refd, coveragePct: pct }, reason: level === "reject" ? checks.filter(c => !c.passed).map(c => `${c.name}: ${c.detail}`).join(" | ") : undefined };
}

// ═══════════════════════════════════════════════════════════════
// Yahoo Finance API caller (uses yahoo-finance2 for auth/crumbs)
// ═══════════════════════════════════════════════════════════════

import YahooFinance from "yahoo-finance2";
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function fetchYahooQuote(symbol: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await yf.quote(symbol.toUpperCase());
    return result as unknown as Record<string, unknown>;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════
// MCP Server — Tool definitions
// ═══════════════════════════════════════════════════════════════

function buildServer(): McpServer {
  const server = new McpServer({
    name: "stock-news-monitor",
    version: "1.0.0",
    description: "AI 投研内容工厂 MCP — Yahoo Finance 数据 + FactLayer 事实校验 + Validator 数字溯源",
  });

  // ── Tool 1: get_stock_quote ──
  server.tool(
    "get_stock_quote",
    "获取美股实时行情（Yahoo Finance）。返回股价、PE、市值、52周高低等。",
    { symbol: z.string().describe("美股代码，如 AAPL, NVDA, MSFT, TSLA, META, GOOGL, AMZN") },
    async ({ symbol }) => {
      const quote = await fetchYahooQuote(symbol);
      if (!quote) return { content: [{ type: "text", text: JSON.stringify({ error: `无法获取 ${symbol.toUpperCase()} 数据`, _advice: "检查代码是否正确，或稍后重试" }, null, 2) }] };
      const sheet = factSheetFromQuote(symbol, quote);
      return { content: [{ type: "text", text: JSON.stringify({ symbol: symbol.toUpperCase(), quote_summary: { price: quote.regularMarketPrice, pe: quote.trailingPE, forwardPE: quote.forwardPE, marketCap: quote.marketCap, high52: quote.fiftyTwoWeekHigh, low52: quote.fiftyTwoWeekLow, volume: quote.regularMarketVolume, name: quote.shortName || quote.longName }, fact_sheet: { totalFacts: sheet.facts.length, categories: sheet.coverage, facts: sheet.facts.map(f => ({ fact: f.fact, source: f.source })) } }, null, 2) }] };
    }
  );

  // ── Tool 2: verify_fact ──
  server.tool(
    "verify_fact",
    `检验一条事实陈述是否合规。硬性规则：来源不能是 AI/DeepSeek/ChatGPT/推测/估计。通过的事实才能进入分析层。`,
    {
      ticker: z.string().describe("美股代码"),
      fact: z.string().describe("事实陈述，如 'NVDA Q4 收入 $35B'"),
      value: z.union([z.number(), z.string()]).describe("数值"),
      source: z.string().describe("数据来源，如 Yahoo Finance, SEC, Bloomberg, Reuters"),
      category: z.enum(["price","valuation","market_cap","revenue","earnings","growth_rate","capital_expense","free_cash_flow","debt","fundraising","backlog","guidance","analyst_rating","cloud_metrics","competitor","market_event","sentiment","other"]).describe("事实类别"),
    },
    async ({ ticker, fact, value, source, category }) => {
      try {
        const item = createFact({ ticker, fact, value, source, category });
        return { content: [{ type: "text", text: JSON.stringify({ passed: true, level: "valid", fact: { ticker: item.ticker, fact: item.fact, source: item.source, verifiedAt: item.verifiedAt } }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ passed: false, level: "reject", reason: (e as Error).message }, null, 2) }] };
      }
    }
  );

  // ── Tool 3: validate_ai_text ──
  server.tool(
    "validate_ai_text",
    `校验 AI 生成的文本是否编造了数字。用 FactSheet 做交叉验证，三档输出：valid/warning/reject。检测：数字溯源、财务声明支撑、幻觉标记。`,
    {
      text: z.string().describe("待校验的 AI 生成文本（任何语言）"),
      ticker: z.string().describe("对应的美股代码"),
    },
    async ({ text, ticker }) => {
      const quote = await fetchYahooQuote(ticker);
      if (!quote) return { content: [{ type: "text", text: JSON.stringify({ error: `无法获取 ${ticker} 数据，无法建立事实基准` }, null, 2) }] };
      const sheet = factSheetFromQuote(ticker, quote);
      const result = validateAgainstFacts(text, sheet);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── Tool 4: build_fact_sheet ──
  server.tool(
    "build_fact_sheet",
    `为一只股票构建完整的已验证 FactSheet。所有数据来自 Yahoo Finance API，标注来源。可直接喂给 AI 做分析。`,
    { symbol: z.string().describe("美股代码") },
    async ({ symbol }) => {
      const quote = await fetchYahooQuote(symbol);
      if (!quote) return { content: [{ type: "text", text: JSON.stringify({ error: `无法获取 ${symbol} 数据` }, null, 2) }] };
      const sheet = factSheetFromQuote(symbol, quote);
      return { content: [{ type: "text", text: JSON.stringify(sheet, null, 2) }] };
    }
  );

  // ── Tool 5: scan_for_fake_numbers ──
  server.tool(
    "scan_for_fake_numbers",
    "快速扫描一段文本中所有数字，标记哪些在事实库有支撑、哪些可能是编造的。",
    { text: z.string().describe("待扫描文本"), ticker: z.string().describe("美股代码") },
    async ({ text, ticker }) => {
      const quote = await fetchYahooQuote(ticker);
      const nums = extractNumbers(text);
      if (!quote) {
        return { content: [{ type: "text", text: JSON.stringify({ totalNumbers: nums.length, numbers: nums.map(n => ({ ...n, matched: false, status: "无法验证（数据源不可用）" })), advice: "Yahoo Finance 数据暂时不可用" }, null, 2) }] };
      }
      const sheet = factSheetFromQuote(ticker, quote);
      const factNums = sheet.facts.filter(f => typeof f.value === "number").map(f => f.value as number);
      const analyzed = nums.map(n => {
        const matched = factNums.some(fn => {
          if (fn === n.value) return true;
          if (n.value > 100 && Math.abs(fn - n.value) / fn < 0.01) return true;
          return [1, 10, 100, 1000, 0.1, 0.01].some(s => Math.abs((n.value * s) - fn) / Math.max(fn, 1) < 0.02);
        });
        return { ...n, matched, status: matched ? "✅ 有事实支撑" : "⚠️ 无法验证 — 可能编造" };
      });
      return { content: [{ type: "text", text: JSON.stringify({ totalNumbers: nums.length, unmatchedCount: analyzed.filter(a => !a.matched).length, numbers: analyzed, _reminder: "标记 ⚠️ 的数字需要人工审核" }, null, 2) }] };
    }
  );

  return server;
}

// ═══════════════════════════════════════════════════════════════
// Entry points
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const useHttp = args.includes("--http");
const port = parseInt(args[args.indexOf("--port") + 1] || "3456", 10);

async function main() {
  const mcpServer = buildServer();

  if (useHttp) {
    // HTTP+SSE 模式 — 供 Coze 等远程平台调用
    const app = express();
    app.use(express.json());

    // SSE endpoint — Coze connects here
    app.get("/sse", async (_req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      // Simple JSON-RPC over SSE bridge
      res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "server/ready", params: { name: "stock-news-monitor", version: "1.0.0", tools: ["get_stock_quote", "verify_fact", "validate_ai_text", "build_fact_sheet", "scan_for_fake_numbers"] } })}\n\n`);

      _req.on("close", () => { res.end(); });
    });

    // Direct JSON-RPC endpoint — simpler integration
    app.post("/rpc", async (req, res) => {
      const { method, params } = req.body;
      try {
        if (method === "tools/list") {
          // Return tool list
          res.json({ tools: ["get_stock_quote", "verify_fact", "validate_ai_text", "build_fact_sheet", "scan_for_fake_numbers"] });
        } else if (method === "tools/call") {
          // Handle tool call directly
          const { name, arguments: toolArgs } = params;
          // We'd need to call the tool handler — for now return a clear response
          res.json({ ok: true, tool: name, message: `Tool ${name} received. Deploy this server with full MCP transport for production use.` });
        } else {
          res.status(400).json({ error: `Unknown method: ${method}` });
        }
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // Health check
    app.get("/health", (_req, res) => { res.json({ status: "ok", service: "stock-news-monitor-mcp", version: "1.0.0" }); });

    app.listen(port, () => {
      console.log(`\n🔌 MCP Server (HTTP) running on http://localhost:${port}`);
      console.log(`   SSE endpoint: http://localhost:${port}/sse`);
      console.log(`   RPC endpoint: http://localhost:${port}/rpc`);
      console.log(`   Health:       http://localhost:${port}/health\n`);
    });
  } else {
    // Stdio 模式 — 供 Claude Code / Cursor 本地使用
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("✅ Stock News Monitor MCP Server (stdio) ready");
  }
}

main().catch(console.error);
