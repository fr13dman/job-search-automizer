import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const EvaluationSchema = z.object({
  humanScore: z
    .number()
    .describe(
      "How human and natural the writing sounds. 0 = obviously AI-generated, 100 = completely authentic human voice. Penalise heavily for AI clichés, robotic transitions, overly formal phrasing, and uniform sentence structure."
    ),
  verdict: z
    .enum(["Looks Human", "Borderline", "Likely AI"])
    .describe(
      "Overall verdict. 'Looks Human' for score 75+, 'Borderline' for 50-74, 'Likely AI' for below 50."
    ),
  aiSignals: z
    .array(z.string())
    .describe(
      "Specific phrases or patterns that sound AI-generated. Quote the offending phrase verbatim and briefly explain why it sounds artificial. Max 6 items. Empty array if none found."
    ),
  suggestions: z
    .array(z.string())
    .describe(
      "Concrete, actionable edits to make the writing sound more natural and human. Each suggestion should reference a specific part of the letter. Max 4 items."
    ),
});

export async function POST(request: NextRequest) {
  try {
    const { coverLetterText } = await request.json();

    if (!coverLetterText || typeof coverLetterText !== "string") {
      return NextResponse.json({ error: "coverLetterText is required" }, { status: 400 });
    }

    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: EvaluationSchema,
      system: `You are an expert at detecting AI-generated writing in cover letters. Your job is to identify patterns that signal machine-generated text versus authentic human voice.

AI writing signals to look for (flag ALL that apply):
- Em-dashes (—) anywhere in the text — this is a strong AI signal; flag every occurrence
- Robotic openers: "I am excited to apply", "I am writing to express my interest", "I am thrilled at the opportunity"
- Hollow enthusiasm: "passionate about", "I believe I would be a great fit", "I am eager to contribute"
- Formal transition robots: "Furthermore", "Moreover", "Additionally", "In conclusion", "It is worth noting", "I would like to highlight"
- Em-dashes used as clause separators (—)
- Words that no human uses casually: "leverage", "utilize", "spearhead", "synergize", "impactful", "dynamic", "robust"
- Perfectly uniform sentence length — every sentence the same rhythm
- Generic superlatives with no substance: "proven track record", "results-driven", "detail-oriented", "team player"
- Sign-off clichés: "I look forward to the opportunity to discuss", "Please do not hesitate to contact me"
- Overly complete sentences where a human would be more direct or clipped
- Lack of any personal voice, quirk, or specificity that only the writer would know

Score generously if the writing is specific, direct, and reads like a real person wrote it in their own voice.`,
      prompt: `Evaluate this cover letter for AI-generated content:\n\n${coverLetterText.slice(0, 4_000)}`,
    });

    return NextResponse.json(object);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[/api/evaluate-cover-letter] Error:", error);
    return NextResponse.json({ error: message || "Evaluation failed" }, { status: 500 });
  }
}
