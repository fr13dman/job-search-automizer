# Job Search Automizer

An AI-powered tool that generates tailored cover letters and curated resumes from a job posting URL and an uploaded resume. Built with Next.js 16, Claude AI, and a hallucination-prevention pipeline that validates the output before you ever see it.

---

## Table of Contents

- [Running Locally](#running-locally)
- [High-Level Architecture](#high-level-architecture)
- [Feature Breakdown](#feature-breakdown)
  - [Job Description Ingestion](#job-description-ingestion)
  - [Job Meta Confirmation](#job-meta-confirmation)
  - [Resume Upload](#resume-upload)
  - [Cover Letter Generation](#cover-letter-generation)
  - [Resume Curation Pipeline](#resume-curation-pipeline)
  - [Company Intelligence](#company-intelligence)
  - [Document Export](#document-export)
  - [Save to Folder](#save-to-folder)
  - [Filename Generation](#filename-generation)
- [Test Coverage](#test-coverage)
- [FAQ](#faq)

---

## Running Locally

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/fr13dman/job-search-automizer.git
cd job-search-automizer

# 2. Install dependencies
npm install

# 3. Set your environment variables
cp .env.example .env.local
# Then edit .env.local and add:
# ANTHROPIC_API_KEY=sk-ant-...      # required
# TAVILY_API_KEY=tvly-...           # optional – enables web search in Company Intelligence
# JINA_API_KEY=jina_...             # optional – increases Jina Reader rate limits
# ROOT_FOLDER=~/Documents/Jobs      # optional – enables "Save to Folder" feature

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Other Commands

| Command | Description |
|---|---|
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npx vitest run src/lib/__tests__/scrape-job.test.ts` | Run a single test file |

### Deploying to Vercel

Build locally to avoid version conflicts on Vercel's build servers:

```bash
vercel build --prod
vercel deploy --prebuilt --prod
```

> **Note:** Do not use `vercel` in production `dependencies` — it pulls in ~100 packages and has been observed to trigger `npm error Invalid Version:` on Vercel's remote build servers.

---

## High-Level Architecture

```
Browser (Next.js App Router, single page)
│
├── /api/scrape               ← fetches job URL, returns structured JD text
├── /api/parse-resume         ← parses uploaded PDF/DOCX → plain text
├── /api/generate             ← streams cover letter (Claude Sonnet)
├── /api/curate-resume        ← rewrites resume tailored to the job (Claude)
├── /api/evaluate-resume      ← scores curated resume for ATS fit + hallucinations
├── /api/company-info         ← extracts company description, values, links from JD
├── /api/company-info-deep    ← deep research via Jina Reader + Tavily web search
└── /api/save-documents       ← saves PDF/DOCX files to a local folder
```

### Cover Letter Flow

```
User pastes URL or text
        │
   /api/scrape  ──► structured "Job Title: X\nCompany: Y\n\n..." text
        │
User uploads resume (PDF/DOCX)
        │
   /api/parse-resume  ──► plain resume text
        │
User clicks Generate
        │
   /api/generate  ──► streams cover letter token by token (Vercel AI SDK)
        │
   ExportToolbar  ──► PDF (jsPDF) or DOCX (docx library)
```

### Resume Curation Loop (up to 3 attempts)

```
        ┌─────────────────────────────────────────┐
        │                                         │
   /api/curate-resume                             │
        │                                         │
   restoreProtectedFields()   ← deterministically │
   (contact block + EDUCATION overwritten         │
    with exact text from original resume)         │
        │                                         │
   /api/evaluate-resume                           │
   ├── checkNumericFidelity()  ← deterministic    │
   └── Claude evaluation      ← LLM              │
        │                                         │
   hallucinationsFound?  ──yes──► buildFeedback() ┘
        │ no (or 3rd attempt)
        ▼
   Final curated resume displayed + available for export
```

---

## Feature Breakdown

### Job Description Ingestion

**Files:** `src/lib/scrape-job.ts`, `src/app/api/scrape/route.ts`, `src/components/job-input.tsx`

The job input accepts either a URL or a manually pasted description.

**URL scraping priority chain:**
1. **Greenhouse API** — for URLs with `?gh_jid=` or `boards.greenhouse.io` domains, calls the Greenhouse boards API directly for clean structured data.
2. **JSON-LD `JobPosting`** — extracts `title` and `hiringOrganization.name` from structured data embedded in the page head (used by Workday, many ATS platforms).
3. **`og:title`** — parses "Title at Company" or "Title - Company" patterns from the Open Graph title meta tag.
4. **`<h1>`** — used as a title fallback when no structured data is present.
5. **`og:site_name`** — used as a company fallback for company-hosted career pages (filtered out for generic job boards like LinkedIn, Indeed, Glassdoor).

Regardless of source, a `Job Title: X\nCompany: Y` header is prepended to the body text so downstream extraction patterns work consistently. The body text itself is collapsed to a single line; the header retains newlines as field separators.

---

### Job Meta Confirmation

**Files:** `src/components/cover-letter-form.tsx`

After a job URL is scraped, the app extracts a **company name** and **job title** from the structured data and surfaces them in an editable confirmation widget. The user can accept the extracted values or correct them before generating.

These confirmed values are used throughout the session:
- Passed to the Company Intelligence card (enables the "Get More Info" deep research button)
- Used as the base for PDF/DOCX filenames
- Passed as context to the cover letter prompt

---

### Resume Upload

**Files:** `src/lib/parse-resume.ts`, `src/app/api/parse-resume/route.ts`, `src/components/resume-upload.tsx`

Accepts PDF and DOCX files.

- **PDF** — parsed with `unpdf` (WASM-based, no native bindings in the browser path) and `pdf-parse` (Node, server-side). `pdf-parse` is listed in `next.config.ts` `serverExternalPackages` to prevent bundling errors.
- **DOCX** — parsed with `mammoth`, which extracts plain text from the Open XML format.

The extracted plain text is passed to all downstream API routes.

---

### Cover Letter Generation

**Files:** `src/lib/prompt.ts`, `src/app/api/generate/route.ts`, `src/components/cover-letter-form.tsx`, `src/components/cover-letter-output.tsx`

Uses `claude-sonnet-4-5-20250929` via the Vercel AI SDK (`streamText` → `toTextStreamResponse()`). The client uses `useCompletion` with `streamProtocol: "text"` to stream tokens as they arrive.

**Prompt rules enforced:**
- Five selectable tones: Professional, Friendly, Concise, Enthusiastic, Confident.
- Strict no-hallucination rule: every claim must appear verbatim or as a clear paraphrase in the resume.
- Under 500 words, 3–4 short paragraphs, hook opening.
- Layout rules: no sender contact block (the PDF/DOCX template renders it from the left column); output starts directly with the salutation.
- Key achievements wrapped in `**bold**` markdown, rendered as highlighted `<mark>` tags in preview.

An optional free-text "Additional Instructions" field is appended to the prompt.

A **retry button** is available on the cover letter output to regenerate with a new API call without leaving the page.

---

### Resume Curation Pipeline

**Files:** `src/app/api/curate-resume/route.ts`, `src/app/api/evaluate-resume/route.ts`, `src/lib/check-numeric-fidelity.ts`, `src/lib/restore-protected-fields.ts`, `src/lib/extract-resume-sections.ts`, `src/components/curated-resume.tsx`, `src/components/resume-evaluation.tsx`, `src/components/resume-progress.tsx`

The client runs an agentic loop of up to three attempts:

**1. Curate** (`/api/curate-resume`)
Claude rewrites the resume tailored to the job description. AI-added content is wrapped in `__curated text__` double-underscore markers (rendered as bold in DOCX, stripped silently in PDF).

**2. Restore protected fields** (`restoreProtectedFields`)
Before evaluation, the contact block and EDUCATION section are deterministically overwritten with the exact text from the original resume. This eliminates an entire class of hallucinations without relying on the LLM.

**3. Evaluate** (`/api/evaluate-resume`)
Two checks run in parallel:
- **Deterministic numeric fidelity check** (`checkNumericFidelity`): every numeric token from the original resume (percentages, dollar amounts, headcounts, etc.) is verified to appear in the curated version. Mismatches are flagged as hallucinations without any LLM call.
- **Claude evaluation**: scores ATS fit (0–100), lists matched and missing keywords, and identifies fabricated facts.

**4. Retry with feedback**
If hallucinations are found and attempts remain, `buildEvaluationFeedback()` constructs a detailed prompt that includes the specific hallucinations found, the verbatim original contact block, and the verbatim original EDUCATION section as reference text.

**Evaluation result fields:**

| Field | Description |
|---|---|
| `atsScore` | 0–100 ATS compatibility score |
| `keywordMatches` | Keywords from the JD present in the curated resume |
| `missingKeywords` | Keywords from the JD absent from the curated resume |
| `hallucinationsFound` | `true` if any fabricated content was detected |
| `hallucinationDetails` | Specific hallucination descriptions (LLM + deterministic) |
| `overallAssessment` | Short narrative summary |

A **retry button** is available on the curated resume output to restart the agentic curation loop from scratch.

---

### Company Intelligence

**Files:** `src/components/company-info-card.tsx`, `src/app/api/company-info/route.ts`, `src/app/api/company-info-deep/route.ts`, `src/lib/extract-company-links.ts`

A research card that appears once a job description is loaded, giving you intelligence about the company before you apply.

**Basic research** (`/api/company-info`)

Triggered by clicking "Research [Company]". Uses Claude Haiku with `generateObject` to extract from the job description:
- **About** — 2–3 sentence company summary
- **Values & Culture** — cultural principles displayed as pill badges
- **Useful Links** — company homepage and LinkedIn (deterministic, zero-token), plus URLs regex-extracted from the JD text

**Deep research** (`/api/company-info-deep`)

Triggered by clicking "Get More Info" (requires the company name to be confirmed in the Job Meta widget). Runs **5 fetches in parallel** — 2 Jina Reader pages and 3 Tavily searches — then feeds the combined content to Claude Haiku:

| Source | What it fetches |
|---|---|
| Jina Reader — homepage | Company website (up to 8,000 chars) |
| Jina Reader — `/about` | About page (up to 8,000 chars) |
| Tavily search 1 | Products, services, company overview (`search_depth: advanced`) |
| Tavily search 2 | Culture, interview process, remote work, benefits |
| Tavily search 3 | Recent news, funding rounds, milestones (2024–2025) |

Extracted and displayed fields:

| Section | Description |
|---|---|
| Key Facts | Founding year, headcount, funding, HQ, notable customers (max 6) |
| Products & Services | Main product lines and services (max 5) |
| Tech Stack | Languages, frameworks, cloud platforms used (max 8) |
| Work Environment | Remote/hybrid policy, perks, culture notes (max 4) |
| Interview Insights | Interview process and hiring criteria if explicitly stated (max 4) |
| Recent Highlights | News, launches, awards, funding rounds (max 5) |
| Competitors | Main competitors in the same market (max 4, shown as orange badges) |
| Additional Links | Engineering blog, press page, docs (max 3, deduped against homepage) |

Tavily and Jina are both optional — the endpoint degrades gracefully if keys are missing or requests time out.

---

### Document Export

**Files:** `src/lib/generate-pdf.ts`, `src/lib/generate-docx.ts`, `src/lib/generate-resume-pdf.ts`, `src/lib/generate-resume-docx.ts`, `src/components/export-toolbar.tsx`

All exports use a two-column template matching a professional design:

**Cover Letter (PDF + DOCX)**
- Dark header bar spanning full width.
- Left column (light gray): candidate name, phone, email, address, date, company name. Contact info is sourced from the uploaded resume via `extractContactInfo()`, not from the letter body.
- Right column: letter body starting from the salutation ("Dear ..."). Any pre-salutation header block is stripped by `stripLetterHeader()`.
- PDF auto-scales font size (9.5pt → 6.5pt in 0.5pt steps) to guarantee the letter fits on a single page.

**Resume (PDF + DOCX)**
- Orange left accent bar.
- Large bold candidate name, gray contact line.
- ALL CAPS section headers with orange underline.
- Orange bullet markers.
- AI-curated content (`__text__` markers) rendered as bold in DOCX; stripped in PDF.

**Export actions available:**
- Copy to clipboard (markdown bold stripped)
- Download as PDF
- Download as DOCX (Word-compatible)

---

### Save to Folder

**Files:** `src/app/api/save-documents/route.ts`, `src/components/save-to-folder.tsx`, `src/lib/generate-jd-pdf.ts`

When `ROOT_FOLDER` is set in `.env.local`, a "Save to Folder" button appears in the export toolbar. Clicking it sends base64-encoded PDFs to `/api/save-documents`, which writes them to a subfolder on disk:

```
$ROOT_FOLDER/
  {company}-{job-title}/
    {company}-{job-title}-cover-letter.pdf
    {company}-{job-title}-resume.pdf
    {company}-{job-title}-job-description.pdf
```

The job description is also rendered as a PDF (`generate-jd-pdf.ts`) and saved alongside the application documents for reference. The `ROOT_FOLDER` value supports `~` expansion.

---

### Filename Generation

**Files:** `src/lib/extract-metadata.ts`

Filenames follow the patterns:
- Cover letter: `{company}-{job-title}-cover-letter.{pdf|docx}`
- Resume: `{company}-{job-title}-resume`

**Extraction priority (for company name and job title):**
1. `Job Title:` / `Company:` lines prepended by the scraper (most reliable — works for all URL-scraped JDs)
2. Cover letter body patterns (Claude always names the role and company explicitly)
3. JD free-text patterns (`About X`, `X is hiring`, `·` / `–` separators)

**Length cap:** If the full slug exceeds 45 characters, the job title is dropped and the filename falls back to `{company}-cover-letter` or `{company}-resume` to prevent excessively long filenames.

---

## Test Coverage

The project has ~400 tests across 27 test files. Run them with `npm run test`.

> **Known pre-existing failures:** `src/app/api/__tests__/parse-resume-route.test.ts` has 3 tests that fail due to a native binding issue in the test environment — these are not regressions.

### Library Tests (`src/lib/__tests__/`)

| Test File | What It Covers |
|---|---|
| `scrape-job.test.ts` | HTML extraction, JSON-LD, Greenhouse API integration, `og:title` metadata, header newline preservation, comma-in-title handling |
| `prompt.test.ts` | `buildPrompt()` output for each tone, truncation of long inputs, no-hallucination rule presence |
| `clean-markdown.test.ts` | `stripCuratedMarkers`, `inlineBoldRuns`, `stripLetterHeader` (pre-salutation removal) |
| `extract-metadata.test.ts` | Candidate name, company, job title extraction; filename builders; 45-char fallback; `extractContactInfo` (phone, email, address from resume header) |
| `generate-pdf.test.ts` | jsPDF cover letter layout: colored bars, left column content, single-page auto-scaling |
| `generate-docx.test.ts` | Cover letter DOCX: two-column table structure, left/right column content |
| `generate-resume-pdf.test.ts` | Resume PDF: orange stripe, name size, section headers, bullet rendering |
| `check-numeric-fidelity.test.ts` | Numeric token extraction, K/M/B expansion, comma normalization, year filtering, mismatch detection |
| `extract-resume-sections.test.ts` | Contact block extraction, EDUCATION section detection, various heading formats |
| `restore-protected-fields.test.ts` | Contact block and EDUCATION restoration, no-op when unchanged, restorations log |
| `parse-resume.test.ts` | PDF and DOCX text extraction |

### API Route Tests (`src/app/api/__tests__/`)

| Test File | What It Covers |
|---|---|
| `generate-route.test.ts` | Request validation, Claude streaming, error handling |
| `curate-resume-route.test.ts` | Request validation, resume curation streaming |
| `evaluate-resume-route.test.ts` | ATS scoring, hallucination detection, numeric fidelity merge, schema validation |
| `scrape-route.test.ts` | URL validation, scrape result pass-through, error responses |
| `parse-resume-route.test.ts` | File upload handling (3 tests have pre-existing environment failures) |

### Component Tests (`src/components/__tests__/`)

| Test File | What It Covers |
|---|---|
| `job-input.test.tsx` | URL fetch, scrape success/failure, manual paste fallback |
| `resume-upload.test.tsx` | File selection, type validation, upload feedback |
| `tone-selector.test.tsx` | Tone option rendering and selection |
| `cover-letter-output.test.tsx` | Streaming text rendering, bold highlighting, editable output |
| `export-toolbar.test.tsx` | Copy, PDF download, DOCX download; metadata passed correctly |
| `curated-resume.test.tsx` | Resume display, DOCX download via `downloadResumeDocx` |
| `resume-evaluation.test.tsx` | ATS score display, keyword lists, hallucination warnings |
| `resume-progress.test.tsx` | Phase indicators (curating / evaluating / done), attempt history |

### Integration Tests (`src/__tests__/`)

End-to-end flows using mocked API routes: full generate flow, scrape-failure fallback, generation cancellation, and toast/confetti timing.

---

## FAQ

**What AI model is used?**
Cover letter generation and resume curation use `claude-sonnet-4-5-20250929` via the `@ai-sdk/anthropic` package. Resume evaluation and Company Intelligence use `claude-haiku-4-5-20251001` with structured output (`generateObject` + Zod schema) to return typed JSON results.

**What does Company Intelligence show?**
After loading a job description, clicking "Research [Company]" extracts the company description, values, and links directly from the JD text using Claude Haiku — no external requests. Clicking "Get More Info" (requires the company name to be confirmed) runs a deeper scan: Jina Reader fetches the homepage and `/about` page, Tavily runs three targeted web searches (overview, culture/interview, recent news), and Claude Haiku extracts up to 8 structured fields including tech stack, competitors, interview insights, and recent highlights.

**Do I need Tavily and Jina API keys?**
No. Both are optional. Jina Reader works without a key (at lower rate limits). Tavily requires `TAVILY_API_KEY` — without it, deep research still runs using Jina Reader only. The endpoint returns an error only if both sources fail entirely.

**How does hallucination prevention work?**
Three layers work together:
1. **Deterministic numeric check** — every number from the original resume (percentages, dollar amounts, headcounts) must appear verbatim in the curated output. This fires before any LLM evaluation.
2. **Deterministic field restoration** — the contact block and EDUCATION section are overwritten with verbatim text from the original resume after each curation pass, before evaluation. This eliminates hallucinations in those fields entirely.
3. **Claude evaluation** — scores the resume and flags fabricated facts. If hallucinations are found, the curated resume is rejected and regenerated with detailed feedback (up to 3 attempts total).

**Why does the cover letter always fit on one page?**
The PDF generator tries font sizes from 9.5pt down to 6.5pt in 0.5pt steps, using `splitTextToSize` at each size to measure total text height. It stops at the first size that fits within the page bounds and never calls `addPage()`.

**What resume file formats are supported for upload?**
PDF and DOCX. PDF is parsed server-side with `pdf-parse`; DOCX is parsed with `mammoth`. Plain text paste is not currently supported as an upload format, but the resume curation API accepts any plain text string.

**What happens if the job URL can't be scraped?**
The UI shows an error toast and reveals a "Paste manually instead" textarea. The user can paste the job description directly and continue normally.

**Why does the scraper prepend a `Job Title: / Company:` header to the text?**
Job description pages use dozens of different HTML structures. Regex patterns that try to extract a title from free-form collapsed text are fragile. By normalizing structured data (JSON-LD, `og:title`, `<h1>`) into a predictable two-line header — the same format the Greenhouse API already returns — a single reliable set of extraction patterns covers all sources.

**Can I use this without a Vercel deployment?**
Yes. `npm run dev` runs the full stack locally. The only external dependency is the Anthropic API key.

**Why does the filename sometimes drop the job title?**
If the combined `{company}-{job-title}-cover-letter` slug exceeds 45 characters, the job title is omitted to prevent filesystem issues with very long names (e.g., long titles like "Director of Platform Engineering" produce a 55-char slug).
