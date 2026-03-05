import * as cheerio from "cheerio";
import type { ScrapeResult } from "@/types";

const MAX_LENGTH = 10_000;
const STRIP_TAGS = ["script", "style", "nav", "footer", "header", "noscript", "svg", "img"];

export function extractJobDescription(html: string): ScrapeResult {
  if (!html || !html.trim()) {
    return { success: false, error: "Empty or invalid HTML" };
  }

  const $ = cheerio.load(html);

  // Extract JSON-LD JobPosting description before stripping script tags.
  // Handles JS-rendered SPAs (e.g. Workday) where <body> is empty but the
  // full job description is embedded in structured data.
  let jsonLdText = "";
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLdText) return;
    try {
      const data = JSON.parse($(el).text()) as Record<string, unknown>;
      const items: Record<string, unknown>[] = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item?.["@type"] === "JobPosting" && typeof item.description === "string") {
          jsonLdText = item.description;
          break;
        }
      }
    } catch {
      // ignore JSON parse errors
    }
  });

  // Meta description as a secondary fallback (also populated on Workday pages).
  const metaDesc =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";

  for (const tag of STRIP_TAGS) {
    $(tag).remove();
  }

  let bodyText = "";
  const main = $("main").text().trim();
  if (main) {
    bodyText = main;
  } else {
    const article = $("article").text().trim();
    if (article) {
      bodyText = article;
    } else {
      bodyText = $("body").text().trim();
    }
  }

  // Pick the longest non-empty source. Body text wins for well-structured pages;
  // JSON-LD wins when the body is empty (JS-rendered SPAs).
  const candidates = [jsonLdText, metaDesc, bodyText].filter((s) => s.trim().length > 0);
  if (!candidates.length) {
    return { success: false, error: "No text content found" };
  }

  let text = candidates.reduce((a, b) => (a.length >= b.length ? a : b));

  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Truncate
  if (text.length > MAX_LENGTH) {
    text = text.slice(0, MAX_LENGTH);
  }

  return { success: true, jobDescription: text };
}

export async function scrapeJobUrl(url: string): Promise<ScrapeResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CoverLetterBot/1.0)",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `Failed to fetch URL: ${response.status}` };
    }

    const html = await response.text();
    return extractJobDescription(html);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to fetch URL: ${message}` };
  }
}
