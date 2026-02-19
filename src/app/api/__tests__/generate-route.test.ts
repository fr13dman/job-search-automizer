import { describe, it, expect, vi } from "vitest";

vi.mock("ai", () => ({
  streamText: vi.fn(() => ({
    toTextStreamResponse: () =>
      new Response("streamed data", {
        headers: { "Content-Type": "text/event-stream" },
      }),
  })),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mock-model"),
}));

import { POST } from "@/app/api/generate/route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  it("returns a streaming response", async () => {
    const res = await POST(
      makeRequest({
        resumeText: "John Doe, Engineer",
        jobDescription: "Software Engineer at Acme",
      })
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("streamed data");
  });

  it("returns error when resumeText is missing", async () => {
    const res = await POST(
      makeRequest({ jobDescription: "Some job" })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("required");
  });

  it("returns error when jobDescription is missing", async () => {
    const res = await POST(
      makeRequest({ resumeText: "Some resume" })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("required");
  });
});
