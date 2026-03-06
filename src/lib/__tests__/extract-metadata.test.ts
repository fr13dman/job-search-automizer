import { describe, it, expect } from "vitest";
import { extractMetadata, extractContactInfo, buildPdfFilename, buildResumeFilename, buildCoverLetterDocxFilename } from "@/lib/extract-metadata";

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

  it("extracts job title from collapsed single-line JD (scraped text with · separators)", () => {
    // When no cover letter mention, JD fallback uses · as separator
    const jd = "Software Engineer · Acme Corp · San Francisco, CA · Full-time About the job We are looking for...";
    const result = extractMetadata("Dear Hiring Manager,\n\nSincerely,\nJohn Doe", jd);
    expect(result.jobTitle).toBe("Software Engineer");
  });

  it("extracts job title from collapsed JD with em-dash separator", () => {
    const jd = "Backend Engineer – Acme Corp – New York";
    const result = extractMetadata("Dear Hiring Manager,\n\nSincerely,\nJohn Doe", jd);
    expect(result.jobTitle).toBe("Backend Engineer");
  });

  it("cover letter takes priority over JD for job title extraction", () => {
    // Even when JD has | separators that could hint at structure, the cover letter
    // is preferred because | also appears in location lists, making it unreliable.
    const letter = "I am applying for the Senior Data Scientist position at Stripe.\n\nSincerely,\nJane Smith";
    const jd = "Senior Data Scientist | Stripe | Remote | Full-time";
    const result = extractMetadata(letter, jd);
    expect(result.jobTitle).toBe("Senior Data Scientist");
  });

  it("uses cover letter to extract title correctly for Greenhouse JD with navigation text", () => {
    // Greenhouse pages embed "Back to jobs" inside <main>. Cheerio concatenates
    // adjacent DOM elements without whitespace ("Back to jobsDirector..."). The cover
    // letter is tried first and extracts the clean title from Claude's generated text.
    const letter = "I am excited to apply for the Director of Platform Engineering position at Overstory.\n\nSincerely,\nJohn Doe";
    const jd = "Back to jobsDirector of Platform EngineeringUnited States | Canada | United Kingdom Apply The climate crisis is the defining challenge...";
    const result = extractMetadata(letter, jd);
    expect(result.jobTitle).toBe("Director of Platform Engineering");
  });

  it("strips 'Back to jobs' from JD when cover letter gives no match (JD fallback)", () => {
    // If a cover letter has no recognisable title phrasing, the JD fallback
    // strips the navigation prefix before matching.
    const letter = "Dear Hiring Manager,\n\nSincerely,\nJohn Doe";
    const jd = "Back to jobs Director of Platform Engineering · Overstory · United States";
    const result = extractMetadata(letter, jd);
    expect(result.jobTitle).toBe("Director of Platform Engineering");
  });

  it("extracts job title from cover letter 'the X position' (without 'for')", () => {
    const letter = "I am thrilled about the Product Manager position and believe my background aligns perfectly.\n\nSincerely,\nJane Smith";
    const result = extractMetadata(letter, "We are looking for someone great.");
    expect(result.jobTitle).toBe("Product Manager");
  });

  it("extracts job title from cover letter 'as a X to join' phrasing", () => {
    const letter = "I am eager to join Acme Corp as a Senior Software Engineer to help scale the platform.\n\nSincerely,\nJohn Doe";
    const result = extractMetadata(letter, "We are looking for someone great.");
    expect(result.jobTitle).toBe("Senior Software Engineer");
  });

  it("extracts Paysafe / VP Payments Engineering from realistic scraped JD + cover letter", () => {
    // Simulates scraped text from https://jobs.paysafe.com/job/Jacksonville-VP-Payments-Engineering-FL-32256/1362676600/
    const paysafeJd = `VP Payments Engineering
Jacksonville, FL, US 32256
Full-time · Posted Feb 6, 2026

About Paysafe
Paysafe is a leading specialized payments platform with a purpose: to enable businesses and consumers to connect and transact seamlessly through our future-focused payment solutions.

About the Role
This is a high-visibility transformation role reporting directly to the SVP Payments Engineering. You will own the technical heart of Paysafe's Platform: authorization engine, payment gateway, intelligent routing, and real-time fraud detection.

Requirements
- 10+ years payments technology experience; 5+ years senior leadership
- Experience with high-scale systems (5,000+ peak TPS, 99.99% uptime)
- $300B+ annual payment volume experience preferred`;

    const paysafeLetter = `Dear Hiring Manager,

I am thrilled to apply for the VP Payments Engineering position at Paysafe. With 12 years leading high-scale payment infrastructure and a track record of building resilient authorization engines, I am confident I can drive the transformation you need.

Sincerely,
Jane Smith`;

    const result = extractMetadata(paysafeLetter, paysafeJd);
    expect(result.companyName).toBe("Paysafe");
    expect(result.jobTitle).toBe("VP Payments Engineering");
  });
});

describe("buildPdfFilename", () => {
  it("builds filename with company and position (no candidate name)", () => {
    const result = buildPdfFilename({
      companyName: "Acme Corp",
      jobTitle: "Software Engineer",
      candidateName: "Jane Doe",
    });
    expect(result).toBe("acme-corp-software-engineer-cover-letter.pdf");
  });

  it("builds filename with only company", () => {
    const result = buildPdfFilename({ companyName: "Google" });
    expect(result).toBe("google-cover-letter.pdf");
  });

  it("builds filename with no metadata", () => {
    const result = buildPdfFilename({});
    expect(result).toBe("cover-letter.pdf");
  });

  it("slugifies company name with special characters", () => {
    const result = buildPdfFilename({ companyName: "Acme & Corp", jobTitle: "Sr. Engineer" });
    expect(result).toBe("acme-corp-sr-engineer-cover-letter.pdf");
  });

  it("produces correct filename for Paysafe VP Payments Engineering", () => {
    // Template: {company-name}-{position}-cover-letter
    const result = buildPdfFilename({
      companyName: "Paysafe",
      jobTitle: "VP Payments Engineering",
    });
    expect(result).toBe("paysafe-vp-payments-engineering-cover-letter.pdf");
  });

  it("falls back to company-cover-letter when slug exceeds 45 chars", () => {
    // "acme-corp-director-of-platform-engineering-cover-letter" = 55 chars → truncate
    const result = buildPdfFilename({
      companyName: "Acme Corp",
      jobTitle: "Director of Platform Engineering",
    });
    expect(result).toBe("acme-corp-cover-letter.pdf");
  });

  it("does not truncate when slug is exactly 45 chars", () => {
    // "stripe-senior-software-engineer-cover-letter" = 44 chars → keep
    const result = buildPdfFilename({
      companyName: "Stripe",
      jobTitle: "Senior Software Engineer",
    });
    expect(result.length).toBeLessThanOrEqual(45 + ".pdf".length);
    expect(result).toContain("senior-software-engineer");
  });
});

describe("buildCoverLetterDocxFilename", () => {
  it("builds DOCX filename with company and position (no candidate name)", () => {
    const result = buildCoverLetterDocxFilename({
      companyName: "Acme Corp",
      jobTitle: "Software Engineer",
      candidateName: "Jane Doe",
    });
    expect(result).toBe("acme-corp-software-engineer-cover-letter.docx");
  });

  it("builds DOCX filename with only company", () => {
    const result = buildCoverLetterDocxFilename({ companyName: "Google" });
    expect(result).toBe("google-cover-letter.docx");
  });

  it("builds DOCX filename with no metadata", () => {
    const result = buildCoverLetterDocxFilename({});
    expect(result).toBe("cover-letter.docx");
  });
});

describe("buildResumeFilename", () => {
  it("orders parts as company-position-resume (no candidate name)", () => {
    const resume = "John Doe\nSoftware Engineer\nExperience...";
    const jd = "Senior Engineer\nCompany: Acme Corp";
    const result = buildResumeFilename(resume, jd);
    expect(result).toBe("acme-corp-senior-engineer-resume");
  });

  it("always ends with 'resume'", () => {
    const result = buildResumeFilename("", "");
    expect(result).toBe("resume");
  });

  it("extracts company and position from job description", () => {
    const resume = "SKILLS\n- TypeScript";
    const jd = "Job Title: Data Analyst\nCompany: Meta";
    const result = buildResumeFilename(resume, jd);
    expect(result).toBe("meta-data-analyst-resume");
  });

  it("returns only 'resume' when job description has no extractable company or title", () => {
    const resume = "EXPERIENCE\nJane Smith\n- Built systems";
    const jd = "";
    const result = buildResumeFilename(resume, jd);
    expect(result).toBe("resume");
  });

  it("returns only 'resume' when job description is empty", () => {
    const resume = "O'Brien, Mary-Kate\nSoftware Lead";
    const jd = "";
    const result = buildResumeFilename(resume, jd);
    expect(result).toBe("resume");
  });

  it("omits empty parts and does not produce double hyphens", () => {
    const resume = "Alice Johnson\nEngineer";
    const jd = ""; // no extractable company/title
    const result = buildResumeFilename(resume, jd);
    expect(result).not.toMatch(/--/);
    expect(result).toBe("resume");
  });

  it("extracts company and position regardless of resume content", () => {
    const resume = "**John Doe**\nSoftware Engineer";
    const jd = "Senior Engineer\nCompany: Acme Corp";
    const result = buildResumeFilename(resume, jd);
    expect(result).toBe("acme-corp-senior-engineer-resume");
  });

  it("uses job description only — resume contact details do not affect filename", () => {
    const resume = "John Doe | 555-123-4567 | john@email.com\nSoftware Engineer";
    const jd = "Senior Engineer\nCompany: Acme Corp";
    const result = buildResumeFilename(resume, jd);
    expect(result).not.toContain("555");
    expect(result).not.toContain("john-doe");
    expect(result).toBe("acme-corp-senior-engineer-resume");
  });

  it("extracts position from JD 'Data Analyst' field", () => {
    const resume = "Jane Smith 555-987-6543\nData Analyst";
    const jd = "Data Analyst\nCompany: Meta";
    const result = buildResumeFilename(resume, jd);
    expect(result).not.toContain("555");
    expect(result).not.toContain("jane-smith");
    expect(result).toBe("meta-data-analyst-resume");
  });

  it("uses company from JD when present", () => {
    const resume = "Alice Johnson | alice@example.com\nSoftware Lead";
    const jd = "Company: Stripe";
    const result = buildResumeFilename(resume, jd);
    expect(result).not.toContain("alice-johnson");
    expect(result).toBe("stripe-resume");
  });

  it("handles inline contact header — only JD data used for filename", () => {
    const resume = "Bob Lee | bob@email.com | +1-800-555-0199 | linkedin.com/in/boblee\nSenior Developer";
    const jd = "Company: Acme Corp\nJob Title: Senior Developer";
    const result = buildResumeFilename(resume, jd);
    expect(result).toBe("acme-corp-senior-developer-resume");
  });

  it("full pipeline: company-position-resume with all JD parts present", () => {
    const resume = "Jane Smith\nFrontend Developer\n\nSKILLS\nReact, TypeScript";
    const jd = "Software Engineer\nCompany: Stripe\n\nWe are looking for an engineer...";
    const result = buildResumeFilename(resume, jd);
    expect(result).toBe("stripe-software-engineer-resume");
  });

  it("no trailing or leading hyphens in any filename", () => {
    const result1 = buildResumeFilename("", "");
    const result2 = buildResumeFilename("", "Company: Acme");
    const result3 = buildResumeFilename("Jane Doe\nEngineer", "");
    expect(result1).not.toMatch(/^-|-$/);
    expect(result2).not.toMatch(/^-|-$/);
    expect(result3).not.toMatch(/^-|-$/);
  });

  it("falls back to company-resume when slug exceeds 45 chars", () => {
    // "acme-corp-director-of-platform-engineering-resume" = 49 chars → truncate
    const resume = "Jane Smith\nEngineer";
    const jd = "Director of Platform Engineering\nCompany: Acme Corp";
    const result = buildResumeFilename(resume, jd);
    expect(result).toBe("acme-corp-resume");
  });

  it("does not truncate resume filename when slug is within 45 chars", () => {
    // "meta-data-analyst-resume" = 24 chars → keep
    const resume = "Jane Smith\nAnalyst";
    const jd = "Job Title: Data Analyst\nCompany: Meta";
    const result = buildResumeFilename(resume, jd);
    expect(result).toBe("meta-data-analyst-resume");
  });
});

describe("extractContactInfo", () => {
  it("extracts email from contact block", () => {
    const resume = "John Doe\njohn.doe@example.com\n555-123-4567\nSan Francisco, CA\n\nEXPERIENCE";
    const result = extractContactInfo(resume);
    expect(result.email).toBe("john.doe@example.com");
  });

  it("extracts phone with parentheses format", () => {
    const resume = "Jane Smith\n(415) 555-9876\njane@email.com";
    const result = extractContactInfo(resume);
    expect(result.phone).toBe("(415) 555-9876");
  });

  it("extracts phone with dot separator format", () => {
    const resume = "Bob Lee\nbob@email.com\n415.555.0199";
    const result = extractContactInfo(resume);
    expect(result.phone).toBe("415.555.0199");
  });

  it("extracts phone with +1 prefix", () => {
    const resume = "Alice Johnson\n+1 800 555 0100\nalice@example.com";
    const result = extractContactInfo(resume);
    expect(result.phone).toBe("+1 800 555 0100");
  });

  it("extracts city/state address line", () => {
    const resume = "John Doe\njohn@email.com\nSan Francisco, CA\n\nEXPERIENCE";
    const result = extractContactInfo(resume);
    expect(result.address).toBe("San Francisco, CA");
  });

  it("extracts city/state/zip address line", () => {
    const resume = "Jane Smith\njane@email.com\nNew York, NY 10001";
    const result = extractContactInfo(resume);
    expect(result.address).toBe("New York, NY 10001");
  });

  it("extracts street address starting with digits", () => {
    const resume = "Bob Lee\n123 Main Street\nbob@email.com";
    const result = extractContactInfo(resume);
    expect(result.address).toBe("123 Main Street");
  });

  it("returns undefined for missing fields", () => {
    const resume = "John Doe\nSoftware Engineer\n\nEXPERIENCE\nBuilt things.";
    const result = extractContactInfo(resume);
    expect(result.email).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(result.address).toBeUndefined();
  });

  it("only scans the first 10 lines — ignores contact-like data deeper in the resume", () => {
    const lines = [
      "John Doe",
      "Software Engineer",
      "", "", "", "", "", "", "", "", // lines 3–10
      "john@email.com", // line 11 — should NOT be found
      "555-000-1234",   // line 12 — should NOT be found
    ];
    const result = extractContactInfo(lines.join("\n"));
    expect(result.email).toBeUndefined();
    expect(result.phone).toBeUndefined();
  });

  it("extractMetadata with resumeText populates phone/email/address in metadata", () => {
    const resume = "Jane Smith\njane@work.com\n(650) 555-7890\nAustin, TX";
    const letter = "Dear Hiring Manager,\n\nI am excited to apply.\n\nSincerely,\nJane Smith";
    const jd = "Software Engineer\nCompany: Acme Corp";
    const result = extractMetadata(letter, jd, resume);
    expect(result.email).toBe("jane@work.com");
    expect(result.phone).toBe("(650) 555-7890");
    expect(result.address).toBe("Austin, TX");
  });

  it("extractMetadata without resumeText leaves phone/email/address undefined", () => {
    const letter = "Dear Hiring Manager,\n\nSincerely,\nJohn Doe";
    const jd = "Engineer\nCompany: Stripe";
    const result = extractMetadata(letter, jd);
    expect(result.phone).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.address).toBeUndefined();
  });
});
