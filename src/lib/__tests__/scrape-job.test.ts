import { describe, it, expect } from "vitest";
import { extractJobDescription } from "@/lib/scrape-job";

describe("extractJobDescription", () => {
  it("extracts text from <main> content", () => {
    const html = `<html><body><nav>Nav</nav><main><h1>Software Engineer</h1><p>We need a dev.</p></main><footer>Footer</footer></body></html>`;
    const result = extractJobDescription(html);
    expect(result.success).toBe(true);
    expect(result.jobDescription).toContain("Software Engineer");
    expect(result.jobDescription).toContain("We need a dev.");
    expect(result.jobDescription).not.toContain("Nav");
    expect(result.jobDescription).not.toContain("Footer");
  });

  it("extracts text from <article> when no <main> exists", () => {
    const html = `<html><body><article><p>Job posting here</p></article></body></html>`;
    const result = extractJobDescription(html);
    expect(result.success).toBe(true);
    expect(result.jobDescription).toContain("Job posting here");
  });

  it("falls back to <body> when no semantic tags exist", () => {
    const html = `<html><body><div><p>Some job info</p></div></body></html>`;
    const result = extractJobDescription(html);
    expect(result.success).toBe(true);
    expect(result.jobDescription).toContain("Some job info");
  });

  it("strips script, style, nav, footer, header tags", () => {
    const html = `<html><body>
      <script>alert('x')</script>
      <style>.x{color:red}</style>
      <nav>Navigation</nav>
      <header>Header</header>
      <div>Real content</div>
      <footer>Footer</footer>
    </body></html>`;
    const result = extractJobDescription(html);
    expect(result.success).toBe(true);
    expect(result.jobDescription).toBe("Real content");
  });

  it("truncates output to 10,000 characters", () => {
    const longText = "a".repeat(15_000);
    const html = `<html><body><main>${longText}</main></body></html>`;
    const result = extractJobDescription(html);
    expect(result.success).toBe(true);
    expect(result.jobDescription!.length).toBe(10_000);
  });

  it("returns error for empty HTML", () => {
    const result = extractJobDescription("");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns error for HTML with no text content", () => {
    const html = `<html><body><script>only script</script></body></html>`;
    const result = extractJobDescription(html);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("extracts job description from JSON-LD JobPosting when body is empty (Workday SPA)", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"JobPosting","title":"Manager, Software Engineering","description":"Manage software teams and deliver projects at scale."}</script>
    </head><body></body></html>`;
    const result = extractJobDescription(html);
    expect(result.success).toBe(true);
    expect(result.jobDescription).toContain("Manage software teams");
  });

  it("falls back to og:description meta tag when body is empty and no JSON-LD", () => {
    const html = `<html><head>
      <meta property="og:description" content="Senior engineer role at Acme Corp building distributed systems." />
    </head><body></body></html>`;
    const result = extractJobDescription(html);
    expect(result.success).toBe(true);
    expect(result.jobDescription).toContain("Senior engineer role at Acme Corp");
  });

  it("prefers body text over JSON-LD when body content is longer", () => {
    const bodyContent = "Full job description with many details. ".repeat(20);
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"JobPosting","description":"Short summary."}</script>
    </head><body><main>${bodyContent}</main></body></html>`;
    const result = extractJobDescription(html);
    expect(result.success).toBe(true);
    expect(result.jobDescription).toContain("Full job description");
  });

  it("ignores non-JobPosting JSON-LD types", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"Organization","name":"Acme Corp"}</script>
    </head><body><main>Actual job content here.</main></body></html>`;
    const result = extractJobDescription(html);
    expect(result.success).toBe(true);
    expect(result.jobDescription).toBe("Actual job content here.");
  });
});
