import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  streamText: vi.fn(() => ({
    toTextStreamResponse: () =>
      new Response("EXPERIENCE\n- Led backend team\n- Shipped 3 products", {
        headers: { "Content-Type": "text/event-stream" },
      }),
  })),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mock-model"),
}));

import { POST } from "@/app/api/curate-resume/route";
import { NextRequest } from "next/server";
import { streamText } from "ai";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/curate-resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/curate-resume", () => {
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
    expect(text).toContain("Led backend team");
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

  it("uses a resume writer system prompt", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
      })
    );

    const call = vi.mocked(streamText).mock.calls[0][0];
    expect(call.system).toContain("resume writer");
  });

  it("system prompt contains Zero hallucinations rule", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
      })
    );

    const call = vi.mocked(streamText).mock.calls[0][0];
    expect(call.system).toContain("no-hallucination");
  });

  it("system prompt instructs to preserve section headings", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
      })
    );

    const call = vi.mocked(streamText).mock.calls[0][0];
    expect(call.system).toContain("section headings");
  });

  it("user message instructs no preamble", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
      })
    );

    const call = vi.mocked(streamText).mock.calls[0][0];
    expect(call.messages[0].content).toContain("No preamble");
  });

  it("system prompt enforces 2-page maximum", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
      })
    );

    const call = vi.mocked(streamText).mock.calls[0][0];
    expect(call.system).toContain("2 pages");
  });

  it("system prompt instructs ATS optimization with keywords", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
      })
    );

    const call = vi.mocked(streamText).mock.calls[0][0];
    expect(call.system).toContain("ATS");
    expect(call.system).toContain("keywords");
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
