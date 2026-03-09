import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import {
  extractUrlsFromText,
  buildDeterministicLinks,
  urlsToLinks,
} from "@/lib/extract-company-links";

const MAX_JD_LENGTH = 4_000;

const CompanyInfoSchema = z.object({
  description: z
    .string()
    .describe(
      "2–3 sentence summary of what the company does, its market or industry, and its mission. Extract from the job description; do not invent details."
    ),
  values: z
    .array(z.string())
    .describe(
      "Company values or cultural principles explicitly stated or very clearly implied in the job description. Return an empty array if none are present. Maximum 8 items."
    ),
  additionalLinks: z
    .array(
      z.object({
        label: z.string().describe("Short human-readable label for the link"),
        url: z.string().describe("Full URL as it appears verbatim in the text"),
      })
    )
    .describe(
      "URLs that appear verbatim in the job description text and are relevant to the company (e.g. engineering blog, press page, product site). Do not invent URLs."
    ),
});

export async function POST(request: NextRequest) {
  try {
    const { jobDescription, companyName, sourceUrl } = await request.json();

    if (!jobDescription) {
      return NextResponse.json(
        { error: "jobDescription is required" },
        { status: 400 }
      );
    }

    console.log("[/api/company-info] Received request", {
      jobDescriptionLength: jobDescription?.length ?? 0,
      companyName,
      hasSourceUrl: !!sourceUrl,
    });

    // ── Zero-token step: deterministic links ────────────────────────────────
    const deterministicLinks = buildDeterministicLinks(sourceUrl, companyName);
    const seenHostnames = new Set(
      deterministicLinks.map((l) => {
        try { return new URL(l.url).hostname; } catch { return l.url; }
      })
    );

    // ── Zero-token step: regex-extract URLs from JD ─────────────────────────
    const rawUrls = extractUrlsFromText(jobDescription);
    const regexLinks = urlsToLinks(rawUrls, seenHostnames, "extracted", 3);

    // ── Haiku generateObject call ───────────────────────────────────────────
    const truncatedJd = jobDescription.slice(0, MAX_JD_LENGTH);

    console.log("[/api/company-info] Calling generateObject with Haiku", {
      truncatedLength: truncatedJd.length,
    });

    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: CompanyInfoSchema,
      system:
        "You extract company information from job descriptions. Only return information that is explicitly stated or very clearly implied. Never invent or hallucinate company details, values, or URLs.",
      prompt: `Company name: ${companyName || "Unknown"}\n\nJob description:\n${truncatedJd}`,
    });

    // ── Merge LLM-found links (deduped) ────────────────────────────────────
    const llmLinks = urlsToLinks(
      object.additionalLinks.map((l) => l.url),
      seenHostnames,
      "extracted",
      3
    );
    // Restore LLM-provided labels for the links that passed dedup
    const llmLinksLabelled = llmLinks.map((link) => {
      const match = object.additionalLinks.find((l) => l.url === link.url);
      return match ? { ...link, label: match.label } : link;
    });

    const allLinks = [...deterministicLinks, ...regexLinks, ...llmLinksLabelled];

    console.log("[/api/company-info] Done", {
      valuesCount: object.values.length,
      linksCount: allLinks.length,
    });

    return NextResponse.json({
      description: object.description,
      values: object.values,
      links: allLinks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[/api/company-info] Error:", error);
    return NextResponse.json(
      { error: message || "Failed to fetch company info" },
      { status: 500 }
    );
  }
}
