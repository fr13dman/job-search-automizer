import { describe, it, expect, vi, afterEach } from "vitest";
import { extractJobDescription, scrapeJobUrl } from "@/lib/scrape-job";

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

  // ── Structured metadata header prepend ──────────────────────────────────────

  it("prepends Job Title and Company from JSON-LD JobPosting", () => {
    const html = `<html><head>
      <script type="application/ld+json">{
        "@type": "JobPosting",
        "title": "Senior Software Engineer",
        "hiringOrganization": { "name": "Stripe" },
        "description": "Build payment systems."
      }</script>
    </head><body><main>Build payment systems.</main></body></html>`;
    const result = extractJobDescription(html);
    expect(result.success).toBe(true);
    expect(result.jobDescription).toMatch(/^Job Title: Senior Software Engineer\nCompany: Stripe\n\n/);
  });

  it("prepends only Job Title when hiringOrganization is absent", () => {
    const html = `<html><head>
      <script type="application/ld+json">{
        "@type": "JobPosting",
        "title": "Backend Engineer",
        "description": "Build APIs."
      }</script>
    </head><body><main>Build APIs.</main></body></html>`;
    const result = extractJobDescription(html);
    expect(result.jobDescription).toMatch(/^Job Title: Backend Engineer\n\n/);
    expect(result.jobDescription).not.toContain("Company:");
  });

  it("extracts title and company from og:title 'Title at Company' pattern", () => {
    const html = `<html><head>
      <meta property="og:title" content="Product Manager at Acme Corp" />
    </head><body><main>Join our product team.</main></body></html>`;
    const result = extractJobDescription(html);
    expect(result.jobDescription).toMatch(/^Job Title: Product Manager\nCompany: Acme Corp\n\n/);
  });

  it("extracts title from og:title 'Title - Company' separator pattern", () => {
    const html = `<html><head>
      <meta property="og:title" content="Data Analyst - Meta" />
    </head><body><main>Analyze data.</main></body></html>`;
    const result = extractJobDescription(html);
    expect(result.jobDescription).toMatch(/^Job Title: Data Analyst\nCompany: Meta\n\n/);
  });

  it("skips second og:title segment when it looks like a location (City, ST)", () => {
    const html = `<html><head>
      <meta property="og:title" content="Software Engineer - San Francisco, CA" />
    </head><body><main>Build things.</main></body></html>`;
    const result = extractJobDescription(html);
    expect(result.jobDescription).toMatch(/^Job Title: Software Engineer\n\n/);
    expect(result.jobDescription).not.toContain("Company: San Francisco");
  });

  it("uses og:site_name as company when not a known job board", () => {
    const html = `<html><head>
      <meta property="og:site_name" content="Paysafe" />
      <meta property="og:title" content="VP Payments Engineering" />
    </head><body><main>Lead payments platform.</main></body></html>`;
    const result = extractJobDescription(html);
    expect(result.jobDescription).toMatch(/^Job Title: VP Payments Engineering\nCompany: Paysafe\n\n/);
  });

  it("filters out known job board site names (LinkedIn, Indeed)", () => {
    const html = `<html><head>
      <meta property="og:site_name" content="LinkedIn" />
      <meta property="og:title" content="Engineer" />
    </head><body><main>Job details.</main></body></html>`;
    const result = extractJobDescription(html);
    expect(result.jobDescription).not.toContain("Company: LinkedIn");
  });

  it("falls back to h1 when no structured metadata is present", () => {
    const html = `<html><body><main><h1>DevOps Engineer</h1><p>Manage infrastructure.</p></main></body></html>`;
    const result = extractJobDescription(html);
    expect(result.jobDescription).toMatch(/^Job Title: DevOps Engineer\n\n/);
  });

  it("does not prepend header when no structured metadata is found", () => {
    const html = `<html><body><main>We are looking for a great engineer.</main></body></html>`;
    const result = extractJobDescription(html);
    expect(result.jobDescription).not.toContain("Job Title:");
    expect(result.jobDescription).not.toContain("Company:");
  });
});

// ---------------------------------------------------------------------------
// scrapeJobUrl — Greenhouse API integration
// ---------------------------------------------------------------------------

const GREENHOUSE_JOB = {
  title: "Senior Engineer",
  company_name: "Acme Inc",
  location: { name: "Remote" },
  content:
    "&lt;p&gt;We are looking for a &lt;strong&gt;Senior Engineer&lt;/strong&gt; to join our team.&lt;/p&gt;",
};

function makeGreenhouseFetch(job: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => job,
    text: async () => JSON.stringify(job),
  });
}

describe("scrapeJobUrl — Greenhouse integration", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches from Greenhouse API when URL has gh_jid param", async () => {
    vi.spyOn(global, "fetch").mockImplementation(makeGreenhouseFetch(GREENHOUSE_JOB) as typeof fetch);

    const result = await scrapeJobUrl("https://www.acme.com/careers/job?gh_jid=12345");

    expect(result.success).toBe(true);
    expect(result.jobDescription).toContain("Senior Engineer");
    expect(result.jobDescription).toContain("Acme Inc");
    expect(result.jobDescription).toContain("Remote");
    // HTML tags stripped
    expect(result.jobDescription).not.toContain("<p>");
    expect(result.jobDescription).not.toContain("&lt;");
  });

  it("calls correct Greenhouse API URL for gh_jid embed", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(makeGreenhouseFetch(GREENHOUSE_JOB) as typeof fetch);

    await scrapeJobUrl("https://www.fivetran.com/careers/job?gh_jid=7653046003");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/fivetran/jobs/7653046003",
      expect.anything()
    );
  });

  it("fetches from Greenhouse API for boards.greenhouse.io URLs", async () => {
    vi.spyOn(global, "fetch").mockImplementation(makeGreenhouseFetch(GREENHOUSE_JOB) as typeof fetch);

    const result = await scrapeJobUrl("https://boards.greenhouse.io/acme/jobs/12345");

    expect(result.success).toBe(true);
    expect(result.jobDescription).toContain("Senior Engineer");
  });

  it("falls back to page scraping when Greenhouse API returns non-ok", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}), text: async () => "" } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "<html><body><main>Job details from page</main></body></html>",
      } as Response);

    const result = await scrapeJobUrl("https://www.acme.com/careers/job?gh_jid=99");

    expect(result.success).toBe(true);
    expect(result.jobDescription).toContain("Job details from page");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("decodes HTML entities in Greenhouse content", async () => {
    const job = {
      ...GREENHOUSE_JOB,
      content: "&lt;p&gt;Salary: $100,000 &amp; equity &mdash; great benefits&lt;/p&gt;",
    };
    vi.spyOn(global, "fetch").mockImplementation(makeGreenhouseFetch(job) as typeof fetch);

    const result = await scrapeJobUrl("https://company.com/jobs?gh_jid=1");

    expect(result.jobDescription).toContain("$100,000 & equity");
    expect(result.jobDescription).toContain("—");
    expect(result.jobDescription).not.toContain("&amp;");
    expect(result.jobDescription).not.toContain("&mdash;");
  });

  it("preserves newline separators in header so extraction patterns work", async () => {
    vi.spyOn(global, "fetch").mockImplementation(makeGreenhouseFetch(GREENHOUSE_JOB) as typeof fetch);

    const result = await scrapeJobUrl("https://www.acme.com/careers/job?gh_jid=12345");

    // Header lines must be \n-separated so [^\n]+ patterns stop at the right boundary.
    // The old bug: text.replace(/\s+/g, " ") collapsed header into a single line,
    // making Company: capture the rest of the document instead of just the company name.
    expect(result.jobDescription).toMatch(/^Job Title: Senior Engineer\nCompany: Acme Inc\nLocation: Remote\n\n/);
  });

  it("handles job title with comma such as 'Director, Engineering'", async () => {
    const job = {
      title: "Director, Engineering",
      company_name: "Kaseya Careers",
      location: { name: "United States - Remote" },
      content: "&lt;p&gt;Lead engineering teams.&lt;/p&gt;",
    };
    vi.spyOn(global, "fetch").mockImplementation(makeGreenhouseFetch(job) as typeof fetch);

    const result = await scrapeJobUrl("https://www.kaseya.com/careers/jobs/id/123/?gh_jid=123");

    expect(result.success).toBe(true);
    // Title with comma must appear verbatim on its own line
    expect(result.jobDescription).toMatch(/^Job Title: Director, Engineering\n/);
    expect(result.jobDescription).toContain("Company: Kaseya Careers");
  });
});
