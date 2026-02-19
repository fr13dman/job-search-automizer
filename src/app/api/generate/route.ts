import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildPrompt } from "@/lib/prompt";

export async function POST(request: NextRequest) {
  try {
    const { resumeText, jobDescription } = await request.json();

    console.log("[/api/generate] Received request", {
      resumeTextLength: resumeText?.length ?? 0,
      jobDescriptionLength: jobDescription?.length ?? 0,
    });

    if (!resumeText || !jobDescription) {
      console.warn("[/api/generate] Missing required fields");
      return NextResponse.json(
        { error: "Both resumeText and jobDescription are required" },
        { status: 400 }
      );
    }

    const { system, user } = buildPrompt(resumeText, jobDescription);

    console.log("[/api/generate] Calling streamText with Claude Sonnet");

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
