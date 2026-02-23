import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildRecommendationsPrompt } from "@/lib/prompt";

export async function POST(request: NextRequest) {
  try {
    const { resumeText, jobDescription } = await request.json();

    console.log("[/api/recommendations] Received request", {
      resumeTextLength: resumeText?.length ?? 0,
      jobDescriptionLength: jobDescription?.length ?? 0,
    });

    if (!resumeText || !jobDescription) {
      console.warn("[/api/recommendations] Missing required fields");
      return NextResponse.json(
        { error: "Both resumeText and jobDescription are required" },
        { status: 400 }
      );
    }

    const { system, user } = buildRecommendationsPrompt(resumeText, jobDescription);

    console.log("[/api/recommendations] Calling streamText with Claude Sonnet");

    const result = streamText({
      model: anthropic("claude-sonnet-4-5-20250929"),
      system,
      messages: [{ role: "user", content: user }],
      onFinish: ({ text }) => {
        console.log("[/api/recommendations] Stream finished, output length:", text.length);
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[/api/recommendations] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
