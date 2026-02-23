import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildPrompt } from "@/lib/prompt";
import { TONE_OPTIONS, type Tone } from "@/types";

const VALID_TONES = new Set(TONE_OPTIONS.map((t) => t.value));

export async function POST(request: NextRequest) {
  try {
    const { resumeText, jobDescription, tone = "professional", additionalInstructions } = await request.json();

    console.log("[/api/generate] Received request", {
      resumeTextLength: resumeText?.length ?? 0,
      jobDescriptionLength: jobDescription?.length ?? 0,
      tone,
    });

    if (!resumeText || !jobDescription) {
      console.warn("[/api/generate] Missing required fields");
      return NextResponse.json(
        { error: "Both resumeText and jobDescription are required" },
        { status: 400 }
      );
    }

    const safeTone: Tone = VALID_TONES.has(tone) ? tone : "professional";
    const { system, user } = buildPrompt(resumeText, jobDescription, safeTone, additionalInstructions);

    console.log("[/api/generate] Calling streamText with Claude Sonnet, tone:", safeTone);

    const result = streamText({
      model: anthropic("claude-sonnet-4-5-20250929"),
      system,
      messages: [{ role: "user", content: user }],
      onFinish: ({ text }) => {
        console.log("[/api/generate] Stream finished, output length:", text.length);
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[/api/generate] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate cover letter" },
      { status: 500 }
    );
  }
}
