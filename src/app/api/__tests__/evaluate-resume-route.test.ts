import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEvaluationResult = {
  atsScore: 82,
  keywordMatches: ["React", "TypeScript"],
  missingKeywords: ["GraphQL"],
  hallucinationsFound: false,
  hallucinationDetails: [],
  overallAssessment: "Strong resume with good keyword coverage.",
};

vi.mock("ai", () => ({
  generateObject: vi.fn(async () => ({ object: mockEvaluationResult })),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mock-model"),
}));

import { POST } from "@/app/api/evaluate-resume/route";
import { NextRequest } from "next/server";
import { generateObject } from "ai";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/evaluate-resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/evaluate-resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateObject).mockResolvedValue({ object: mockEvaluationResult } as never);
  });

  it("returns the evaluation object as JSON", async () => {
    const res = await POST(
      makeRequest({
        resumeText: "Jane Doe, React Developer",
        jobDescription: "Senior React Engineer at Acme",
        curatedResume: "Jane Doe\nSENIOR REACT DEVELOPER",
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.atsScore).toBe(82);
    expect(data.keywordMatches).toEqual(["React", "TypeScript"]);
    expect(data.hallucinationsFound).toBe(false);
    expect(data.overallAssessment).toBe("Strong resume with good keyword coverage.");
  });

  it("calls generateObject with all three inputs in the prompt", async () => {
    await POST(
      makeRequest({
        resumeText: "Original resume content",
        jobDescription: "Job description content",
        curatedResume: "Curated resume content",
      })
    );

    expect(generateObject).toHaveBeenCalledOnce();
    const call = vi.mocked(generateObject).mock.calls[0][0] as { prompt: string; system: string };
    expect(call.prompt).toContain("Original resume content");
    expect(call.prompt).toContain("Job description content");
    expect(call.prompt).toContain("Curated resume content");
  });

  it("system prompt instructs ATS analysis", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
        curatedResume: "Curated",
      })
    );

    const call = vi.mocked(generateObject).mock.calls[0][0] as { system: string };
    expect(call.system).toContain("ATS");
  });

  it("system prompt instructs hallucination check", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
        curatedResume: "Curated",
      })
    );

    const call = vi.mocked(generateObject).mock.calls[0][0] as { system: string };
    expect(call.system.toLowerCase()).toContain("hallucination");
  });

  it("returns 400 when resumeText is missing", async () => {
    const res = await POST(
      makeRequest({ jobDescription: "Some job", curatedResume: "Some resume" })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required");
  });

  it("returns 400 when jobDescription is missing", async () => {
    const res = await POST(
      makeRequest({ resumeText: "Some resume", curatedResume: "Curated" })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required");
  });

  it("returns 400 when curatedResume is missing", async () => {
    const res = await POST(
      makeRequest({ resumeText: "Some resume", jobDescription: "Some job" })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required");
  });

  it("returns 400 when all fields are missing", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required");
  });

  it("truncates long inputs before sending to model", async () => {
    const longText = "x".repeat(10_000);
    await POST(
      makeRequest({
        resumeText: longText,
        jobDescription: longText,
        curatedResume: longText,
      })
    );

    const call = vi.mocked(generateObject).mock.calls[0][0] as { prompt: string };
    // Each field is truncated to 8000 chars + "[truncated]" suffix
    expect(call.prompt).toContain("[truncated]");
  });

  it("atsScore schema has no min/max constraints (Anthropic tool schema compatibility)", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
        curatedResume: "Curated",
      })
    );

    const call = vi.mocked(generateObject).mock.calls[0][0] as { schema: { shape: Record<string, unknown> } };
    // Inspect Zod schema internals to verify no min/max validators are set on atsScore
    // Anthropic rejects schemas with `minimum`/`maximum` on number types
    const atsScoreSchema = call.schema.shape.atsScore as { _def: { checks?: Array<{ kind: string }> } };
    const checks: Array<{ kind: string }> = atsScoreSchema._def.checks ?? [];
    expect(checks.some((c) => c.kind === "min")).toBe(false);
    expect(checks.some((c) => c.kind === "max")).toBe(false);
  });

  it("calls generateObject with the configured model", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
        curatedResume: "Curated",
      })
    );

    expect(generateObject).toHaveBeenCalledOnce();
    // model is passed as the return value of anthropic(modelId)
    const call = vi.mocked(generateObject).mock.calls[0][0] as { model: string };
    expect(call.model).toBe("mock-model");
  });

  it("returns 500 with details field when generateObject throws", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(
      Object.assign(new Error("Model unavailable"), { cause: "upstream timeout" })
    );

    const res = await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
        curatedResume: "Curated",
      })
    );

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Failed to evaluate resume");
    expect(data.details).toContain("Model unavailable");
  });

  it("includes cause in details when error has a cause", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(
      Object.assign(new Error("Evaluation failed"), { cause: "rate limit exceeded" })
    );

    const res = await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
        curatedResume: "Curated",
      })
    );

    const data = await res.json();
    expect(data.details).toContain("rate limit exceeded");
  });
});
