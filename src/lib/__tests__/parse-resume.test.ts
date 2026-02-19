import { describe, it, expect, vi } from "vitest";

let pdfLoadBehavior: "normal" | "corrupt" | "empty" | "whitespace-only" | "missing-text-field" = "normal";

vi.mock("pdf-parse", () => {
  return {
    PDFParse: function MockPDFParse() {
      return {
        load: async () => {
          if (pdfLoadBehavior === "corrupt") throw new Error("Invalid PDF");
        },
        getText: async () => {
          if (pdfLoadBehavior === "empty") return { pages: [], text: "", total: 0 };
          if (pdfLoadBehavior === "whitespace-only") return { pages: [], text: "   \n\n  ", total: 1 };
          if (pdfLoadBehavior === "missing-text-field") return { pages: [], total: 0 };
          return {
            pages: [{ text: "John Doe\nSoftware Engineer\n5 years experience", num: 1 }],
            text: "John Doe\nSoftware Engineer\n5 years experience",
            total: 1,
          };
        },
      };
    },
  };
});

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
    pdfLoadBehavior = "normal";
    const buffer = Buffer.from("valid pdf content");
    const result = await parseResume(buffer, "resume.pdf");
    expect(result.success).toBe(true);
    expect(result.resumeText).toContain("John Doe");
    expect(result.resumeText).toContain("Software Engineer");
  });

  it("extracts text from the getText().text property (not the raw object)", async () => {
    pdfLoadBehavior = "normal";
    const buffer = Buffer.from("valid pdf content");
    const result = await parseResume(buffer, "resume.pdf");
    expect(result.success).toBe(true);
    // Ensure we got a plain string, not "[object Object]"
    expect(result.resumeText).not.toContain("[object Object]");
    expect(typeof result.resumeText).toBe("string");
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
    pdfLoadBehavior = "corrupt";
    const buffer = Buffer.from("corrupt");
    const result = await parseResume(buffer, "resume.pdf");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to parse");
  });

  it("returns error for empty PDF with no text content", async () => {
    pdfLoadBehavior = "empty";
    const buffer = Buffer.from("empty");
    const result = await parseResume(buffer, "resume.pdf");
    expect(result.success).toBe(false);
    expect(result.error).toContain("No text found");
  });

  it("returns error for PDF with whitespace-only text", async () => {
    pdfLoadBehavior = "whitespace-only";
    const buffer = Buffer.from("whitespace pdf");
    const result = await parseResume(buffer, "resume.pdf");
    expect(result.success).toBe(false);
    expect(result.error).toContain("No text found");
  });

  it("returns error when getText result has no text field", async () => {
    pdfLoadBehavior = "missing-text-field";
    const buffer = Buffer.from("bad pdf");
    const result = await parseResume(buffer, "resume.pdf");
    expect(result.success).toBe(false);
    expect(result.error).toContain("No text found");
  });
});
