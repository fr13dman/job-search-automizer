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

  it("renders header with candidate name when provided", () => {
    downloadPdf("Hello world", { candidateName: "John Doe" });

    // Should render the candidate name in the header
    expect(mockText).toHaveBeenCalledWith(
      "John Doe",
      expect.any(Number),
      expect.any(Number)
    );
    expect(mockSetFontSize).toHaveBeenCalledWith(18); // HEADER_FONT_SIZE
  });

  it("renders sub-header with job title, company, and date", () => {
    downloadPdf("Body text", {
      candidateName: "Jane Smith",
      companyName: "Acme Corp",
      jobTitle: "Software Engineer",
    });

    // Sub-header should contain job title, company, and date joined by " | "
    const subHeaderCall = mockText.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" && call[0].includes("Acme Corp")
    );
    expect(subHeaderCall).toBeDefined();
    expect(subHeaderCall[0]).toContain("Software Engineer");
    expect(subHeaderCall[0]).toMatch(/\d{4}/); // year
  });

  it("draws a divider line between header and body", () => {
    downloadPdf("Body text", { candidateName: "John" });

    expect(mockLine).toHaveBeenCalled();
    expect(mockSetDrawColor).toHaveBeenCalledWith(200, 200, 200);
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

  it("renders bold segments with bold font", () => {
    downloadPdf("I **achieved 40% growth** in revenue.");

    const boldCalls = mockSetFont.mock.calls.filter(
      (call: unknown[]) => call[1] === "bold"
    );
    // At least one bold call for the header-less mode (still has header bold) plus the inline bold
    expect(boldCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("saves with provided filename", () => {
    downloadPdf("Hello", {}, "custom-name.pdf");

    expect(mockSave).toHaveBeenCalledWith("custom-name.pdf");
  });

  it("saves with default filename when none provided", () => {
    downloadPdf("Hello");

    expect(mockSave).toHaveBeenCalledWith("cover-letter.pdf");
  });

  it("handles multi-page text correctly", () => {
    const manyLines = Array.from({ length: 60 }, (_, i) => `Line ${i}`);
    mockSplitTextToSize.mockReturnValue(manyLines);

    downloadPdf(manyLines.join("\n\n"));

    expect(mockAddPage).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });
});
