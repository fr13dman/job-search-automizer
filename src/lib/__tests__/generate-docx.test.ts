// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPackerToBlob } = vi.hoisted(() => ({
  mockPackerToBlob: vi.fn(() => Promise.resolve(new Blob(["docx content"]))),
}));

vi.mock("docx", () => {
  const HeadingLevel = { HEADING_2: "HEADING_2" };

  // vi.fn() without implementation works as a constructor (new Paragraph(...))
  // mock.calls still records arguments for assertions
  const Paragraph = vi.fn();
  const Document = vi.fn();
  const TextRun = vi.fn();
  const Packer = { toBlob: mockPackerToBlob };

  return { HeadingLevel, Paragraph, Document, Packer, TextRun };
});

import { downloadDocx } from "@/lib/generate-docx";
import { Paragraph, TextRun } from "docx";

describe("downloadDocx", () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let mockCreateElement: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPackerToBlob.mockResolvedValue(new Blob(["docx content"]));

    mockClick = vi.fn();
    mockCreateObjectURL = vi.fn(() => "blob:mock-url");
    mockRevokeObjectURL = vi.fn();

    vi.spyOn(URL, "createObjectURL").mockImplementation(mockCreateObjectURL);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(mockRevokeObjectURL);

    mockCreateElement = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        return { href: "", download: "", click: mockClick } as unknown as HTMLElement;
      }
      return document.createElement.wrappedMethod
        ? document.createElement.wrappedMethod.call(document, tag)
        : document.createElement(tag);
    });
  });

  it("calls Packer.toBlob", async () => {
    await downloadDocx("EXPERIENCE\n- Led team");
    expect(mockPackerToBlob).toHaveBeenCalledOnce();
  });

  it("triggers anchor click for download", async () => {
    await downloadDocx("Some resume text");
    expect(mockClick).toHaveBeenCalledOnce();
  });

  it("uses correct filename when provided", async () => {
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

    await downloadDocx("Resume text", "my-resume.docx");
    expect(capturedDownload).toBe("my-resume.docx");
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

    await downloadDocx("Resume text");
    expect(capturedDownload).toBe("curated-resume.docx");
  });

  it("revokes the object URL after download", async () => {
    await downloadDocx("Resume text");
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("classifies ALL CAPS lines as heading paragraphs", async () => {
    await downloadDocx("EXPERIENCE\nnormal line");

    const calls = vi.mocked(Paragraph).mock.calls;
    const headingCall = calls.find(
      ([opts]) => opts && typeof opts === "object" && "heading" in opts
    );
    expect(headingCall).toBeDefined();
    expect(headingCall![0].heading).toBe("HEADING_2");
    expect(headingCall![0].text).toBe("EXPERIENCE");
  });

  it("classifies lines starting with - as bullet paragraphs", async () => {
    await downloadDocx("- Led backend team");

    const calls = vi.mocked(Paragraph).mock.calls;
    const bulletCall = calls.find(
      ([opts]) => opts && typeof opts === "object" && "bullet" in opts
    );
    expect(bulletCall).toBeDefined();
    expect(bulletCall![0].bullet).toEqual({ level: 0 });
    // text is in a TextRun child
    expect(
      vi.mocked(TextRun).mock.calls.some(([opts]) => opts && opts.text === "Led backend team")
    ).toBe(true);
  });

  it("classifies lines starting with • as bullet paragraphs", async () => {
    await downloadDocx("• Managed infrastructure");

    const calls = vi.mocked(Paragraph).mock.calls;
    const bulletCall = calls.find(
      ([opts]) => opts && typeof opts === "object" && "bullet" in opts
    );
    expect(bulletCall).toBeDefined();
    expect(bulletCall![0].bullet).toEqual({ level: 0 });
    expect(
      vi.mocked(TextRun).mock.calls.some(([opts]) => opts && opts.text === "Managed infrastructure")
    ).toBe(true);
  });

  it("classifies blank lines as empty paragraphs", async () => {
    await downloadDocx("line one\n\nline two");

    const calls = vi.mocked(Paragraph).mock.calls;
    // An empty paragraph: no text, heading, bullet, or children
    const emptyCall = calls.find(
      ([opts]) =>
        opts &&
        typeof opts === "object" &&
        !("text" in opts) &&
        !("heading" in opts) &&
        !("bullet" in opts) &&
        !("children" in opts)
    );
    expect(emptyCall).toBeDefined();
  });

  it("creates bold TextRun for **bold** inline segments", async () => {
    await downloadDocx("**Senior Engineer** — Acme Corp | 2022–Present");

    const boldRun = vi.mocked(TextRun).mock.calls.find(
      ([opts]) => opts && typeof opts === "object" && opts.bold === true
    );
    expect(boldRun).toBeDefined();
    expect(boldRun![0].text).toBe("Senior Engineer");
  });
});
