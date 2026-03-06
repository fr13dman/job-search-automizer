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
      "True only if the curated resume contains a claim that is entirely fabricated with no basis in the original — an invented employer, an invented role, or a specific project/achievement the candidate never performed. Rewriting, rephrasing, and professionalising existing content is NOT a hallucination. Numeric values and the education section are verified by separate deterministic checks and do not need to be assessed here."
    ),
  hallucinationDetails: z
    .array(z.string())
    .describe("Specific claims in the curated resume that are entirely fabricated with no traceable basis in the original resume (e.g. invented employer, invented project, invented role). Do not list narrative rewrites or phrasing improvements."),
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

The curated resume was produced by an AI that rewrote the original to be more concise, professional, and ATS-optimised. Rewriting, rephrasing, condensing, and adding JD-relevant keywords supported by the original experience are all expected and correct — do NOT flag these.

ALREADY VERIFIED BY DETERMINISTIC CHECKS (do not re-check):
- All numeric values and statistics — a separate code-level check has already verified every number in the original appears in the curated resume with the same value.
- The EDUCATION section — it has been replaced verbatim from the original before this evaluation.

FABRICATED FACTS CHECK:
Only set hallucinationsFound to true when the curated resume contains a claim that has NO basis whatsoever in the original — a clear invention, not a rewrite. Ask yourself: "Is there any work, project, or experience in the original that this could reasonably be describing?" If yes, it is not a hallucination.

Flag ONLY these (genuine fabrications with no basis in the original):
- A company name or employer that does not appear anywhere in the original
- A completely different role or job function (e.g. original: accountant; curated: software engineer)
- A specific project or product that is entirely invented with no connection to any work described in the original (e.g. "Founded and led a startup" when the original contains no mention of it)
- A technology or tool completely absent from the original AND not reasonably inferable from listed tools (e.g. Kubernetes when the original only mentions Excel; NOT TypeScript when original mentions JavaScript)

Do NOT flag these (they are expected curation):
- Rephrasing, condensing, or professionally rewriting described work
- Stronger action verbs, active voice, cleaner formatting
- A SUMMARY section that reflects the candidate's actual background
- JD keywords added where the candidate demonstrably has the underlying experience
- Technologies reasonably implied by listed tools (CSS by React, SQL by PostgreSQL, etc.)
- Upgraded or clarified job title phrasing within the same function (e.g. "developer" → "software engineer", "engineer" → "senior engineer" if experience supports it)
- Removing filler, informal language, or irrelevant detail

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
