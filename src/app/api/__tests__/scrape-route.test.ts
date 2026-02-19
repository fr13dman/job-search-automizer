import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExtract = vi.fn();
vi.mock("@/lib/scrape-job", () => ({
  scrapeJobUrl: (...args: unknown[]) => mockExtract(...args),
}));

import { POST } from "@/app/api/scrape/route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/scrape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success with jobDescription for valid URL", async () => {
    mockExtract.mockResolvedValue({
      success: true,
      jobDescription: "Software Engineer role",
    });

    const res = await POST(makeRequest({ url: "https://example.com/job" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobDescription).toBe("Software Engineer role");
  });

  it("returns error for unreachable URL", async () => {
    mockExtract.mockResolvedValue({
      success: false,
      error: "Failed to fetch URL: network error",
    });

    const res = await POST(makeRequest({ url: "https://unreachable.invalid" }));
    const data = await res.json();

    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it("returns error for missing URL in body", async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Missing or invalid URL");
  });

  it("returns error for invalid URL format", async () => {
    const res = await POST(makeRequest({ url: "not-a-url" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Invalid URL format");
  });
});
