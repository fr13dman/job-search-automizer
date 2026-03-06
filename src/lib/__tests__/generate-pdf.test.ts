import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSave = vi.fn();
const mockText = vi.fn();
const mockAddPage = vi.fn();
const mockSplitTextToSize = vi.fn();
const mockSetFont = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetTextColor = vi.fn();
const mockSetDrawColor = vi.fn();
const mockSetLineWidth = vi.fn();
const mockLine = vi.fn();
const mockSetFillColor = vi.fn();
const mockRect = vi.fn();

vi.mock("jspdf", () => {
  return {
    default: function MockJsPDF() {
      return {
        internal: {
          pageSize: { getWidth: () => 210, getHeight: () => 297 },
        },
        setFont: mockSetFont,
        setFontSize: mockSetFontSize,
        setTextColor: mockSetTextColor,
        setDrawColor: mockSetDrawColor,
        setLineWidth: mockSetLineWidth,
        setFillColor: mockSetFillColor,
        rect: mockRect,
        line: mockLine,
        splitTextToSize: mockSplitTextToSize,
        text: mockText,
        getTextWidth: vi.fn(() => 50),
        addPage: mockAddPage,
        save: mockSave,
      };
    },
  };
});

import { downloadPdf } from "@/lib/generate-pdf";

describe("downloadPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSplitTextToSize.mockImplementation((text: string) => [text]);
  });

  it("does not render a candidate name header", () => {
    downloadPdf("Hello world", { candidateName: "John Doe" });

    // No 18pt font call — header removed
    const size18Call = mockSetFontSize.mock.calls.find(
      (call: unknown[]) => call[0] === 18
    );
    expect(size18Call).toBeUndefined();
  });

  it("does not draw a divider line", () => {
    downloadPdf("Body text", { candidateName: "John" });
    expect(mockLine).not.toHaveBeenCalled();
    expect(mockSetDrawColor).not.toHaveBeenCalled();
  });

  it("renders body text with paragraph spacing", () => {
    mockSplitTextToSize.mockImplementation((text: string) => [text]);

    downloadPdf("Paragraph one.\n\nParagraph two.\n\nParagraph three.");

    // Should have called text for each paragraph's content
    const bodyTextCalls = mockText.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        (call[0].includes("Paragraph one") ||
          call[0].includes("Paragraph two") ||
          call[0].includes("Paragraph three"))
    );
    expect(bodyTextCalls.length).toBe(3);
  });

  it("strips bold markers and renders body as plain text", () => {
    downloadPdf("I **achieved 40% growth** in revenue.");

    // Bold font should NOT be called for body text
    const boldBodyCalls = mockSetFont.mock.calls.filter(
      (call: unknown[]) => call[1] === "bold"
    );
    expect(boldBodyCalls.length).toBe(0);

    // The text should be rendered without ** markers
    const textCall = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("achieved 40% growth")
    );
    expect(textCall).toBeDefined();
    expect(textCall![0]).not.toContain("**");
  });

  it("renders the last line of each paragraph left-aligned", () => {
    mockSplitTextToSize.mockImplementation((text: string) => [text]);
    downloadPdf("Single line paragraph.");

    const textCall = mockText.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" && call[0].includes("Single line")
    );
    expect(textCall).toBeDefined();
    // Last (only) line: align=left
    expect(textCall![3]).toMatchObject({ align: "left" });
  });

  it("renders non-last lines of a paragraph as justified", () => {
    mockSplitTextToSize.mockImplementation((text: string) => [
      "First wrapped line of text",
      "Last line",
    ]);
    downloadPdf("Some long paragraph text.");

    const justifiedCall = mockText.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        call[0].includes("First wrapped") &&
        (call[3] as Record<string, unknown>)?.align === "justify"
    );
    expect(justifiedCall).toBeDefined();
  });

  it("saves with provided filename", () => {
    downloadPdf("Hello", {}, "custom-name.pdf");

    expect(mockSave).toHaveBeenCalledWith("custom-name.pdf");
  });

  it("saves with default filename when none provided", () => {
    downloadPdf("Hello");

    expect(mockSave).toHaveBeenCalledWith("cover-letter.pdf");
  });

  it("stays within one page even with long content", () => {
    const manyLines = Array.from({ length: 60 }, (_, i) => `Line ${i}`);
    mockSplitTextToSize.mockReturnValue(manyLines);

    downloadPdf(manyLines.join("\n\n"));

    // Cover letter is always single-page — no addPage call
    expect(mockAddPage).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });
});
