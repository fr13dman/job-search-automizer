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
const mockSetFillColor = vi.fn();
const mockRect = vi.fn();
const mockSetTextColor = vi.fn();

vi.mock("jspdf", () => ({
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
    // Orange accent line (matches template)
    expect(mockSetDrawColor).toHaveBeenCalledWith(197, 90, 17);
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

  it("renders the first line (candidate name) bold with larger font", async () => {
    await downloadResumePdf("John Doe\nSoftware Engineer\n\nEXPERIENCE");

    // NAME_FS = 20
    const nameFontSizeCall = mockSetFontSize.mock.calls.find(
      (call: unknown[]) => call[0] === 20
    );
    expect(nameFontSizeCall).toBeDefined();

    const nameTextCall = mockText.mock.calls.find(
      (call: unknown[]) => call[0] === "John Doe"
    );
    expect(nameTextCall).toBeDefined();
  });

  it("renders the second line (position) bold with larger font", async () => {
    await downloadResumePdf("John Doe\nSoftware Engineer\n\nEXPERIENCE");

    const positionTextCall = mockText.mock.calls.find(
      (call: unknown[]) => call[0] === "Software Engineer"
    );
    expect(positionTextCall).toBeDefined();
  });

  it("renders only the first 2 lines as header (3rd line uses normal font)", async () => {
    await downloadResumePdf("John Doe\nSoftware Engineer\njohn@email.com\n\nEXPERIENCE");

    // Contact line should NOT use NAME_FS (20pt); only the name line does
    const nameFontSizeCalls = mockSetFontSize.mock.calls.filter(
      (call: unknown[]) => call[0] === 20
    );
    // Only the first line (name) uses 20pt
    expect(nameFontSizeCalls.length).toBe(1);
  });

  it("renders inline **bold** segments with bold font inside experience section", async () => {
    // Provide a section heading first so the bold line is NOT treated as a header line
    await downloadResumePdf("EXPERIENCE\n**Senior Engineer** — Acme Corp | 2022–Present");

    const boldFontCall = mockSetFont.mock.calls.find(
      (call: unknown[]) => call[0] === "helvetica" && call[1] === "bold"
    );
    expect(boldFontCall).toBeDefined();

    const boldTextCall = mockText.mock.calls.find(
      (call: unknown[]) => call[0] === "Senior Engineer"
    );
    expect(boldTextCall).toBeDefined();
  });

  it("renders the non-bold segment of a mixed line with normal font inside experience section", async () => {
    // Provide a section heading first so the bold line is NOT treated as a header line
    await downloadResumePdf("EXPERIENCE\n**Lead Dev** at Corp");

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
