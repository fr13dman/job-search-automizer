import { describe, it, expect } from "vitest";
import { buildPrompt, buildCurateResumePrompt } from "@/lib/prompt";

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

describe("buildCurateResumePrompt", () => {
  it("returns non-empty system and user strings", () => {
    const result = buildCurateResumePrompt("Resume text", "Job description");
    expect(result.system.length).toBeGreaterThan(0);
    expect(result.user.length).toBeGreaterThan(0);
  });

  it("includes resume text in user prompt", () => {
    const result = buildCurateResumePrompt("My resume content here", "Some job");
    expect(result.user).toContain("My resume content here");
  });

  it("includes job description in user prompt", () => {
    const result = buildCurateResumePrompt("Some resume", "Senior Engineer at Acme");
    expect(result.user).toContain("Senior Engineer at Acme");
  });

  it("truncates inputs exceeding 8,000 characters", () => {
    const longResume = "x".repeat(10_000);
    const longJob = "y".repeat(10_000);
    const result = buildCurateResumePrompt(longResume, longJob);
    expect(result.user).toContain("... [truncated]");
    expect(result.user).not.toContain("x".repeat(10_000));
    expect(result.user).not.toContain("y".repeat(10_000));
  });

  it("system prompt contains Zero hallucinations rule", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("no-hallucination");
  });

  it("system prompt instructs to preserve section headings", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("section headings");
  });

  it("system prompt allows reordering bullets", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("reorder");
  });

  it("system prompt requires accomplishments as bullet points", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("Accomplishments format");
    expect(result.system).toContain("bullet points");
  });

  it("system prompt includes consolidation rule for bullets", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("consolidate");
  });

  it("user prompt instructs to return only resume with no preamble", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.user).toContain("No preamble");
  });

  it("system prompt enforces 5 bullet point limit per role", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("5 bullet points");
  });

  it("system prompt instructs ATS optimization", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("ATS");
  });

  it("system prompt instructs to use keywords from job description", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("keywords");
  });

  it("system prompt restricts ATS keywords to existing resume evidence", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("Skills section");
  });

  it("includes evaluation feedback in user prompt when provided", () => {
    const feedback = "Hallucination: Added MIT degree\nMissing: Docker";
    const result = buildCurateResumePrompt("Resume", "Job", feedback);
    expect(result.user).toContain("Previous Attempt Feedback");
    expect(result.user).toContain("Added MIT degree");
    expect(result.user).toContain("Docker");
  });

  it("does not include feedback section when evaluationFeedback is omitted", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.user).not.toContain("Previous Attempt Feedback");
  });

  it("does not include feedback section when evaluationFeedback is undefined", () => {
    const result = buildCurateResumePrompt("Resume", "Job", undefined);
    expect(result.user).not.toContain("Previous Attempt Feedback");
  });

  it("system prompt includes Yale OCS bullet writing framework", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("Yale OCS");
    expect(result.system).toContain("Action verb");
  });

  it("system prompt requires ranking bullets by job relevance", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("descending relevance");
  });

  it("system prompt requires quantification of results", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("Quantify");
  });

  it("system prompt prohibits weasel words like 'leveraged' and 'utilized'", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("leveraged");
    expect(result.system).toContain("utilized");
    expect(result.system).toContain("spearheaded");
  });

  it("system prompt includes language quality rule with action verbs", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("Language quality");
    expect(result.system).toContain("action verbs");
  });

  it("system prompt includes curated phrase __ marker rule", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("__curated text__");
    expect(result.system).toContain("__double underscores__");
  });

  it("system prompt includes content preservation rule (no silent drops)", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("Content preservation");
    expect(result.system).toContain("silently dropped");
  });

  it("system prompt includes 'Accomplished [X] as measured by [Y] by doing [Z]' pattern", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("Accomplished [X] as measured by [Y] by doing [Z]");
  });

  it("system prompt prohibits passive team verbs like 'Worked on' and 'Helped with'", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("Worked on");
    expect(result.system).toContain("Helped with");
  });

  it("system prompt requires individual contribution framing", () => {
    const result = buildCurateResumePrompt("Resume", "Job");
    expect(result.system).toContain("individual contribution");
  });
});
