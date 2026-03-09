import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { buildDeterministicLinks, urlsToLinks } from "@/lib/extract-company-links";

const MAX_JINA_LENGTH = 8_000;
const MAX_TAVILY_SNIPPET_LENGTH = 8_000;

const DeepInfoSchema = z.object({
  keyFacts: z
    .array(z.string())
    .describe(
      "Concrete facts about the company: founding year, employee count, funding stage/amount, HQ location, notable customers or partners. Max 6 items. Empty array if not found."
    ),
  productsServices: z
    .array(z.string())
    .describe(
      "Main products, services, or solutions the company offers. Each item is a short description of a distinct product or service line. Max 5 items. Empty array if not found."
    ),
  techStack: z
    .array(z.string())
    .describe(
      "Technologies, programming languages, frameworks, or cloud platforms the company uses or builds. Max 8 items. Empty array if not found."
    ),
  workEnvironment: z
    .array(z.string())
    .describe(
      "Work environment details: remote/hybrid/onsite policy, notable perks, benefits, or culture notes explicitly mentioned. Max 4 items. Empty array if not found."
    ),
  interviewInsights: z
    .array(z.string())
    .describe(
      "Interview process details, hiring criteria, or what the company looks for in candidates. Only include if explicitly stated. Max 4 items. Empty array if not found."
    ),
  recentHighlights: z
    .array(z.string())
    .describe(
      "Recent company news, product launches, awards, fundraising rounds, or milestones. Max 5 items. Empty array if not found."
    ),
  competitors: z
    .array(z.string())
    .describe(
      "Main competitors or comparable companies in the same market space. Max 4 items. Empty array if not found."
    ),
  additionalLinks: z
    .array(
      z.object({
        label: z.string().describe("Short human-readable label"),
        url: z.string().describe("Full URL verbatim from the source text"),
      })
    )
    .describe(
      "Additional relevant URLs found in the scraped content (engineering blog, press page, docs, product). Do not invent URLs. Max 3 items."
    ),
});

async function fetchJinaPage(url: string, label: string): Promise<string | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const headers: Record<string, string> = { Accept: "text/plain" };
    if (process.env.JINA_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
    }
    const res = await fetch(jinaUrl, { headers, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      console.warn(`[/api/company-info-deep] Jina ${label} failed: ${res.status}`);
      return null;
    }
    const text = await res.text();
    return text.slice(0, MAX_JINA_LENGTH);
  } catch (err) {
    console.warn(`[/api/company-info-deep] Jina ${label} error:`, err);
    return null;
  }
}

async function runTavilySearch(
  query: string,
  apiKey: string,
  maxResults = 5
): Promise<string | null> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "advanced",
        max_results: maxResults,
        include_answer: true,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[/api/company-info-deep] Tavily query "${query}" failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const parts: string[] = [];
    if (data.answer) parts.push(`Summary: ${data.answer}`);
    if (Array.isArray(data.results)) {
      for (const r of data.results) {
        if (r.content) parts.push(`[${r.title ?? ""}] ${r.content}`);
      }
    }
    return parts.join("\n\n") || null;
  } catch (err) {
    console.warn(`[/api/company-info-deep] Tavily query "${query}" error:`, err);
    return null;
  }
}

async function fetchTavilyContent(companyName: string): Promise<string | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.log("[/api/company-info-deep] TAVILY_API_KEY not set, skipping");
    return null;
  }

  // Run three targeted searches in parallel
  const [overviewResult, cultureResult, newsResult] = await Promise.all([
    runTavilySearch(`${companyName} company products services what they do overview`, apiKey, 5),
    runTavilySearch(`${companyName} company culture interview process remote work benefits`, apiKey, 4),
    runTavilySearch(`${companyName} news funding milestones 2024 2025`, apiKey, 4),
  ]);

  const combined = [overviewResult, cultureResult, newsResult]
    .filter(Boolean)
    .join("\n\n---\n\n");

  if (!combined) return null;
  return combined.slice(0, MAX_TAVILY_SNIPPET_LENGTH);
}

export async function POST(request: NextRequest) {
  try {
    const { companyName, sourceUrl, existingDescription } = await request.json();

    if (!companyName) {
      return NextResponse.json({ error: "companyName is required" }, { status: 400 });
    }

    console.log("[/api/company-info-deep] Received request", { companyName, hasSourceUrl: !!sourceUrl });

    // Derive homepage URL (same logic as buildDeterministicLinks)
    const deterministicLinks = buildDeterministicLinks(sourceUrl, companyName);
    const homepageLink = deterministicLinks.find((l) => l.label === "Company Website");
    const homepageUrl = homepageLink?.url;

    // Run Jina (homepage + about page) and Tavily (3 searches) in parallel
    const aboutUrl = homepageUrl ? `${homepageUrl.replace(/\/$/, "")}/about` : null;
    const [jinaHomepage, jinaAbout, tavilyContent] = await Promise.all([
      homepageUrl ? fetchJinaPage(homepageUrl, "homepage") : Promise.resolve(null),
      aboutUrl ? fetchJinaPage(aboutUrl, "about") : Promise.resolve(null),
      fetchTavilyContent(companyName),
    ]);

    const jinaContent = [jinaHomepage, jinaAbout].filter(Boolean).join("\n\n---\n\n") || null;

    console.log("[/api/company-info-deep] Fetch results", {
      jinaHomepageLength: jinaHomepage?.length ?? 0,
      jinaAboutLength: jinaAbout?.length ?? 0,
      tavilyLength: tavilyContent?.length ?? 0,
    });

    if (!jinaContent && !tavilyContent) {
      return NextResponse.json(
        { error: "Could not retrieve additional company information from external sources." },
        { status: 502 }
      );
    }

    // Build combined context for Haiku
    const contextParts: string[] = [];
    if (existingDescription) {
      contextParts.push(`Already known about this company:\n${existingDescription}`);
    }
    if (jinaContent) {
      contextParts.push(`--- Company website content ---\n${jinaContent}`);
    }
    if (tavilyContent) {
      contextParts.push(`--- Web search results ---\n${tavilyContent}`);
    }
    const context = contextParts.join("\n\n");

    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: DeepInfoSchema,
      system:
        "You extract structured company intelligence from web content. Only return information that is explicitly stated in the provided sources. Never invent facts, funding amounts, or URLs.",
      prompt: `Company: ${companyName}\n\n${context}`,
    });

    // Deduplicate additionalLinks against the homepage we already show
    const seenHostnames = new Set<string>();
    if (homepageUrl) {
      try { seenHostnames.add(new URL(homepageUrl).hostname); } catch { /* ignore */ }
    }
    const deepLinks = urlsToLinks(
      object.additionalLinks.map((l) => l.url),
      seenHostnames,
      "extracted",
      3
    );
    const deepLinksLabelled = deepLinks.map((link) => {
      const match = object.additionalLinks.find((l) => l.url === link.url);
      return match ? { ...link, label: match.label } : link;
    });

    console.log("[/api/company-info-deep] Done", {
      keyFactsCount: object.keyFacts.length,
      productsServicesCount: object.productsServices.length,
      techStackCount: object.techStack.length,
      workEnvironmentCount: object.workEnvironment.length,
      interviewInsightsCount: object.interviewInsights.length,
      highlightsCount: object.recentHighlights.length,
      competitorsCount: object.competitors.length,
      linksCount: deepLinksLabelled.length,
    });

    return NextResponse.json({
      keyFacts: object.keyFacts,
      productsServices: object.productsServices,
      techStack: object.techStack,
      workEnvironment: object.workEnvironment,
      interviewInsights: object.interviewInsights,
      recentHighlights: object.recentHighlights,
      competitors: object.competitors,
      additionalLinks: deepLinksLabelled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[/api/company-info-deep] Error:", error);
    return NextResponse.json(
      { error: message || "Failed to fetch deep company info" },
      { status: 500 }
    );
  }
}
