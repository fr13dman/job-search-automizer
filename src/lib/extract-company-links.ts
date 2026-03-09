import type { CompanyLink } from "@/types";

const JOB_BOARD_HOSTNAMES = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "greenhouse.io",
  "job-boards.greenhouse.io",
  "boards.greenhouse.io",
  "lever.co",
  "jobs.lever.co",
  "workday.com",
  "myworkdayjobs.com",
  "ashby.io",
  "jobs.ashbyhq.com",
  "bamboohr.com",
  "workable.com",
  "ziprecruiter.com",
  "monster.com",
  "dice.com",
];

function isJobBoard(hostname: string): boolean {
  return JOB_BOARD_HOSTNAMES.some((board) => hostname.endsWith(board));
}

/**
 * Regex-extract all http(s) URLs from raw text.
 * Returns unique URLs only.
 */
export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"',)}\]]+/g) ?? [];
  return [...new Set(matches)];
}

/**
 * Build deterministic links (zero tokens):
 * - Company homepage: strip sourceUrl to root domain, skip if it's a job board
 * - LinkedIn company page: constructed from company name slug
 */
export function buildDeterministicLinks(
  sourceUrl: string | undefined,
  companyName: string | undefined
): CompanyLink[] {
  const links: CompanyLink[] = [];

  if (sourceUrl) {
    try {
      const { protocol, hostname } = new URL(sourceUrl);
      if (!isJobBoard(hostname)) {
        links.push({
          label: "Company Website",
          url: `${protocol}//${hostname}`,
          sourced: "extracted",
        });
      }
    } catch {
      // ignore malformed URL
    }
  }

  if (companyName) {
    const slug = companyName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug) {
      links.push({
        label: "LinkedIn",
        url: `https://www.linkedin.com/company/${slug}`,
        sourced: "inferred",
      });
    }
  }

  return links;
}

/**
 * Convert a list of raw URLs (from regex extraction or LLM) into CompanyLinks,
 * deduplicating against an already-seen hostname set.
 * Filters out job boards and limits to `maxLinks` results.
 */
export function urlsToLinks(
  urls: string[],
  seenHostnames: Set<string>,
  sourced: "extracted" | "inferred",
  maxLinks = 3
): CompanyLink[] {
  const results: CompanyLink[] = [];

  for (const url of urls) {
    if (results.length >= maxLinks) break;
    try {
      const { hostname } = new URL(url);
      if (isJobBoard(hostname) || seenHostnames.has(hostname)) continue;
      seenHostnames.add(hostname);
      results.push({
        label: hostname.replace(/^www\./, ""),
        url,
        sourced,
      });
    } catch {
      // skip malformed URL
    }
  }

  return results;
}
