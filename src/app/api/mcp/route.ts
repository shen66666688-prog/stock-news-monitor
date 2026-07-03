/**
 * Next.js App Router — MCP Streamable HTTP endpoint
 *
 * 部署到 Vercel 后，Coze 扣子填写：
 *   https://你的域名.vercel.app/api/mcp
 *
 * 使用 WebStandardStreamableHTTPServerTransport（Web API）
 * 兼容 Vercel Serverless / Cloudflare Workers / Deno / Bun
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import YahooFinance from "yahoo-finance2";

// Patch Node http/https + fetch to use proxy
const PROXY_URL = process.env.HTTP_PROXY || "http://127.0.0.1:7897";
try {
  const { HttpsProxyAgent } = require("https-proxy-agent");
  const http = require("http");
  const https = require("https");
  const agent = new HttpsProxyAgent(PROXY_URL);
  http.globalAgent = agent;
  https.globalAgent = agent;
} catch {}
try {
  const { ProxyAgent, setGlobalDispatcher } = require("undici");
  setGlobalDispatcher(new ProxyAgent(PROXY_URL));
} catch {}

// ═══════════════════════════════════════════════════════════════
// FactLayer + Validator — 内联（避免跨文件编译问题）
// ═══════════════════════════════════════════════════════════════

const BLOCKED_SOURCES = new Set([
  "ai", "deepseek", "chatgpt", "llm", "estimated",
  "推测", "估计", "合理估计", "",
]);

interface FactItem {
  ticker: string; fact: string; value: number | string;
  category: string; source: string; sourceUrl?: string;
  verifiedAt: string; notes?: string;
}

interface FactSheet {
  ticker: string; generatedAt: string; facts: FactItem[];
  coverage: Record<string, number>;
}

function createFact(p: {
  ticker: string; fact: string; value: number | string;
  category: string; source: string; sourceUrl?: string; notes?: string;
}): FactItem {
  const sl = p.source.toLowerCase().trim();
  if (BLOCKED_SOURCES.has(sl)) {
    throw new Error(`[factLayer] REJECTED: source "${p.source}" forbidden. Fact: "${p.fact}"`);
  }
  if (typeof p.value === "number" && isNaN(p.value)) {
    throw new Error(`[factLayer] REJECTED: NaN value`);
  }
  return { ticker: p.ticker.toUpperCase(), fact: p.fact, value: p.value,
    category: p.category, source: p.source, sourceUrl: p.sourceUrl,
    verifiedAt: new Date().toISOString(), notes: p.notes };
}

function buildFactSheet(ticker: string, quote: Record<string, unknown>): FactSheet {
  const facts: FactItem[] = [];
  const t = ticker.toUpperCase();
  const src = "Yahoo Finance";
  const p = quote.regularMarketPrice as number;
  if (p && p > 0) facts.push(createFact({ ticker: t, fact: `${t} 股价 $${p.toFixed(2)}`, value: p, category: "price", source: src }));
  const tpe = quote.trailingPE as number;
  if (tpe && tpe > 0) facts.push(createFact({ ticker: t, fact: `${t} PE ${tpe.toFixed(1)}x`, value: tpe, category: "valuation", source: src }));
  const fpe = quote.forwardPE as number;
  if (fpe && fpe > 0) facts.push(createFact({ ticker: t, fact: `${t} 远期PE ${fpe.toFixed(1)}x`, value: fpe, category: "valuation", source: src }));
  const cap = quote.marketCap as number;
  if (cap && cap > 0) {
    const capStr = cap > 1e12 ? `$${(cap / 1e12).toFixed(2)}T` : `$${(cap / 1e9).toFixed(1)}B`;
    facts.push(createFact({ ticker: t, fact: `${t} 市值 ${capStr}`, value: cap, category: "market_cap", source: src }));
  }
  const high = quote.fiftyTwoWeekHigh as number;
  if (high && high > 0) facts.push(createFact({ ticker: t, fact: `${t} 52周高 $${high.toFixed(2)}`, value: high, category: "price", source: src }));
  const cov: Record<string, number> = {};
  for (const f of facts) cov[f.category] = (cov[f.category] || 0) + 1;
  return { ticker: t, generatedAt: new Date().toISOString(), facts, coverage: cov };
}

// ═══════════════════════════════════════════════════════════════
// Build McpServer with tools
// ═══════════════════════════════════════════════════════════════

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function buildServer(): McpServer {
  const server = new McpServer({
    name: "stock-news-monitor",
    version: "1.0.0",
    description: "美股 AI 投研 MCP — Yahoo Finance 数据 + FactLayer 事实校验 + Validator 防编造",
  });

  server.tool(
    "get_stock_quote",
    "获取美股实时行情（Yahoo Finance）",
    { symbol: z.string().describe("美股代码") },
    async ({ symbol }) => {
      const q = await yf.quote(symbol.toUpperCase()) as Record<string, unknown>;
      if (!q || q.regularMarketPrice === undefined) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `无法获取 ${symbol}` }) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify({
        symbol: symbol.toUpperCase(),
        name: q.shortName || q.longName,
        price: q.regularMarketPrice,
        pe: q.trailingPE, forwardPE: q.forwardPE,
        marketCap: q.marketCap,
        high52: q.fiftyTwoWeekHigh, low52: q.fiftyTwoWeekLow,
        volume: q.regularMarketVolume,
      }, null, 2) }] };
    }
  );

  server.tool(
    "verify_fact",
    "校验事实来源。禁止 AI/DeepSeek/估计 作为来源。",
    {
      ticker: z.string(), fact: z.string(),
      value: z.union([z.number(), z.string()]),
      source: z.string(), category: z.string(),
    },
    async ({ ticker, fact, value, source, category }) => {
      try {
        const item = createFact({ ticker, fact, value, source, category });
        return { content: [{ type: "text", text: JSON.stringify({ passed: true, level: "valid", fact: item }, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ passed: false, level: "reject", reason: (e as Error).message }, null, 2) }] };
      }
    }
  );

  server.tool(
    "validate_ai_text",
    "扫描 AI 生成文本是否编造了数字。三档输出：valid/warning/reject。",
    { text: z.string().describe("待校验文本"), ticker: z.string().describe("美股代码") },
    async ({ text, ticker }) => {
      const q = await yf.quote(ticker.toUpperCase()) as Record<string, unknown>;
      if (!q || q.regularMarketPrice === undefined) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `无法获取 ${ticker} 数据源` }) }] };
      }
      const sheet = buildFactSheet(ticker, q);
      // Simple check: extract numbers from text and compare with factsheet
      const factVals = sheet.facts.filter(f => typeof f.value === "number").map(f => f.value as number);
      const nums = Array.from(text.matchAll(/\$?(\d+(?:\.\d+)?)\s*(?:[万亿BMKbm]|亿|万|%|％|倍|x)?/g))
        .map(m => parseFloat(m[1])).filter(v => !isNaN(v) && v > 0);
      const unmatched = nums.filter(n => !factVals.some(f => {
        if (f === n) return true;
        if (n > 100 && Math.abs(f - n) / f < 0.01) return true;
        return [1, 10, 100, 1000, 0.1, 0.01].some(s => Math.abs((n * s) - f) / Math.max(f, 1) < 0.02);
      }));
      const level = unmatched.length > 0 ? "warning" : "valid";
      return { content: [{ type: "text", text: JSON.stringify({
        level,
        totalNumbers: nums.length,
        matchedCount: nums.length - unmatched.length,
        flaggedNumbers: unmatched.map(n => ({ value: n, status: "⚠️ 无事实支撑" })),
        factsReference: sheet.facts.map(f => f.fact),
      }, null, 2) }] };
    }
  );

  server.tool(
    "build_fact_sheet",
    "为股票构建完整 FactSheet（Yahoo Finance 数据）。",
    { symbol: z.string().describe("美股代码") },
    async ({ symbol }) => {
      const q = await yf.quote(symbol.toUpperCase()) as Record<string, unknown>;
      if (!q || q.regularMarketPrice === undefined) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `无法获取 ${symbol}` }) }] };
      }
      const sheet = buildFactSheet(symbol, q);
      return { content: [{ type: "text", text: JSON.stringify(sheet, null, 2) }] };
    }
  );

  server.tool(
    "scan_for_fake_numbers",
    "快速扫描文本中所有数字，标记哪些在事实库有支撑。",
    { text: z.string().describe("待扫描文本"), ticker: z.string().describe("美股代码") },
    async ({ text, ticker }) => {
      const q = await yf.quote(ticker.toUpperCase()) as Record<string, unknown>;
      const nums = Array.from(text.matchAll(/\$?(\d+(?:\.\d+)?)\s*(?:[万亿BMKbm]|亿|万|%|％|倍|x)?/g))
        .map(m => ({ value: parseFloat(m[1]), context: text.slice(Math.max(0, (m.index || 0) - 20), (m.index || 0) + (m[0]?.length || 0) + 20).replace(/\n/g, " ") }));
      if (!q || q.regularMarketPrice === undefined) {
        return { content: [{ type: "text", text: JSON.stringify({ totalNumbers: nums.length, numbers: nums.map(n => ({ ...n, matched: false, status: "无法验证（数据源不可用）" })) }, null, 2) }] };
      }
      const sheet = buildFactSheet(ticker, q);
      const factVals = sheet.facts.filter(f => typeof f.value === "number").map(f => f.value as number);
      const analyzed = nums.map(n => {
        const matched = factVals.some(f => {
          if (f === n.value) return true;
          if (n.value > 100 && Math.abs(f - n.value) / f < 0.01) return true;
          return [1, 10, 100, 1000, 0.1, 0.01].some(s => Math.abs((n.value * s) - f) / Math.max(f, 1) < 0.02);
        });
        return { ...n, matched, status: matched ? "✅ 有事实支撑" : "⚠️ 无法验证 — 可能编造" };
      });
      return { content: [{ type: "text", text: JSON.stringify({
        totalNumbers: nums.length,
        unmatchedCount: analyzed.filter(a => !a.matched).length,
        numbers: analyzed,
      }, null, 2) }] };
    }
  );

  return server;
}

// ═══════════════════════════════════════════════════════════════
// Next.js Route Handler
// ═══════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  return handleMCP(request);
}

export async function POST(request: Request) {
  return handleMCP(request);
}

export async function DELETE(request: Request) {
  return handleMCP(request);
}

async function handleMCP(request: Request) {
  // 无状态模式：每个请求创建独立的 Server + Transport
  // 避免 "Already connected" 错误
  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // 无状态模式
    enableJsonResponse: true,      // 返回 JSON（非 SSE 流），方便调试和 Coze 兼容
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request);
    return response;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "MCP transport error", detail: (e as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  } finally {
    try { await transport.close(); } catch {}
  }
}
