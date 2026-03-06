import * as cheerio from "cheerio";
import type { ScrapeResult } from "@/types";

const MAX_LENGTH = 10_000;
const STRIP_TAGS = ["script", "style", "nav", "footer", "header", "noscript", "svg", "img"];

// ---------------------------------------------------------------------------
// Greenhouse API integration
// Handles custom-domain embeds (?gh_jid=) and direct Greenhouse board URLs.
// ---------------------------------------------------------------------------

interface GreenhouseJob {
  title?: string;
  company_name?: string;
  location?: { name?: string };
  content?: string;
}

function decodeGreenhouseContent(raw: string): string {
  // The `content` field is HTML-entity-encoded HTML; decode then strip tags.
  return raw
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/<[^>]+>/g, " ");
}

async function tryGreenhouseApi(url: string): Promise<ScrapeResult | null> {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    let boardToken: string | null = null;
    let jobId: string | null = null;

    // Direct Greenhouse-hosted boards: boards.greenhouse.io/BOARD/jobs/ID
    if (hostname === "boards.greenhouse.io" || hostname === "job-boards.greenhouse.io") {
      const match = parsed.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
      if (match) {
        boardToken = match[1];
        jobId = match[2];
      }
    }

    // Custom-domain embed with ?gh_jid=ID (e.g. fivetran.com/careers/job?gh_jid=123)
    const ghJid = parsed.searchParams.get("gh_jid");
    if (ghJid && !jobId) {
      jobId = ghJid;
      // Derive board token from SLD: "www.fivetran.com" → "fivetran"
      boardToken = hostname.replace(/^www\./, "").split(".")[0];
    }

    if (!boardToken || !jobId) return null;

    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as GreenhouseJob;
    if (!data.content) return null;

    // Collapse only the body; keep the header lines separate so extraction
    // patterns that rely on \n boundaries (e.g. [^\n,|·•]+) work correctly.
    const body = decodeGreenhouseContent(data.content).replace(/\s+/g, " ").trim();
    const header = [
      data.title && `Job Title: ${data.title}`,
      data.company_name && `Company: ${data.company_name.trim()}`,
      data.location?.name && `Location: ${data.location.name}`,
    ]
      .filter(Boolean)
      .join("\n");

    let text = header ? `${header}\n\n${body}` : body;
    if (text.length > MAX_LENGTH) text = text.slice(0, MAX_LENGTH);

    return { success: true, jobDescription: text };
  } catch {
    return null;
  }
}

export function extractJobDescription(html: string): ScrapeResult {
  if (!html || !html.trim()) {
    return { success: false, error: "Empty or invalid HTML" };
  }

  const $ = cheerio.load(html);

  // Extract JSON-LD JobPosting description AND structured metadata before stripping script tags.
  // Handles JS-rendered SPAs (e.g. Workday) where <body> is empty but the
  // full job description is embedded in structured data.
  let jsonLdText = "";
  let structuredTitle = "";
  let structuredCompany = "";
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLdText && structuredTitle && structuredCompany) return;
    try {
      const data = JSON.parse($(el).text()) as Record<string, unknown>;
      const items: Record<string, unknown>[] = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item?.["@type"] === "JobPosting") {
          if (typeof item.description === "string" && !jsonLdText) jsonLdText = item.description;
          if (typeof item.title === "string" && !structuredTitle) structuredTitle = item.title.trim();
          const org = item.hiringOrganization as Record<string, unknown> | undefined;
          if (org && typeof org.name === "string" && !structuredCompany) structuredCompany = org.name.trim();
          break;
        }
      }
    } catch {
      // ignore JSON parse errors
    }
  });

  // og:title fallback: "Title at Company" or "Title - Company - Location | Site"
  if (!structuredTitle) {
    const ogTitle = ($('meta[property="og:title"]').attr("content") || "").trim();
    if (ogTitle) {
      const atMatch = ogTitle.match(/^(.+?)\s+at\s+([^|–—-].+?)(?:\s*[|–—].*)?$/i);
      if (atMatch) {
        structuredTitle = atMatch[1].trim();
        if (!structuredCompany) structuredCompany = atMatch[2].trim();
      } else {
        const sepMatch = ogTitle.match(/^([^|–—-]+?)\s*[|–—-]+\s*([^|–—-]+)/);
        if (sepMatch) {
          structuredTitle = sepMatch[1].trim();
          // Only use second segment as company if it doesn't look like a location (City, ST or Remote)
          if (!structuredCompany) {
            const candidate = sepMatch[2].trim();
            if (!/\b[A-Z]{2}\b/.test(candidate) && !/^remote$/i.test(candidate)) {
              structuredCompany = candidate;
            }
          }
        } else if (ogTitle.length < 80) {
          structuredTitle = ogTitle;
        }
      }
    }
  }

  // og:site_name for company — filter out generic job board names
  if (!structuredCompany) {
    const siteName = ($('meta[property="og:site_name"]').attr("content") || "").trim();
    if (siteName && !/^(linkedin|indeed|glassdoor|ziprecruiter|monster|dice|lever|ashby|workday|workable|bamboohr|greenhouse)/i.test(siteName)) {
      structuredCompany = siteName;
    }
  }

  // Meta description as a secondary fallback (also populated on Workday pages).
  const metaDesc =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";

  // h1 as title fallback
  if (!structuredTitle) {
    const h1 = $("h1").first().text().trim().replace(/\s+/g, " ");
    if (h1 && h1.length >= 3 && h1.length < 80) structuredTitle = h1;
  }

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

  // Prepend structured metadata header (same format as Greenhouse API) so that
  // extractJobTitle / extractCompanyName patterns fire reliably for all pages.
  if (structuredTitle || structuredCompany) {
    const headerLines = [
      structuredTitle && `Job Title: ${structuredTitle}`,
      structuredCompany && `Company: ${structuredCompany}`,
    ].filter(Boolean);
    text = headerLines.join("\n") + "\n\n" + text;
  }

  return { success: true, jobDescription: text };
}

export async function scrapeJobUrl(url: string): Promise<ScrapeResult> {
  try {
    // Try Greenhouse API first for ?gh_jid= embeds and boards.greenhouse.io URLs
    const greenhouse = await tryGreenhouseApi(url);
    if (greenhouse) return greenhouse;

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
