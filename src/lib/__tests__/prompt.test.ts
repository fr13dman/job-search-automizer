import { describe, it, expect } from "vitest";
import { buildPrompt, buildRecommendationsPrompt } from "@/lib/prompt";

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
    expect(result.user).toContain("... [truncated]");
    expect(result.user).not.toContain("x".repeat(10_000));
    expect(result.user).not.toContain("y".repeat(10_000));
  });

  it("defaults to professional tone", () => {
    const result = buildPrompt("Resume", "Job");
    expect(result.system).toContain("polished");
  });

  it("includes friendly tone instructions when specified", () => {
    const result = buildPrompt("Resume", "Job", "friendly");
    expect(result.system).toContain("warm");
    expect(result.user).toContain("friendly");
  });

  it("includes concise tone instructions when specified", () => {
    const result = buildPrompt("Resume", "Job", "concise");
    expect(result.system).toContain("direct");
    expect(result.user).toContain("concise");
  });

  it("includes enthusiastic tone instructions when specified", () => {
    const result = buildPrompt("Resume", "Job", "enthusiastic");
    expect(result.system).toContain("energetic");
  });

  it("includes confident tone instructions when specified", () => {
    const result = buildPrompt("Resume", "Job", "confident");
    expect(result.system).toContain("bold");
  });

  it("instructs for Flesch reading score above 80", () => {
    const result = buildPrompt("Resume", "Job");
    expect(result.system).toContain("Flesch");
    expect(result.system).toContain("80");
  });

  it("instructs for 500 word limit", () => {
    const result = buildPrompt("Resume", "Job");
    expect(result.system).toContain("500 words");
  });

  it("instructs to use markdown bold for impactful narratives", () => {
    const result = buildPrompt("Resume", "Job");
    expect(result.system).toContain("**bold**");
  });

  it("appends additionalInstructions to user prompt when provided", () => {
    const result = buildPrompt("Resume", "Job", "professional", "Focus on leadership experience");
    expect(result.user).toContain("Additional Instructions");
    expect(result.user).toContain("Focus on leadership experience");
  });

  it("does not include Additional Instructions section when not provided", () => {
    const result = buildPrompt("Resume", "Job");
    expect(result.user).not.toContain("Additional Instructions");
  });

  it("does not include Additional Instructions section when empty string", () => {
    const result = buildPrompt("Resume", "Job", "professional", "");
    expect(result.user).not.toContain("Additional Instructions");
  });

  it("does not include Additional Instructions section when only whitespace", () => {
    const result = buildPrompt("Resume", "Job", "professional", "   ");
    expect(result.user).not.toContain("Additional Instructions");
  });
});

describe("buildRecommendationsPrompt", () => {
  it("returns non-empty system and user strings", () => {
    const result = buildRecommendationsPrompt("Resume text", "Job description");
    expect(result.system.length).toBeGreaterThan(0);
    expect(result.user.length).toBeGreaterThan(0);
  });

  it("includes resume text in user prompt", () => {
    const result = buildRecommendationsPrompt("My resume content here", "Some job");
    expect(result.user).toContain("My resume content here");
  });

  it("includes job description in user prompt", () => {
    const result = buildRecommendationsPrompt("Some resume", "Senior Engineer at Acme");
    expect(result.user).toContain("Senior Engineer at Acme");
  });

  it("truncates inputs exceeding 8,000 characters", () => {
    const longResume = "x".repeat(10_000);
    const longJob = "y".repeat(10_000);
    const result = buildRecommendationsPrompt(longResume, longJob);
    expect(result.user).toContain("... [truncated]");
  });

  it("system prompt instructs to return bullet points", () => {
    const result = buildRecommendationsPrompt("Resume", "Job");
    expect(result.system).toContain("bullet");
  });

  it("system prompt instructs not to fabricate skills", () => {
    const result = buildRecommendationsPrompt("Resume", "Job");
    expect(result.system).toContain("not fabricate");
  });

  it("system prompt asks for 5-8 bullet points", () => {
    const result = buildRecommendationsPrompt("Resume", "Job");
    expect(result.system).toMatch(/5.{0,5}8/);
  });

  it("user prompt instructs to return only bullet points without preamble", () => {
    const result = buildRecommendationsPrompt("Resume", "Job");
    expect(result.user).toContain("bullet points");
  });
});
