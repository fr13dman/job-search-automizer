import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

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
      "True if any skill, technology, company, school, degree, date, or achievement in the curated resume cannot be verified against the original resume"
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

    const model = "claude-sonnet-4-5-20250929";
    console.log("[/api/evaluate-resume] Calling generateObject", {
      model,
      mode: "tool",
      truncatedResumeLength: Math.min(resumeText.length, MAX_INPUT_LENGTH),
      truncatedJobLength: Math.min(jobDescription.length, MAX_INPUT_LENGTH),
      truncatedCuratedLength: Math.min(curatedResume.length, MAX_INPUT_LENGTH),
    });

    const { object } = await generateObject({
      model: anthropic(model),
      mode: "tool",
      schema: EvaluationSchema,
      maxTokens: 1500,
      system: `You are an expert ATS analyst and resume accuracy reviewer. You will receive three inputs:
1. The candidate's ORIGINAL resume
2. A job description
3. A CURATED resume that was rewritten to match the job description

Perform three independent checks:

HALLUCINATION CHECK: Compare the curated resume line by line against the original. Flag any skill, technology, tool, company name, school name, degree, job title, achievement, metric, or date that appears in the curated resume but cannot be found in or reasonably inferred from the original resume. Even subtle substitutions (e.g. a different university, a slightly inflated metric, a tool not mentioned) must be flagged. Be thorough.

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

    return NextResponse.json(object);
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
