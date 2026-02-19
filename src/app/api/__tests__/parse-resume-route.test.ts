import { describe, it, expect, vi, beforeEach } from "vitest";

const mockParse = vi.fn();
vi.mock("@/lib/parse-resume", () => ({
  parseResume: (...args: unknown[]) => mockParse(...args),
}));

import { POST } from "@/app/api/parse-resume/route";
import { NextRequest } from "next/server";

function makeFormRequest(file?: File) {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  return new NextRequest("http://localhost:3000/api/parse-resume", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/parse-resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success for valid PDF upload", async () => {
    mockParse.mockResolvedValue({
      success: true,
      resumeText: "John Doe, Software Engineer",
    });

    const file = new File(["pdf content"], "resume.pdf", {
      type: "application/pdf",
    });
    const res = await POST(makeFormRequest(file));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.resumeText).toBe("John Doe, Software Engineer");
  });

  it("returns success for valid DOCX upload", async () => {
    mockParse.mockResolvedValue({
      success: true,
      resumeText: "Jane Smith, PM",
    });

    const file = new File(["docx content"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const res = await POST(makeFormRequest(file));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns error for unsupported file type", async () => {
    mockParse.mockResolvedValue({
      success: false,
      error: "Unsupported file type: .txt",
    });

    const file = new File(["text"], "resume.txt", { type: "text/plain" });
    const res = await POST(makeFormRequest(file));
    const data = await res.json();

    expect(data.success).toBe(false);
    expect(data.error).toContain("Unsupported file type");
  });

  it("returns error for missing file in form data", async () => {
    const res = await POST(makeFormRequest());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("No file provided");
  });
});
