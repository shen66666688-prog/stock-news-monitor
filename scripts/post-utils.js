/**
 * Shared utilities for social-media post generation.
 * Used by both text and HTML poster generators.
 */

function escapeHtml(str) {
  const s = String(str ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

function clampShort(s, max = 28) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function formatDateStr(updatedAt) {
  if (!updatedAt) return new Date().toISOString().slice(0, 10);
  try {
    return new Date(updatedAt).toISOString().slice(0, 10);
  } catch {
    return String(updatedAt);
  }
}

/** Normalize the API response (compatible with both {summary:...} and raw summary shapes). */
function normalizeApiResponse(raw) {
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

module.exports = {
  escapeHtml,
  pickSentimentStyle,
  clampShort,
  formatDateStr,
  normalizeApiResponse,
};
