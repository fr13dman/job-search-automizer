import { describe, it, expect } from "vitest";
import { extractMetadata, buildPdfFilename } from "@/lib/extract-metadata";

describe("extractMetadata", () => {
  const sampleLetter = `Dear Hiring Manager,

I am excited to apply for the Senior Software Engineer position at Acme Corp. With over 8 years of experience building scalable web applications, I believe I can make a strong contribution to your team.

**I led a team of 5 engineers that rebuilt our payment system, reducing transaction failures by 40% and saving $2M annually.**

I would love the opportunity to bring this same drive to Acme Corp as your next Senior Software Engineer.

Sincerely,
John Doe`;

  const sampleJobDescription = `Senior Software Engineer
Company: Acme Corp
Location: San Francisco, CA

We are looking for a Senior Software Engineer to join our platform team...`;

  it("extracts candidate name from sign-off", () => {
    const result = extractMetadata(sampleLetter, sampleJobDescription);
    expect(result.candidateName).toBe("John Doe");
  });

  it("extracts company name from job description 'Company:' field", () => {
    const result = extractMetadata(sampleLetter, sampleJobDescription);
    expect(result.companyName).toBe("Acme Corp");
  });

  it("extracts job title from job description first line", () => {
    const result = extractMetadata(sampleLetter, sampleJobDescription);
    expect(result.jobTitle).toBe("Senior Software Engineer");
  });

  it("extracts company from 'at CompanyName' in cover letter when JD lacks it", () => {
    const result = extractMetadata(sampleLetter, "We need an engineer to build things.");
    expect(result.companyName).toBe("Acme Corp");
  });

  it("extracts job title from 'for the X position' in cover letter", () => {
    const letter = "I am writing to apply for the Data Analyst position at Google.\n\nSincerely,\nJane Smith";
    const result = extractMetadata(letter, "Looking for someone great.");
    expect(result.jobTitle).toBe("Data Analyst");
  });

  it("extracts company from JD 'About X' pattern", () => {
    const jd = "About Netflix\n\nWe are the world's leading streaming service...";
    const result = extractMetadata("Dear Hiring Manager,\n\nSincerely,\nJohn Doe", jd);
    expect(result.companyName).toBe("Netflix");
  });

  it("extracts company from JD 'X is hiring' pattern", () => {
    const jd = "Stripe is hiring a Backend Engineer\n\nJoin our team...";
    const result = extractMetadata("Dear Hiring Manager,\n\nSincerely,\nJohn Doe", jd);
    expect(result.companyName).toBe("Stripe");
  });

  it("extracts candidate name with bold markdown in sign-off", () => {
    const letter = "Some content.\n\nBest regards,\n**Jane O'Brien**";
    const result = extractMetadata(letter, "");
    expect(result.candidateName).toBe("Jane O'Brien");
  });

  it("extracts job title from JD 'Job Title:' field", () => {
    const jd = "Job Title: Product Manager\nCompany: Meta\nLocation: Remote";
    const result = extractMetadata("Dear Hiring Manager,\n\nSincerely,\nJohn Doe", jd);
    expect(result.jobTitle).toBe("Product Manager");
    expect(result.companyName).toBe("Meta");
  });

  it("returns empty metadata when nothing matches", () => {
    const result = extractMetadata("hello world", "some generic text");
    expect(result.candidateName).toBeUndefined();
    expect(result.companyName).toBeUndefined();
    expect(result.jobTitle).toBeUndefined();
  });
});

describe("buildPdfFilename", () => {
  it("builds filename with all metadata", () => {
    const result = buildPdfFilename({
      companyName: "Acme Corp",
      jobTitle: "Software Engineer",
    });
    expect(result).toMatch(/^Cover-Letter_Acme-Corp_Software-Engineer_\d{4}\.pdf$/);
  });

  it("builds filename with only company", () => {
    const result = buildPdfFilename({ companyName: "Google" });
    expect(result).toMatch(/^Cover-Letter_Google_\d{4}\.pdf$/);
  });

  it("builds filename with no metadata", () => {
    const result = buildPdfFilename({});
    expect(result).toMatch(/^Cover-Letter_\d{4}\.pdf$/);
  });
});
