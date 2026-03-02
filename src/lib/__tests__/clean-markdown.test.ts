import { describe, it, expect } from "vitest";
import { stripNonBoldMarkdown } from "@/lib/clean-markdown";

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
