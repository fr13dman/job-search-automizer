import { describe, it, expect } from "vitest";
import { extractResumeSections } from "../extract-resume-sections";

describe("extractResumeSections", () => {
  describe("contactBlock", () => {
    it("extracts lines before an ALL-CAPS section heading", () => {
      const resume = `Jane Doe
jane@example.com
San Francisco, CA

EXPERIENCE
Software Engineer at Acme`;
      const { contactBlock } = extractResumeSections(resume);
      expect(contactBlock).toContain("Jane Doe");
      expect(contactBlock).toContain("jane@example.com");
      expect(contactBlock).not.toContain("EXPERIENCE");
    });

    it("stops at an Education: colon-style heading", () => {
      const resume = `John Smith
john@example.com

Education:
B.S. Computer Science`;
      const { contactBlock } = extractResumeSections(resume);
      expect(contactBlock).toContain("John Smith");
      expect(contactBlock).not.toContain("Education:");
    });

    it("stops at a title-case heading (Experience)", () => {
      const resume = `Alice Chen
alice@example.com

Experience
Software Engineer`;
      const { contactBlock } = extractResumeSections(resume);
      expect(contactBlock).toContain("Alice Chen");
      expect(contactBlock).not.toContain("Experience");
    });

    it("returns empty string when document starts with a heading", () => {
      const resume = `EXPERIENCE
Software Engineer at Acme`;
      const { contactBlock } = extractResumeSections(resume);
      expect(contactBlock).toBe("");
    });

    it("is trimmed (no leading or trailing whitespace)", () => {
      const resume = `\n\nJane Doe\njane@example.com\n\nEXPERIENCE\n...`;
      const { contactBlock } = extractResumeSections(resume);
      expect(contactBlock).not.toMatch(/^\s/);
      expect(contactBlock).not.toMatch(/\s$/);
    });
  });

  describe("educationBlock", () => {
    it("extracts the section under EDUCATION (ALL CAPS)", () => {
      const resume = `Jane Doe

EXPERIENCE
Senior Engineer

EDUCATION
State University
B.S. Computer Science, 2019

SKILLS
Python`;
      const { educationBlock } = extractResumeSections(resume);
      expect(educationBlock).toContain("EDUCATION");
      expect(educationBlock).toContain("State University");
      expect(educationBlock).toContain("B.S. Computer Science, 2019");
      expect(educationBlock).not.toContain("SKILLS");
    });

    it("extracts the section under Education: (colon style)", () => {
      const resume = `Jane Doe

Education:
State University
B.S. Computer Science, 2019

Skills:
Python`;
      const { educationBlock } = extractResumeSections(resume);
      expect(educationBlock).toContain("State University");
      expect(educationBlock).not.toContain("Skills:");
    });

    it("extracts the section under Academic Background", () => {
      const resume = `Jane Doe

Academic Background
State University
B.S. Computer Science, 2019

Skills
Python`;
      const { educationBlock } = extractResumeSections(resume);
      expect(educationBlock).toContain("Academic Background");
      expect(educationBlock).toContain("State University");
      expect(educationBlock).not.toContain("Skills");
    });

    it("stops at the next section heading", () => {
      const resume = `EDUCATION
State University
B.S. CS, 2020

SKILLS
Python, JavaScript`;
      const { educationBlock } = extractResumeSections(resume);
      expect(educationBlock).not.toContain("SKILLS");
      expect(educationBlock).not.toContain("Python");
    });

    it("returns empty string when there is no education section", () => {
      const resume = `Jane Doe

EXPERIENCE
Software Engineer

SKILLS
Python`;
      const { educationBlock } = extractResumeSections(resume);
      expect(educationBlock).toBe("");
    });

    it("handles EDUCATION as the last section (no following heading)", () => {
      const resume = `Jane Doe

EXPERIENCE
Software Engineer

EDUCATION
State University
B.S. Computer Science, 2019`;
      const { educationBlock } = extractResumeSections(resume);
      expect(educationBlock).toContain("State University");
      expect(educationBlock).toContain("B.S. Computer Science, 2019");
    });

    it("handles EDUCATION & CERTIFICATIONS as the heading", () => {
      const resume = `Jane Doe

EDUCATION & CERTIFICATIONS
State University
B.S. Computer Science, 2019
AWS Certified Solutions Architect

SKILLS
Python`;
      const { educationBlock } = extractResumeSections(resume);
      expect(educationBlock).toContain("EDUCATION & CERTIFICATIONS");
      expect(educationBlock).toContain("State University");
      expect(educationBlock).not.toContain("SKILLS");
    });

    it("includes the heading line in the education block", () => {
      const resume = `Jane Doe

EDUCATION
State University`;
      const { educationBlock } = extractResumeSections(resume);
      expect(educationBlock.startsWith("EDUCATION")).toBe(true);
    });

    it("is trimmed (no leading or trailing whitespace)", () => {
      const resume = `EDUCATION
State University
B.S. CS, 2020
`;
      const { educationBlock } = extractResumeSections(resume);
      expect(educationBlock).not.toMatch(/^\s/);
      expect(educationBlock).not.toMatch(/\s$/);
    });
  });
});
