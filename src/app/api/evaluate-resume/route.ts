import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { checkNumericFidelity } from "@/lib/check-numeric-fidelity";

const EvaluationSchema = z.object({
  atsScore: z
    .number()
    // Note: .min()/.max() omitted — Anthropic tool schemas do not support
    // the JSON Schema `minimum`/`maximum` keywords and will return a 400 error.
    .describe("Overall ATS compatibility score from 0–100"),
  keywordMatches: z
    .array(z.string())
    .describe("Keywords from the job description that appear in the curated resume"),
  missingKeywords: z
    .array(z.string())
    .describe("Important keywords from the job description absent from the curated resume"),
  hallucinationsFound: z
    .boolean()
    .describe(
      "True if ANY of the following: (1) a metric or number in the curated resume differs from the original, (2) a company name or employer name differs from the original, or (3) a specific achievement or project cannot be traced to the original resume. Adding job-description keywords that are demonstrably supported by the original experience is NOT a hallucination. Note: the EDUCATION section is pre-populated verbatim from the original and does not need to be checked."
    ),
  hallucinationDetails: z
    .array(z.string())
    .describe("Specific items in the curated resume that are not present in the original resume"),
  overallAssessment: z
    .string()
    .describe("2–3 sentence summary of the resume's ATS readiness and quality"),
});

const MAX_INPUT_LENGTH = 8_000;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + "... [truncated]";
}

export async function POST(request: NextRequest) {
  try {
    const { resumeText, jobDescription, curatedResume } = await request.json();

    console.log("[/api/evaluate-resume] Received request", {
      resumeTextLength: resumeText?.length ?? 0,
      jobDescriptionLength: jobDescription?.length ?? 0,
      curatedResumeLength: curatedResume?.length ?? 0,
    });

    if (!resumeText || !jobDescription || !curatedResume) {
      console.warn("[/api/evaluate-resume] Missing required fields");
      return NextResponse.json(
        { error: "resumeText, jobDescription, and curatedResume are all required" },
        { status: 400 }
      );
    }

    const numericCheck = checkNumericFidelity(resumeText, curatedResume);
    console.log("[/api/evaluate-resume] Numeric fidelity check", {
      passed: numericCheck.passed,
      mismatchCount: numericCheck.mismatches.length,
    });

    // Deterministic bloat check: curated resume must not be dramatically longer than the
    // original. A ratio > 1.5 with > 150 extra words strongly suggests the LLM or a
    // post-processing step duplicated or injected content.
    const originalWordCount = resumeText.split(/\s+/).filter(Boolean).length;
    const curatedWordCount = curatedResume.split(/\s+/).filter(Boolean).length;
    const bloatRatio = curatedWordCount / Math.max(originalWordCount, 1);
    const isBloated = bloatRatio > 1.5 && curatedWordCount - originalWordCount > 150;
    console.log("[/api/evaluate-resume] Bloat check", {
      originalWordCount,
      curatedWordCount,
      bloatRatio: bloatRatio.toFixed(2),
      isBloated,
    });
    const bloatDetails = isBloated
      ? [
          `Curated resume (${curatedWordCount} words) is ${Math.round((bloatRatio - 1) * 100)}% longer than the original (${originalWordCount} words) — likely contains duplicated or fabricated content`,
        ]
      : [];

    const model = "claude-sonnet-4-5-20250929";
    console.log("[/api/evaluate-resume] Calling generateObject", {
      model,
      truncatedResumeLength: Math.min(resumeText.length, MAX_INPUT_LENGTH),
      truncatedJobLength: Math.min(jobDescription.length, MAX_INPUT_LENGTH),
      truncatedCuratedLength: Math.min(curatedResume.length, MAX_INPUT_LENGTH),
    });

    const { object } = await generateObject({
      model: anthropic(model),
      schema: EvaluationSchema,
      maxOutputTokens: 1500,
      system: `You are an expert ATS analyst and resume accuracy reviewer. You will receive three inputs:
1. The candidate's ORIGINAL resume
2. A job description
3. A CURATED resume that was rewritten to match the job description

CRITICAL RULE: hallucinationsFound MUST be set to true if ANY single check below fails. Do not weigh severity — one failure = true. When uncertain, set to true. A false positive is far less harmful than a false negative.

NOTE: The EDUCATION section in the curated resume has already been replaced verbatim with content from the original resume by a deterministic post-processing step. Do not check or flag anything in the EDUCATION section.

METRICS INTEGRITY CHECK (failure → hallucinationsFound: true):
1. Extract every number, percentage, dollar amount, headcount, and duration (numeric achievement) from accomplishment bullets in the ORIGINAL resume (e.g. "40%", "$2M", "team of 12", "5,000 TPS", "99.99% uptime").
2. For each numeric value in the CURATED resume's accomplishment bullets, confirm it appears with the exact same value in the original.
3. If any metric in the curated resume has a different value than the original — even if rounded, approximated, or unit-converted — set hallucinationsFound to true and add to hallucinationDetails.

HALLUCINATION CHECK — flag these (genuine fabrications):
- A company name or employer that does not appear in the original
- A job title that differs substantively from the original (e.g. different function or seniority level)
- A specific project, product, or accomplishment that cannot be traced to the original
- A technology or tool that is completely absent from the original AND cannot be reasonably inferred from listed tools (e.g. listing Kubernetes when the original only mentions Excel is a hallucination; listing TypeScript when the original mentions JavaScript is NOT)
- Content that appears verbatim duplicated from another section

Do NOT flag these (they are expected and correct):
- Skills or keywords from the job description that are explicitly present in the original
- Technologies reasonably implied by listed tools (CSS implied by React, SQL implied by PostgreSQL, Python implied by Django, etc.)
- A SUMMARY section added to a resume that lacked one, provided it reflects original content
- Rephrased or reformatted descriptions of the same work (active voice, synonyms, reordering)

ATS KEYWORD ANALYSIS: Extract all important keywords, skills, technologies, methodologies, and role-relevant phrases from the job description. For each, check whether it appears (verbatim or as a clear synonym) in the curated resume. Report matches and gaps separately.

ATS SCORE: Based on keyword coverage, presence of action verbs, quantified achievements, and formatting clarity, assign an integer score from 0–100 representing how well the resume would perform in an ATS scan for this specific job.`,
      prompt: `## Original Resume
${truncate(resumeText, MAX_INPUT_LENGTH)}

## Job Description
${truncate(jobDescription, MAX_INPUT_LENGTH)}

## Curated Resume
${truncate(curatedResume, MAX_INPUT_LENGTH)}

Evaluate the curated resume against the original and the job description. Return a structured evaluation.`,
    });

    console.log("[/api/evaluate-resume] Evaluation complete", {
      atsScore: object.atsScore,
      hallucinationsFound: object.hallucinationsFound,
      keywordMatchCount: object.keywordMatches.length,
      missingKeywordCount: object.missingKeywords.length,
    });

    const mergedObject = {
      ...object,
      hallucinationsFound:
        object.hallucinationsFound || !numericCheck.passed || isBloated,
      hallucinationDetails: [
        ...object.hallucinationDetails,
        ...numericCheck.mismatches,
        ...bloatDetails,
      ],
    };
    return NextResponse.json(mergedObject);
  } catch (error) {
    const errorName = error instanceof Error ? error.constructor.name : "UnknownError";
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCause =
      error instanceof Error && error.cause
        ? String(error.cause)
        : undefined;

    console.error("[/api/evaluate-resume] Error:", {
      name: errorName,
      message: errorMessage,
      cause: errorCause,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to evaluate resume",
        details: `${errorName}: ${errorMessage}${errorCause ? ` (cause: ${errorCause})` : ""}`,
      },
      { status: 500 }
    );
  }
}
