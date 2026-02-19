import * as cheerio from "cheerio";
import type { ScrapeResult } from "@/types";

const MAX_LENGTH = 10_000;
const STRIP_TAGS = ["script", "style", "nav", "footer", "header", "noscript", "svg", "img"];

export function extractJobDescription(html: string): ScrapeResult {
  if (!html || !html.trim()) {
    return { success: false, error: "Empty or invalid HTML" };
  }

  const $ = cheerio.load(html);

  for (const tag of STRIP_TAGS) {
    $(tag).remove();
  }

  let text = "";

  const main = $("main").text().trim();
  if (main) {
    text = main;
  } else {
    const article = $("article").text().trim();
    if (article) {
      text = article;
    } else {
      text = $("body").text().trim();
    }
  }

  if (!text) {
    return { success: false, error: "No text content found" };
  }

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
