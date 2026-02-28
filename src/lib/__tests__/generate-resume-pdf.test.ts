import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSave = vi.fn();
const mockText = vi.fn();
const mockAddPage = vi.fn();
const mockSplitTextToSize = vi.fn();
const mockSetFont = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetDrawColor = vi.fn();
const mockSetLineWidth = vi.fn();
const mockLine = vi.fn();
const mockGetTextWidth = vi.fn(() => 10);

vi.mock("jspdf", () => ({
  default: function MockJsPDF() {
    return {
      internal: {
        pageSize: { getWidth: () => 210, getHeight: () => 297 },
      },
      setFont: mockSetFont,
      setFontSize: mockSetFontSize,
      setDrawColor: mockSetDrawColor,
      setLineWidth: mockSetLineWidth,
      line: mockLine,
      splitTextToSize: mockSplitTextToSize,
      text: mockText,
      addPage: mockAddPage,
      save: mockSave,
      getTextWidth: mockGetTextWidth,
    };
  },
}));

import { downloadResumePdf } from "@/lib/generate-resume-pdf";

describe("downloadResumePdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSplitTextToSize.mockImplementation((text: string) => [text]);
  });

  it("calls doc.save with the provided filename", async () => {
    await downloadResumePdf("John Doe\nSoftware Engineer", "my-resume.pdf");
    expect(mockSave).toHaveBeenCalledWith("my-resume.pdf");
  });

  it("uses default filename when none provided", async () => {
    await downloadResumePdf("Resume content");
    expect(mockSave).toHaveBeenCalledWith("curated-resume.pdf");
  });

  it("renders ALL CAPS lines as bold heading with large font", async () => {
    await downloadResumePdf("EXPERIENCE\nSome company");

    const boldFontCalls = mockSetFont.mock.calls.filter(
      (call: unknown[]) => call[1] === "bold"
    );
    expect(boldFontCalls.length).toBeGreaterThanOrEqual(1);

    const headingFontSizeCall = mockSetFontSize.mock.calls.find(
      (call: unknown[]) => call[0] === 10
    );
    expect(headingFontSizeCall).toBeDefined();
  });

  it("renders ALL CAPS heading text", async () => {
    await downloadResumePdf("EXPERIENCE");

    const headingTextCall = mockText.mock.calls.find(
      (call: unknown[]) => call[0] === "EXPERIENCE"
    );
    expect(headingTextCall).toBeDefined();
  });

  it("draws a divider line after ALL CAPS headings", async () => {
    await downloadResumePdf("EXPERIENCE");
    expect(mockLine).toHaveBeenCalled();
    expect(mockSetDrawColor).toHaveBeenCalledWith(180, 180, 180);
  });

  it("renders bullet lines with a bullet character", async () => {
    await downloadResumePdf("- Led backend team");

    const bulletCall = mockText.mock.calls.find(
      (call: unknown[]) => call[0] === "•"
    );
    expect(bulletCall).toBeDefined();
  });

  it("renders • bullet lines with a bullet character", async () => {
    await downloadResumePdf("• Managed infrastructure");

    const bulletCalls = mockText.mock.calls.filter(
      (call: unknown[]) => call[0] === "•"
    );
    expect(bulletCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("renders bullet content indented from the margin", async () => {
    await downloadResumePdf("- Led backend team");

    const contentCall = mockText.mock.calls.find(
      (call: unknown[]) => call[0] === "Led backend team"
    );
    expect(contentCall).toBeDefined();
    // Content is rendered at MARGIN + BULLET_INDENT (12 + 4 = 16)
    expect(contentCall![1]).toBeGreaterThan(12);
  });

  it("renders normal text lines", async () => {
    await downloadResumePdf("John Doe");

    const nameCall = mockText.mock.calls.find(
      (call: unknown[]) => call[0] === "John Doe"
    );
    expect(nameCall).toBeDefined();
  });

  it("adds a new page when content exceeds page height", async () => {
    // Return many lines to force page overflow
    mockSplitTextToSize.mockReturnValue(
      Array.from({ length: 70 }, (_, i) => `Line ${i}`)
    );

    await downloadResumePdf("Normal line that gets split into many lines");

    expect(mockAddPage).toHaveBeenCalled();
  });

  it("skips blank lines (adds vertical space only)", async () => {
    const initialTextCallCount = mockText.mock.calls.length;
    await downloadResumePdf("\n\n");
    // No text calls for blank lines
    expect(mockText.mock.calls.length).toBe(initialTextCallCount);
  });

  it("saves file at end of execution", async () => {
    await downloadResumePdf("SKILLS\n- TypeScript\n- React");
    expect(mockSave).toHaveBeenCalledOnce();
  });

  it("renders inline **bold** segments with bold font", async () => {
    await downloadResumePdf("**Senior Engineer** — Acme Corp | 2022–Present");

    const boldFontCall = mockSetFont.mock.calls.find(
      (call: unknown[]) => call[0] === "helvetica" && call[1] === "bold"
    );
    expect(boldFontCall).toBeDefined();

    const boldTextCall = mockText.mock.calls.find(
      (call: unknown[]) => call[0] === "Senior Engineer"
    );
    expect(boldTextCall).toBeDefined();
  });

  it("renders the non-bold segment of a mixed line with normal font", async () => {
    await downloadResumePdf("**Lead Dev** at Corp");

    const normalAfterBold = mockSetFont.mock.calls.find(
      (call: unknown[]) => call[0] === "helvetica" && call[1] === "normal"
    );
    expect(normalAfterBold).toBeDefined();

    const restTextCall = mockText.mock.calls.find(
      (call: unknown[]) => call[0] === " at Corp"
    );
    expect(restTextCall).toBeDefined();
  });

  it("strips ** markers from bullet text so no markup appears in output", async () => {
    await downloadResumePdf("- **Led** the backend team");

    const anyAsteriskText = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("**")
    );
    expect(anyAsteriskText).toBeUndefined();
  });

  it("strips bare ** from normal lines that have no closing marker", async () => {
    await downloadResumePdf("Contact: **email@example.com");

    const anyAsteriskText = mockText.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("**")
    );
    expect(anyAsteriskText).toBeUndefined();
  });
});
