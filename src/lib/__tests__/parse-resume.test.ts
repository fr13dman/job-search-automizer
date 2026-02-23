import { describe, it, expect, vi } from "vitest";

let pdfBehavior: "normal" | "corrupt" | "empty" | "whitespace-only" = "normal";

const mockExtractText = vi.fn(async (_data: unknown, options?: { mergePages?: boolean }) => {
  if (pdfBehavior === "corrupt") throw new Error("Invalid PDF");
  if (pdfBehavior === "empty") {
    return options?.mergePages ? { text: "", totalPages: 0 } : { text: [], totalPages: 0 };
  }
  if (pdfBehavior === "whitespace-only") {
    return options?.mergePages
      ? { text: "   \n\n  ", totalPages: 1 }
      : { text: ["   \n\n  "], totalPages: 1 };
  }
  return options?.mergePages
    ? { text: "John Doe\nSoftware Engineer\n5 years experience", totalPages: 1 }
    : { text: ["John Doe\nSoftware Engineer\n5 years experience"], totalPages: 1 };
});

vi.mock("unpdf", () => ({
  extractText: mockExtractText,
}));

vi.mock("mammoth", () => ({
  extractRawText: vi.fn(async ({ buffer }: { buffer: Buffer }) => {
    const text = buffer.toString();
    if (text === "corrupt") throw new Error("Invalid DOCX");
    if (text === "empty") return { value: "" };
    return { value: "Jane Smith\nProduct Manager\n3 years experience" };
  }),
}));

import { parseResume } from "@/lib/parse-resume";

describe("parseResume", () => {
  it("parses a PDF buffer and returns text", async () => {
    pdfBehavior = "normal";
    const buffer = Buffer.from("valid pdf content");
    const result = await parseResume(buffer, "resume.pdf");
    expect(result.success).toBe(true);
    expect(result.resumeText).toContain("John Doe");
    expect(result.resumeText).toContain("Software Engineer");
  });

  it("calls extractText with mergePages: true so text is a string not an array", async () => {
    pdfBehavior = "normal";
    mockExtractText.mockClear();
    const buffer = Buffer.from("valid pdf content");
    await parseResume(buffer, "resume.pdf");
    expect(mockExtractText).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      { mergePages: true }
    );
  });

  it("returns resumeText as a plain string, not an array", async () => {
    pdfBehavior = "normal";
    const buffer = Buffer.from("valid pdf content");
    const result = await parseResume(buffer, "resume.pdf");
    expect(result.success).toBe(true);
    expect(typeof result.resumeText).toBe("string");
    expect(Array.isArray(result.resumeText)).toBe(false);
  });

  it("parses a DOCX buffer and returns text", async () => {
    const buffer = Buffer.from("valid docx content");
    const result = await parseResume(buffer, "resume.docx");
    expect(result.success).toBe(true);
    expect(result.resumeText).toContain("Jane Smith");
  });

  it("returns error for unsupported file types", async () => {
    const buffer = Buffer.from("some text");
    const result = await parseResume(buffer, "resume.txt");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unsupported file type");
  });

  it("returns error for corrupt files", async () => {
    pdfBehavior = "corrupt";
    const buffer = Buffer.from("corrupt");
    const result = await parseResume(buffer, "resume.pdf");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to parse");
  });

  it("returns error for empty PDF with no text content", async () => {
    pdfBehavior = "empty";
    const buffer = Buffer.from("empty");
    const result = await parseResume(buffer, "resume.pdf");
    expect(result.success).toBe(false);
    expect(result.error).toContain("No text found");
  });

  it("returns error for PDF with whitespace-only text", async () => {
    pdfBehavior = "whitespace-only";
    const buffer = Buffer.from("whitespace pdf");
    const result = await parseResume(buffer, "resume.pdf");
    expect(result.success).toBe(false);
    expect(result.error).toContain("No text found");
  });
});
