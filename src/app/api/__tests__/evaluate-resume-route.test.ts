import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEvaluationResult = {
  atsScore: 82,
  keywordMatches: ["React", "TypeScript"],
  missingKeywords: ["GraphQL"],
  hallucinationsFound: false,
  hallucinationDetails: [],
  overallAssessment: "Strong resume with good keyword coverage.",
};

// Allow tests to override the numeric fidelity check
let numericFidelityResult = { passed: true, mismatches: [] as string[] };

vi.mock("@/lib/check-numeric-fidelity", () => ({
  checkNumericFidelity: vi.fn(() => numericFidelityResult),
}));

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
    // Reset numeric fidelity to passing state by default
    numericFidelityResult = { passed: true, mismatches: [] };
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

  it("system prompt notes EDUCATION section is pre-populated (no LLM check needed)", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
        curatedResume: "Curated",
      })
    );

    const call = vi.mocked(generateObject).mock.calls[0][0] as { system: string };
    // Education is deterministically restored before evaluation — prompt should reflect this
    expect(call.system.toLowerCase()).toContain("education section");
    expect(call.system.toLowerCase()).toContain("verbatim");
    // Should NOT contain the old LLM-based education integrity check
    expect(call.system).not.toContain("EDUCATION INTEGRITY");
  });

  it("system prompt defers numeric checks to deterministic layer (no LLM metric comparison)", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
        curatedResume: "Curated",
      })
    );

    const call = vi.mocked(generateObject).mock.calls[0][0] as { system: string };
    // Numeric verification is done by checkNumericFidelity in code — LLM should not re-check
    expect(call.system).not.toContain("METRICS INTEGRITY");
    expect(call.system.toLowerCase()).toContain("deterministic");
    expect(call.system.toLowerCase()).toContain("numeric");
  });

  it("system prompt frames hallucination check as fabricated facts, not narrative rewrites", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
        curatedResume: "Curated",
      })
    );

    const call = vi.mocked(generateObject).mock.calls[0][0] as { system: string };
    expect(call.system).toContain("FABRICATED FACTS CHECK");
    // Should explicitly say rewriting is NOT a hallucination
    expect(call.system.toLowerCase()).toContain("rewriting");
    // Should NOT use the old strict "one failure = true" framing
    expect(call.system).not.toContain("one failure = true");
  });

  it("hallucinationsFound schema description scopes to fabricated facts and excludes rewrites", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
        curatedResume: "Curated",
      })
    );

    const call = vi.mocked(generateObject).mock.calls[0][0] as { schema: { shape: Record<string, { description: string }> } };
    const desc = call.schema.shape.hallucinationsFound.description;
    // Should describe fabricated facts, not rewrites
    expect(desc.toLowerCase()).toContain("fabricated");
    // Should note that numeric and education are handled elsewhere
    expect(desc.toLowerCase()).toContain("education");
    expect(desc.toLowerCase()).toContain("numeric");
    // Should NOT include old strict conditions
    expect(desc).not.toContain("institution name");
    expect(desc).not.toContain("degree level");
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

  // Option A: deterministic numeric fidelity check
  it("forces hallucinationsFound:true when numeric check fails even if LLM returns false", async () => {
    numericFidelityResult = {
      passed: false,
      mismatches: ["Metric '40%' from original resume not found in curated resume"],
    };

    const res = await POST(
      makeRequest({
        resumeText: "Improved efficiency by 40%.",
        jobDescription: "Job",
        curatedResume: "Improved efficiency by 50%.",
      })
    );

    const data = await res.json();
    expect(data.hallucinationsFound).toBe(true);
  });

  it("adds deterministic mismatch strings to hallucinationDetails", async () => {
    numericFidelityResult = {
      passed: false,
      mismatches: ["Metric '40%' from original resume not found in curated resume"],
    };

    const res = await POST(
      makeRequest({
        resumeText: "Improved efficiency by 40%.",
        jobDescription: "Job",
        curatedResume: "Improved efficiency by 50%.",
      })
    );

    const data = await res.json();
    expect(data.hallucinationDetails).toContain(
      "Metric '40%' from original resume not found in curated resume"
    );
  });

  it("preserves LLM hallucinationDetails alongside deterministic mismatches", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        ...mockEvaluationResult,
        hallucinationsFound: true,
        hallucinationDetails: ["Invented skill: Kubernetes"],
      },
    } as never);
    numericFidelityResult = {
      passed: false,
      mismatches: ["Metric '40%' from original resume not found in curated resume"],
    };

    const res = await POST(
      makeRequest({
        resumeText: "Improved efficiency by 40%.",
        jobDescription: "Job",
        curatedResume: "Improved efficiency by 50%.",
      })
    );

    const data = await res.json();
    expect(data.hallucinationDetails).toContain("Invented skill: Kubernetes");
    expect(data.hallucinationDetails).toContain(
      "Metric '40%' from original resume not found in curated resume"
    );
  });

  it("leaves result unchanged when numeric check passes", async () => {
    numericFidelityResult = { passed: true, mismatches: [] };

    const res = await POST(
      makeRequest({
        resumeText: "Improved efficiency by 40%.",
        jobDescription: "Job",
        curatedResume: "Improved efficiency by 40%.",
      })
    );

    const data = await res.json();
    expect(data.hallucinationsFound).toBe(false);
    expect(data.hallucinationDetails).toHaveLength(0);
  });

  // Bloat detection tests
  it("BLOAT: forces hallucinationsFound:true when curated is >150% longer than original", async () => {
    const original = "Jane Doe\nSoftware Engineer\nBuilt web apps with React.";
    // Curated is > 150% longer by word count and > 150 extra words
    const curated = Array.from(
      { length: 200 },
      (_, i) => `Extra fabricated line ${i}`
    ).join("\n");

    const res = await POST(
      makeRequest({
        resumeText: original,
        jobDescription: "Senior Engineer role",
        curatedResume: curated,
      })
    );

    const data = await res.json();
    expect(data.hallucinationsFound).toBe(true);
  });

  it("BLOAT: adds a descriptive detail message when curated is bloated", async () => {
    const original = "Jane Doe\nEngineer\nBuilt systems.";
    const curated = Array.from({ length: 200 }, (_, i) => `Bloat line ${i}`).join("\n");

    const res = await POST(
      makeRequest({
        resumeText: original,
        jobDescription: "Job",
        curatedResume: curated,
      })
    );

    const data = await res.json();
    expect(data.hallucinationDetails.some((d: string) => d.toLowerCase().includes("longer"))).toBe(true);
  });

  it("BLOAT: does NOT flag when curated is only moderately longer than original", async () => {
    // 1.3x longer — not bloated (within acceptable threshold)
    const original = Array.from({ length: 100 }, (_, i) => `Original word ${i}`).join(" ");
    const curated = Array.from({ length: 130 }, (_, i) => `Curated word ${i}`).join(" ");

    const res = await POST(
      makeRequest({
        resumeText: original,
        jobDescription: "Job",
        curatedResume: curated,
      })
    );

    const data = await res.json();
    // LLM mock returns hallucinationsFound: false; bloat check should not fire
    expect(data.hallucinationDetails.some((d: string) => d.toLowerCase().includes("longer"))).toBe(false);
  });

  it("system prompt HALLUCINATION CHECK allows reasonable JD keyword additions", async () => {
    await POST(
      makeRequest({
        resumeText: "Resume",
        jobDescription: "Job",
        curatedResume: "Curated",
      })
    );

    const call = vi.mocked(generateObject).mock.calls[0][0] as { system: string };
    // The prompt should explicitly say keyword additions are NOT hallucinations
    expect(call.system).toContain("Do NOT flag");
    // Should not contain the old overly strict "a tool not mentioned" language
    expect(call.system).not.toContain("a tool not mentioned");
  });
});
