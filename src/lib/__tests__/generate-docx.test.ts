// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPackerToBlob } = vi.hoisted(() => ({
  mockPackerToBlob: vi.fn(() => Promise.resolve(new Blob(["docx content"]))),
}));

vi.mock("docx", () => {
  // Use regular functions (not arrows) so they can be used as constructors with `new`
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  function Ctor(this: unknown) {}
  const makeCtor = () => vi.fn().mockImplementation(function (this: unknown) { return this; });

  const ShadingType = { CLEAR: "clear" };
  const BorderStyle = { NONE: "none", SINGLE: "single" };
  const WidthType = { PERCENTAGE: "pct" };
  const HeightRule = { EXACT: "exact" };
  const UnderlineType = { NONE: "none" };

  void Ctor;

  return {
    Document: makeCtor(),
    Packer: { toBlob: mockPackerToBlob },
    Paragraph: makeCtor(),
    TextRun: makeCtor(),
    Table: makeCtor(),
    TableRow: makeCtor(),
    TableCell: makeCtor(),
    ShadingType,
    BorderStyle,
    WidthType,
    HeightRule,
    UnderlineType,
    AlignmentType: { LEFT: "left" },
    convertInchesToTwip: (n: number) => Math.round(n * 1440),
  };
});

import { downloadDocx } from "@/lib/generate-docx";
import type { PdfMetadata } from "@/types";

const META: PdfMetadata = { candidateName: "Jane Doe", companyName: "Acme Inc", jobTitle: "Engineer" };

describe("downloadDocx (cover letter)", () => {
  let mockClick: ReturnType<typeof vi.fn>;
  let mockCreateElement: ReturnType<typeof vi.spyOn>;

  function setupAnchorMock() {
    mockClick = vi.fn();
    mockCreateElement = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        return { href: "", download: "", click: mockClick } as unknown as HTMLElement;
      }
      return document.createElement(tag);
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockPackerToBlob.mockResolvedValue(new Blob(["docx content"]));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    setupAnchorMock();
  });

  it("calls Packer.toBlob and triggers download", async () => {
    await downloadDocx("Dear Hiring Manager,\n\nBody text.", META);
    expect(mockPackerToBlob).toHaveBeenCalledOnce();
    expect(mockClick).toHaveBeenCalledOnce();
  });

  it("revokes the object URL after download", async () => {
    await downloadDocx("Cover letter body.", META);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("uses provided filename", async () => {
    let capturedDownload = "";
    mockCreateElement.mockImplementation((tag: string) => {
      if (tag === "a") {
        const anchor = { href: "", download: "", click: mockClick };
        Object.defineProperty(anchor, "download", {
          get: () => capturedDownload,
          set: (v: string) => { capturedDownload = v; },
        });
        return anchor as unknown as HTMLElement;
      }
      return document.createElement(tag);
    });

    await downloadDocx("Body.", META, "acme-cover-letter.docx");
    expect(capturedDownload).toBe("acme-cover-letter.docx");
  });

  it("uses default filename when not provided", async () => {
    let capturedDownload = "";
    mockCreateElement.mockImplementation((tag: string) => {
      if (tag === "a") {
        const anchor = { href: "", download: "", click: mockClick };
        Object.defineProperty(anchor, "download", {
          get: () => capturedDownload,
          set: (v: string) => { capturedDownload = v; },
        });
        return anchor as unknown as HTMLElement;
      }
      return document.createElement(tag);
    });

    await downloadDocx("Body.", META);
    expect(capturedDownload).toBe("cover-letter.docx");
  });

  it("accepts empty metadata without throwing", async () => {
    await expect(downloadDocx("Body text.", {})).resolves.toBeUndefined();
    expect(mockPackerToBlob).toHaveBeenCalledOnce();
  });
});
