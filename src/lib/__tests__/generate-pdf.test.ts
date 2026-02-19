import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSave = vi.fn();
const mockText = vi.fn();
const mockAddPage = vi.fn();
const mockSplitTextToSize = vi.fn();

vi.mock("jspdf", () => {
  return {
    default: function MockJsPDF() {
      return {
        internal: {
          pageSize: { getWidth: () => 210, getHeight: () => 297 },
        },
        setFont: vi.fn(),
        setFontSize: vi.fn(),
        splitTextToSize: mockSplitTextToSize,
        text: mockText,
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
  });

  it("calls jsPDF constructor and save method", () => {
    mockSplitTextToSize.mockReturnValue(["Line 1", "Line 2"]);

    downloadPdf("Line 1\nLine 2");

    expect(mockText).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith("cover-letter.pdf");
  });

  it("handles multi-page text correctly", () => {
    const manyLines = Array.from({ length: 50 }, (_, i) => `Line ${i}`);
    mockSplitTextToSize.mockReturnValue(manyLines);

    downloadPdf(manyLines.join("\n"));

    expect(mockAddPage).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });
});
