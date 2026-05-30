/* eslint-disable no-console */
const fs = require("fs-extra");
const path = require("path");

const TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META"];
const BASE_URL = process.env.LOCAL_BASE_URL || "http://localhost:3000";

const OUT_TXT = path.join(process.cwd(), "今日发帖文案.txt");

function pickSentimentStyle(sentiment) {
  const s = String(sentiment || "").toLowerCase();
  if (s.includes("利好") || s.includes("bull") || s.includes("positive")) {
    return { tag: "利好", emoji: "📈", theme: "good" };
  }
  if (s.includes("利空") || s.includes("bear") || s.includes("negative")) {
    return { tag: "利空", emoji: "📉", theme: "bad" };
  }
  return { tag: "中性", emoji: "🟨", theme: "neutral" };
}

async function fetchJson(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
}

function normalizeApiResponse(raw) {
  // 兼容：{ symbol, summary: { title, sentiment, points, risks, news, updatedAt } }
  const summary = raw?.summary ?? raw;

  const title = String(summary?.title || `${raw?.symbol || ""} 今日投研速览`).trim();
  const sentiment = String(summary?.sentiment || "中性").trim();

  const points = Array.isArray(summary?.points)
    ? summary.points.map(String).filter(Boolean)
    : [];

  const risks = Array.isArray(summary?.risks)
    ? summary.risks.map(String).filter(Boolean)
    : [];

  const updatedAt = summary?.updatedAt ? String(summary.updatedAt) : undefined;

  return { title, sentiment, points, risks, updatedAt };
}

function clampShort(s, max = 28) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function buildViralPost({ ticker, title, sentiment, points, risks, updatedAt }) {
  const st = pickSentimentStyle(sentiment);

  const hookMap = {
    good: `⚡${ticker} 这波可能不是"反弹"，更像新一轮启动信号？`,
    bad: `⚠️${ticker} 别急着抄底…这条新闻可能是短线拐点。`,
    neutral: `🧩${ticker} 现在最像"分岔路口"：看懂这3点才敢下手。`,
  };
  const hook = hookMap[st.theme] || `📌${ticker} 今天的关键变化：`;

  const conclusionMap = {
    good: `结论：偏【利好】📈，但要盯住"兑现压力"。`,
    bad: `结论：偏【利空】📉，短线优先"防回撤"。`,
    neutral: `结论：【中性】🟨，关键看下一条催化能否确认方向。`,
  };
  const conclusion = conclusionMap[st.theme] || `结论：${st.tag}`;

  const proof = (points || []).slice(0, 5).map((p) => clampShort(p, 34));
  const proofText = proof.length
    ? proof.map((p, i) => ["①", "②", "③", "④", "⑤"][i] + ` ${p}`).join("\n")
    : `① 主线叙事正在形成（资金重新定价）\n② 关键催化临近（财报/指引/产品）\n③ 关注量能与情绪是否延续`;

  const riskList = (risks || []).slice(0, 3).map((r) => clampShort(r, 36));
  const riskText = riskList.length
    ? riskList.map((r) => `- ${r}`).join("\n")
    : `- 利好可能被"获利了结"吞掉，波动会放大\n- 宏观/利率/监管任一变化都可能改叙事`;

  const actionMap = {
    good: `✅ 操作：不追高，等回踩确认；分批更稳。\n✅ 观察：量能是否放大 & 新闻是否持续发酵。`,
    bad: `✅ 操作：先减仓/控仓，等"坏消息出尽"再考虑。\n✅ 观察：是否出现止跌结构 & 风险偏好回暖。`,
    neutral: `✅ 操作：轻仓观望或网格；等突破/跌破再加码。\n✅ 观察：下一条催化是否确认方向。`,
  };
  const action = actionMap[st.theme];

  const timeLine = updatedAt ? `⏱ 生成时间：${updatedAt}` : "";

  return `${hook}

【${ticker}】${st.emoji} 情绪：${st.tag}
《${title}》
${conclusion}

📌 今天最重要的 3-5 条证据：
${proofText}

⚠️ 但我更担心的风险：
${riskText}

${action}
${timeLine}

👇 你觉得 ${ticker} 接下来是"继续上"还是"要回调"？评论区说下你的仓位打法
#美股 #AI投研 #${ticker} #美股新闻解读
`;
}

(async function main() {
  const { default: pLimit } = await import("p-limit");
  const limit = pLimit(3);
  const blocks = [];

  const tasks = TICKERS.map((ticker) =>
    limit(async () => {
      const url = `${BASE_URL}/api/stocks/${ticker}/summary`;
      try {
        console.log("Fetching:", url);
        const raw = await fetchJson(url);
        const norm = normalizeApiResponse(raw);

        const text = buildViralPost({
          ticker,
          title: norm.title,
          sentiment: norm.sentiment,
          points: norm.points,
          risks: norm.risks,
          updatedAt: norm.updatedAt,
        });

        blocks.push(text);
        console.log(`✅ ${ticker} ok`);
      } catch (e) {
        console.error(`❌ ${ticker} failed:`, e?.message || e);
        blocks.push(
          `【${ticker}】❌ 拉取失败：${e?.message || e}\n（请检查本地服务是否运行 / 接口是否 200）\n`
        );
      }
    })
  );

  await Promise.all(tasks);

  await fs.writeFile(OUT_TXT, blocks.join("\n--------------------------------\n\n"), "utf8");
  console.log("✅ 文案已生成：", OUT_TXT);
})().catch((err) => {
  console.error("❌ 生成失败：", err);
  process.exit(1);
});
