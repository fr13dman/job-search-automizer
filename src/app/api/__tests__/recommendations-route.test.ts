import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  streamText: vi.fn(() => ({
    toTextStreamResponse: () =>
      new Response("• Update skills section\n• Add metrics", {
        headers: { "Content-Type": "text/event-stream" },
      }),
  })),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mock-model"),
}));

import { POST } from "@/app/api/recommendations/route";
import { NextRequest } from "next/server";
import { streamText } from "ai";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a streaming response", async () => {
    const res = await POST(
      makeRequest({
        resumeText: "John Doe, Engineer",
        jobDescription: "Software Engineer at Acme",
      })
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Update skills section");
  });

  it("calls streamText with resume and job description in user message", async () => {
    await POST(
      makeRequest({
        resumeText: "Jane Doe, Developer",
        jobDescription: "Backend Engineer at Startup",
      })
    );

    expect(streamText).toHaveBeenCalledOnce();
    const call = vi.mocked(streamText).mock.calls[0][0];
    expect(call.messages[0].content).toContain("Jane Doe, Developer");
    expect(call.messages[0].content).toContain("Backend Engineer at Startup");
  });

  it("uses a resume-coach system prompt", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
      })
    );

    const call = vi.mocked(streamText).mock.calls[0][0];
    expect(call.system).toContain("resume coach");
  });

  it("system prompt instructs to return bullet points", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
      })
    );

    const call = vi.mocked(streamText).mock.calls[0][0];
    expect(call.system).toContain("bullet");
  });

  it("returns 400 when resumeText is missing", async () => {
    const res = await POST(makeRequest({ jobDescription: "Some job" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("required");
  });

  it("returns 400 when jobDescription is missing", async () => {
    const res = await POST(makeRequest({ resumeText: "Some resume" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("required");
  });

  it("returns 400 when both fields are missing", async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("required");
  });
});
