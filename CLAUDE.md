# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Change Summary Requirement

Before making any code changes, always provide a concise summary of what will be changed:
- Which files will be modified or created
- What each change does and why
- Any risks or trade-offs

## Commands

- `npm run dev` — start Next.js dev server (localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run test` — run all tests once (vitest)
- `npm run test:watch` — run tests in watch mode
- `npx vitest run src/lib/__tests__/scrape-job.test.ts` — run a single test file

## Architecture

This is a **Next.js 16 App Router** application that generates tailored cover letters and curated resumes using Claude AI. Single-page app with six API routes.

### Data Flow

**Cover Letter:**
1. User provides a job posting URL → **`/api/scrape`** fetches HTML and extracts text via Cheerio (`src/lib/scrape-job.ts`)
2. User uploads a resume (PDF/DOCX) → **`/api/parse-resume`** extracts text via pdf-parse or mammoth (`src/lib/parse-resume.ts`)
3. User selects a tone and clicks generate → **`/api/generate`** streams a cover letter from `claude-sonnet-4-5-20250929` using Vercel AI SDK (`@ai-sdk/anthropic` + `ai` `streamText`)
4. Output is editable, can be copied (markdown bold stripped) or exported as a styled PDF via jsPDF (`src/lib/generate-pdf.ts`) or DOCX via docx (`src/lib/generate-docx.ts`)

**Resume Curation (agentic loop):**
1. **`/api/curate-resume`** — Claude rewrites the resume tailored to the job, using `__curated text__` double-underscore markers around AI-added content
2. Client calls `restoreProtectedFields()` (`src/lib/restore-protected-fields.ts`) — deterministically replaces the curated contact block and EDUCATION section with verbatim originals, before evaluation
3. **`/api/evaluate-resume`** — Claude scores the curated resume for ATS fit, keyword matches, hallucinations, etc., returning a `ResumeEvaluation` JSON object; client also runs `checkNumericFidelity()` (`src/lib/check-numeric-fidelity.ts`) to catch changed metrics and merges findings into `hallucinationDetails`
4. The client (`src/components/curated-resume.tsx`) runs up to 3 attempts: curate → restore → evaluate → if score < threshold, curate again with feedback → repeat
5. Final resume exports as PDF (`src/lib/generate-resume-pdf.ts`) or DOCX (`src/lib/generate-resume-docx.ts`)
6. **`/api/save-documents`** — saves base64-encoded PDFs to a local folder path (expanded from `ROOT_FOLDER` env var); also exports the JD as a PDF via `src/lib/generate-jd-pdf.ts`

### Key Conventions

- **Streaming**: The generate endpoint uses `streamText` → `toTextStreamResponse()`. The client uses `useCompletion` from `@ai-sdk/react` with `streamProtocol: "text"`.
- **Prompt engineering**: All prompt logic lives in `src/lib/prompt.ts` — system prompt + user prompt built from `buildPrompt()`. Inputs are truncated to 8,000 chars.
- **Bold formatting**: The AI outputs `**bold**` markdown for key achievements. This is rendered as highlighted `<mark>` tags in preview, rendered as bold in PDF, and stripped on clipboard copy.
- **Curated markers**: The resume curation prompt uses `__curated text__` double-underscore markers. `stripCuratedMarkers` in `src/lib/clean-markdown.ts` strips them for PDF; `inlineBoldRuns` in `src/lib/generate-docx.ts` renders them as bold in DOCX.
- **PDF metadata extraction**: `src/lib/extract-metadata.ts` uses regex patterns to pull candidate name, company name, and job title from the cover letter and job description to build the PDF filename and header. Filename formats: `{company}-{position}-cover-letter.{ext}` and `{company}-{position}-resume`.
- **Hallucination hardening**: After each curation, `restoreProtectedFields()` (`src/lib/restore-protected-fields.ts`) deterministically replaces the contact block and EDUCATION section in the curated output with verbatim content from the original resume. `checkNumericFidelity()` (`src/lib/check-numeric-fidelity.ts`) extracts numeric tokens from the original (normalising K/M/B/MM, commas, `$`) and verifies all are present in the curated text; mismatches are merged into `hallucinationDetails` on the `ResumeEvaluation`. Both use `src/lib/extract-resume-sections.ts` to identify section boundaries.
- **Types**: Shared types in `src/types/index.ts` — `Tone`, `ScrapeResult`, `ParseResumeResult`, `GenerateRequest`, `PdfMetadata`, `ResumeEvaluation`, `AttemptRecord`.
- **UI components**: shadcn/ui primitives in `src/components/ui/`, app components directly in `src/components/`.

### Test Setup

- Vitest with `jsdom` environment by default for component tests
- `environmentMatchGlobs` switches to `node` environment for `src/lib/__tests__/` and `src/app/api/__tests__/`
- Test setup file: `src/test-setup.ts`
- Tests co-located in `__tests__/` directories next to source files
- **Known pre-existing failures**: `src/app/api/__tests__/parse-resume-route.test.ts` has 3 tests that fail unrelated to recent features — do not treat as regressions

### Notable Config

- `pdf-parse` is listed in `next.config.ts` `serverExternalPackages` — required to prevent Next.js from bundling it (it uses native bindings).

### Environment Variables

- `ANTHROPIC_API_KEY` — required for `/api/generate`, `/api/curate-resume`, `/api/evaluate-resume`, `/api/company-info`, and `/api/company-info-deep` (used by `@ai-sdk/anthropic`)
- `ROOT_FOLDER` — optional; default save-to-disk root directory surfaced by `GET /api/save-documents` and used as the base path for the "Save to folder" feature (supports `~` expansion)
- `TAVILY_API_KEY` — optional; enables web search in `/api/company-info-deep` (Tavily AI search API). Without this key the deep research endpoint falls back to Jina Reader only.
- `JINA_API_KEY` — optional; increases Jina Reader rate limits in `/api/company-info-deep`. The endpoint works without it at lower throughput.

## Vercel Deployment

### Deploying

```bash
vercel build --prod   # build locally into .vercel/output
vercel deploy --prebuilt --prod  # upload pre-built artifacts
```

### `npm error Invalid Version:` on Vercel build servers

Vercel's remote build servers use an older npm version that can fail with `npm error Invalid Version:` (no version string after the colon) immediately during `npm install`. This has been observed when the dependency tree contains packages whose version strings are incompatible with that npm version.

**Diagnosis steps:**
1. Run `vercel build --prod` locally — if it succeeds, the code is fine and the issue is Vercel's npm version
2. Check recently added packages in `package.json` for anything pulling in large dependency trees (e.g. CLI tools mistakenly listed in `dependencies` instead of `devDependencies`)
3. Never list `vercel` in production `dependencies` — it pulls in ~100 packages and has been confirmed to trigger this error

**Workaround:** Build locally and deploy pre-built artifacts to bypass Vercel's `npm install` entirely:
```bash
vercel build --prod && vercel deploy --prebuilt --prod
```
