import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { buildDeterministicLinks, urlsToLinks } from "@/lib/extract-company-links";

const MAX_JINA_LENGTH = 6_000;
const MAX_TAVILY_SNIPPET_LENGTH = 3_000;

const DeepInfoSchema = z.object({
  keyFacts: z
    .array(z.string())
    .describe(
      "Concrete facts about the company: founding year, employee count, funding stage/amount, HQ location, notable customers or partners. Max 6 items. Empty array if not found."
    ),
  techStack: z
    .array(z.string())
    .describe(
      "Technologies, programming languages, frameworks, or cloud platforms the company uses or builds. Max 8 items. Empty array if not found."
    ),
  recentHighlights: z
    .array(z.string())
    .describe(
      "Recent company news, product launches, awards, fundraising rounds, or milestones. Max 5 items. Empty array if not found."
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

async function fetchJinaContent(homepageUrl: string): Promise<string | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${homepageUrl}`;
    const headers: Record<string, string> = {
      Accept: "text/plain",
    };
    if (process.env.JINA_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
    }
    const res = await fetch(jinaUrl, { headers, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      console.warn(`[/api/company-info-deep] Jina failed: ${res.status}`);
      return null;
    }
    const text = await res.text();
    return text.slice(0, MAX_JINA_LENGTH);
  } catch (err) {
    console.warn("[/api/company-info-deep] Jina error:", err);
    return null;
  }
}

async function fetchTavilyContent(companyName: string): Promise<string | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.log("[/api/company-info-deep] TAVILY_API_KEY not set, skipping");
    return null;
  }
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: `${companyName} company overview funding technology culture`,
        search_depth: "basic",
        max_results: 5,
        include_answer: true,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.warn(`[/api/company-info-deep] Tavily failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const parts: string[] = [];
    if (data.answer) parts.push(`Summary: ${data.answer}`);
    if (Array.isArray(data.results)) {
      for (const r of data.results.slice(0, 5)) {
        if (r.content) parts.push(`[${r.title ?? ""}] ${r.content}`);
      }
    }
    return parts.join("\n\n").slice(0, MAX_TAVILY_SNIPPET_LENGTH);
  } catch (err) {
    console.warn("[/api/company-info-deep] Tavily error:", err);
    return null;
  }
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

    // Run Jina + Tavily in parallel
    const [jinaContent, tavilyContent] = await Promise.all([
      homepageUrl ? fetchJinaContent(homepageUrl) : Promise.resolve(null),
      fetchTavilyContent(companyName),
    ]);

    console.log("[/api/company-info-deep] Fetch results", {
      jinaLength: jinaContent?.length ?? 0,
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
      techStackCount: object.techStack.length,
      highlightsCount: object.recentHighlights.length,
      linksCount: deepLinksLabelled.length,
    });

    return NextResponse.json({
      keyFacts: object.keyFacts,
      techStack: object.techStack,
      recentHighlights: object.recentHighlights,
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
