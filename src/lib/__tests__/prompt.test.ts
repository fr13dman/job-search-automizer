import { describe, it, expect } from "vitest";
import { buildPrompt } from "@/lib/prompt";

describe("buildPrompt", () => {
  it("returns system and user strings that are non-empty", () => {
    const result = buildPrompt("Resume text", "Job description");
    expect(result.system.length).toBeGreaterThan(0);
    expect(result.user.length).toBeGreaterThan(0);
  });

  it("includes resume text in user prompt", () => {
    const result = buildPrompt("My resume content here", "Some job");
    expect(result.user).toContain("My resume content here");
  });

  it("includes job description in user prompt", () => {
    const result = buildPrompt("Some resume", "Senior Engineer at Acme");
    expect(result.user).toContain("Senior Engineer at Acme");
  });

  it("truncates inputs exceeding 8,000 characters", () => {
    const longResume = "x".repeat(10_000);
    const longJob = "y".repeat(10_000);
    const result = buildPrompt(longResume, longJob);
    // The truncated text should be 8000 chars + "... [truncated]"
    expect(result.user).toContain("... [truncated]");
    expect(result.user).not.toContain("x".repeat(10_000));
    expect(result.user).not.toContain("y".repeat(10_000));
  });
});
