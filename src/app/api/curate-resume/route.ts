import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildCurateResumePrompt } from "@/lib/prompt";

export async function POST(request: NextRequest) {
  try {
    const { resumeText, jobDescription } = await request.json();

    console.log("[/api/curate-resume] Received request", {
      resumeTextLength: resumeText?.length ?? 0,
      jobDescriptionLength: jobDescription?.length ?? 0,
    });

    if (!resumeText || !jobDescription) {
      console.warn("[/api/curate-resume] Missing required fields");
      return NextResponse.json(
        { error: "Both resumeText and jobDescription are required" },
        { status: 400 }
      );
    }

    const { system, user } = buildCurateResumePrompt(resumeText, jobDescription);

    console.log("[/api/curate-resume] Calling streamText with Claude Sonnet");

    const result = streamText({
      model: anthropic("claude-sonnet-4-5-20250929"),
      system,
      messages: [{ role: "user", content: user }],
      onFinish: ({ text }) => {
        console.log("[/api/curate-resume] Stream finished, output length:", text.length);
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[/api/curate-resume] Error:", error);
    return NextResponse.json(
      { error: "Failed to curate resume" },
      { status: 500 }
    );
  }
}
