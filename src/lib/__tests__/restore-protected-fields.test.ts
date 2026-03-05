import { describe, it, expect } from "vitest";
import { restoreProtectedFields } from "../restore-protected-fields";

const originalResume = `Jane Doe
jane@example.com | (555) 123-4567 | San Francisco, CA

EXPERIENCE
Software Engineer at Acme Corp, 2021–Present

EDUCATION
State University
B.S. Computer Science, 2019

SKILLS
Python, TypeScript`;

const curatedResume = `Jane Doe
jane@example.com | San Francisco, CA

EXPERIENCE
Senior Software Engineer at Acme Corp, 2021–Present

EDUCATION
State University
B.S. Computer Science, 2019

SKILLS
Python, TypeScript, React`;

describe("restoreProtectedFields", () => {
  it("restores the contact block when the curated version differs", () => {
    // curated is missing the phone number
    const { text, restorations } = restoreProtectedFields(
      curatedResume,
      originalResume
    );
    expect(text).toContain("(555) 123-4567");
    expect(restorations.some((r) => r.toLowerCase().includes("contact"))).toBe(true);
  });

  it("restores the EDUCATION section when curated education differs from original", () => {
    const modified = curatedResume.replace(
      "State University\nB.S. Computer Science, 2019",
      "Invented University\nM.S. Computer Science, 2020"
    );
    const { text, restorations } = restoreProtectedFields(
      modified,
      originalResume
    );
    expect(text).toContain("State University");
    expect(text).toContain("B.S. Computer Science, 2019");
    expect(text).not.toContain("Invented University");
    expect(text).not.toContain("M.S. Computer Science, 2020");
    expect(restorations.some((r) => r.toLowerCase().includes("education"))).toBe(true);
  });

  it("restores education even when original uses non-standard heading format", () => {
    const originalMarkdownHeadings = `Jane Doe
jane@example.com

**Work Experience**
Software Engineer at Acme Corp, 2021–Present

**Education**
State University
B.S. Computer Science, 2019`;

    const curatedWithWrongEdu = `Jane Doe
jane@example.com

EXPERIENCE
Software Engineer at Acme Corp

EDUCATION
Invented University
M.S. Computer Science, 2021

SKILLS
Python`;

    const { text } = restoreProtectedFields(curatedWithWrongEdu, originalMarkdownHeadings);
    expect(text).toContain("State University");
    expect(text).not.toContain("Invented University");
  });

  it("skips contact restoration when curated has no contact block (starts with a heading)", () => {
    const noContact = `EXPERIENCE
Software Engineer at Acme

EDUCATION
State University
B.S. Computer Science, 2019`;
    const { text, restorations } = restoreProtectedFields(
      noContact,
      originalResume
    );
    expect(restorations.some((r) => r.toLowerCase().includes("contact"))).toBe(false);
    expect(text).toContain("EXPERIENCE");
  });

  it("restorations array describes what was changed", () => {
    // curatedResume has contact without phone; original has phone → contact restored
    const { restorations } = restoreProtectedFields(curatedResume, originalResume);
    expect(restorations.length).toBeGreaterThan(0);
    restorations.forEach((r) => {
      expect(typeof r).toBe("string");
      expect(r.length).toBeGreaterThan(0);
    });
  });

  it("returns the curated text unchanged when contact block and education both match original", () => {
    const simple = `Bob Smith
bob@example.com

EDUCATION
MIT
B.S. EE, 2020

SKILLS
Python`;
    const { text, restorations } = restoreProtectedFields(simple, simple);
    expect(text).toBe(simple);
    expect(restorations).toHaveLength(0);
  });

  // Regression: original resume with no recognised section headings would cause
  // contactBlock = entire original, bloating the curated output when inserted.
  it("REGRESSION: does NOT bloat output when original has no detectable section headings", () => {
    const originalNoHeadings = `Jane Doe
jane@example.com | (555) 123-4567

**Work Experience**
Software Engineer at Acme Corp, 2021–Present
- Led projects, improved systems

**Education**
State University — B.S. Computer Science, 2019`;

    const curated = `Jane Doe
jane@example.com | San Francisco, CA

EXPERIENCE
Software Engineer at Acme Corp, 2021–Present

EDUCATION
State University
B.S. Computer Science, 2019

SKILLS
Python`;

    const { text } = restoreProtectedFields(curated, originalNoHeadings);

    expect(text).toContain("EXPERIENCE");
    expect(text).toContain("EDUCATION");
    expect(text).toContain("SKILLS");
    expect(text).not.toContain("**Work Experience**");
    expect(text).not.toContain("**Education**");
    // Output must not be dramatically longer than the curated input
    expect(text.length).toBeLessThan(curated.length + 200);
  });

  it("REGRESSION: does NOT inject content when original contact block contains bullet points", () => {
    // If the original has bullets in the "contact area" (detection failure), skip
    const bloatedOriginal = `Jane Doe
jane@example.com
- Led team of 10
- Built microservices`;
    const curated = `Jane Doe
jane@example.com

EXPERIENCE
Software Engineer`;

    const { text } = restoreProtectedFields(curated, bloatedOriginal);
    // Bullets in contactBlock → guard fires → contact not restored
    // No EDUCATION in either → no education restoration
    expect(text).toBe(curated);
  });

  it("REGRESSION: education restoration is bounded by 20-line cap (prevents bloat on unreliable originals)", () => {
    // Original has an education section followed by many lines that look like content
    // because heading detection doesn't recognize the next heading
    const originalWithPoorBoundary = `Jane Doe
jane@example.com

Education
State University
B.S. Computer Science, 2019
${Array.from({ length: 30 }, (_, i) => `Extra line ${i} not a heading`).join("\n")}`;

    const cleanCurated = `Jane Doe
jane@example.com

EXPERIENCE
Software Engineer

EDUCATION
Invented University
M.S. Computer Science, 2021

SKILLS
Python`;

    const { text } = restoreProtectedFields(cleanCurated, originalWithPoorBoundary);
    // Education should be restored (with cap applied)
    expect(text).toContain("State University");
    // SKILLS section must survive (not overwritten by education bloat)
    expect(text).toContain("SKILLS");
    expect(text).toContain("Python");
    // Education content in output must not exceed 20 lines
    const lines = text.split("\n");
    const eduIdx = lines.findIndex((l) => /^EDUCATION\b/i.test(l.trim()));
    const skillsIdx = lines.findIndex(
      (l, i) => i > eduIdx && /^SKILLS\b/i.test(l.trim())
    );
    if (eduIdx !== -1 && skillsIdx !== -1) {
      expect(skillsIdx - eduIdx - 1).toBeLessThanOrEqual(21); // 20 content lines + 1 blank separator
    }
  });
});
