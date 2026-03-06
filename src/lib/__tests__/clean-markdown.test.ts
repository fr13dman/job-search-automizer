import { describe, it, expect } from "vitest";
import { stripNonBoldMarkdown, stripCuratedMarkers, stripLetterHeader } from "@/lib/clean-markdown";

describe("stripNonBoldMarkdown", () => {
  it("returns plain text unchanged", () => {
    const text = "Hello world\nThis is a plain line";
    expect(stripNonBoldMarkdown(text)).toBe(text);
  });

  it("removes heading markers (# h1 through ###### h6)", () => {
    const text = "# Heading 1\n## Heading 2\n### Heading 3";
    expect(stripNonBoldMarkdown(text)).toBe("Heading 1\nHeading 2\nHeading 3");
  });

  it("removes horizontal rule ---", () => {
    const text = "Above\n---\nBelow";
    expect(stripNonBoldMarkdown(text)).toBe("Above\n\nBelow");
  });

  it("removes horizontal rule ***", () => {
    const text = "Above\n***\nBelow";
    expect(stripNonBoldMarkdown(text)).toBe("Above\n\nBelow");
  });

  it("removes horizontal rule ___", () => {
    const text = "Above\n___\nBelow";
    expect(stripNonBoldMarkdown(text)).toBe("Above\n\nBelow");
  });

  it("strips *italic* markers but preserves text", () => {
    const text = "This is *italic* text";
    expect(stripNonBoldMarkdown(text)).toBe("This is italic text");
  });

  it("strips _italic_ markers but preserves text", () => {
    const text = "This is _italic_ text";
    expect(stripNonBoldMarkdown(text)).toBe("This is italic text");
  });

  it("preserves **bold** markers", () => {
    const text = "This is **bold** text";
    expect(stripNonBoldMarkdown(text)).toBe("This is **bold** text");
  });

  it("strips inline code backticks but preserves code text", () => {
    const text = "Use `npm install` to install";
    expect(stripNonBoldMarkdown(text)).toBe("Use npm install to install");
  });

  it("strips [link](url) and keeps link text", () => {
    const text = "Visit [Google](https://google.com) for more";
    expect(stripNonBoldMarkdown(text)).toBe("Visit Google for more");
  });

  it("strips blockquote > markers", () => {
    const text = "> This is a quote\n> Second line";
    expect(stripNonBoldMarkdown(text)).toBe("This is a quote\nSecond line");
  });

  it("collapses 3+ blank lines to 2", () => {
    const text = "A\n\n\n\nB";
    expect(stripNonBoldMarkdown(text)).toBe("A\n\nB");
  });

  it("does not affect ALL CAPS section headings (plain text)", () => {
    const text = "EXPERIENCE\nSOFTWARE ENGINEER";
    expect(stripNonBoldMarkdown(text)).toBe("EXPERIENCE\nSOFTWARE ENGINEER");
  });

  it("does not affect bullet points starting with - or •", () => {
    const text = "- Led team\n• Shipped features";
    expect(stripNonBoldMarkdown(text)).toBe("- Led team\n• Shipped features");
  });

  it("handles combined markdown in realistic resume output", () => {
    const input = "# EXPERIENCE\n\n**Senior Engineer** — Acme Corp\n- *Led* backend team\n---\nEDUCATION";
    const output = stripNonBoldMarkdown(input);
    expect(output).toContain("**Senior Engineer**");
    expect(output).toContain("EXPERIENCE");
    expect(output).not.toContain("# EXPERIENCE");
    expect(output).not.toContain("*Led*");
    expect(output).toContain("Led");
    expect(output).not.toContain("---");
  });
});

describe("stripCuratedMarkers", () => {
  it("removes __ delimiters while keeping inner text", () => {
    expect(stripCuratedMarkers("__optimized pipeline__")).toBe("optimized pipeline");
  });

  it("preserves surrounding text", () => {
    expect(stripCuratedMarkers("Led __cloud migration__ for three teams")).toBe(
      "Led cloud migration for three teams"
    );
  });

  it("handles multiple curated markers in one string", () => {
    expect(stripCuratedMarkers("__built__ scalable __microservices__")).toBe(
      "built scalable microservices"
    );
  });

  it("does not touch **bold** markers", () => {
    expect(stripCuratedMarkers("**Senior Engineer** at __Acme Corp__")).toBe(
      "**Senior Engineer** at Acme Corp"
    );
  });

  it("returns plain text unchanged", () => {
    expect(stripCuratedMarkers("No markers here")).toBe("No markers here");
  });

  it("does not strip single-underscore italic patterns", () => {
    expect(stripCuratedMarkers("_italic_")).toBe("_italic_");
  });
});

describe("stripLetterHeader", () => {
  it("removes lines before 'Dear ...' when a header block is present", () => {
    const input = "Jane Doe\njane@example.com\n(555) 123-4567\n\nDear Hiring Manager,\n\nBody text.";
    const result = stripLetterHeader(input);
    expect(result).toBe("Dear Hiring Manager,\n\nBody text.");
  });

  it("leaves the text unchanged when it already starts with 'Dear'", () => {
    const input = "Dear Mr. Smith,\n\nThank you for your time.";
    expect(stripLetterHeader(input)).toBe(input);
  });

  it("handles blank lines before 'Dear'", () => {
    const input = "\n\nJohn Doe\n\nDear Team,\n\nBody.";
    expect(stripLetterHeader(input)).toBe("Dear Team,\n\nBody.");
  });

  it("is case-insensitive for the salutation", () => {
    const input = "Some Header\ndear sir or madam,\n\nBody.";
    expect(stripLetterHeader(input)).toBe("dear sir or madam,\n\nBody.");
  });

  it("strips leading contact lines when no 'Dear' is found", () => {
    const input = "jane@example.com\n(555) 123-4567\n\nBody paragraph with no salutation.";
    const result = stripLetterHeader(input);
    expect(result).not.toContain("jane@example.com");
    expect(result).not.toContain("555");
    expect(result).toContain("Body paragraph");
  });

  it("returns text unchanged when there is no header and no 'Dear'", () => {
    const input = "Just a plain paragraph with no contact info.";
    expect(stripLetterHeader(input)).toBe(input);
  });
});
