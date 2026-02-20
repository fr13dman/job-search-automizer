# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Next.js dev server (localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run test` — run all tests once (vitest)
- `npm run test:watch` — run tests in watch mode
- `npx vitest run src/lib/__tests__/scrape-job.test.ts` — run a single test file

## Architecture

This is a **Next.js 16 App Router** application that generates tailored cover letters using Claude AI. Single-page app with three API routes.

### Data Flow

1. User provides a job posting URL → **`/api/scrape`** fetches HTML and extracts text via Cheerio (`src/lib/scrape-job.ts`)
2. User uploads a resume (PDF/DOCX) → **`/api/parse-resume`** extracts text via pdf-parse or mammoth (`src/lib/parse-resume.ts`)
3. User selects a tone and clicks generate → **`/api/generate`** streams a cover letter from Claude Sonnet using Vercel AI SDK (`@ai-sdk/anthropic` + `ai` `streamText`)
4. Output is editable, can be copied (markdown bold stripped) or exported as a styled PDF via jsPDF (`src/lib/generate-pdf.ts`)

### Key Conventions

- **Streaming**: The generate endpoint uses `streamText` → `toTextStreamResponse()`. The client uses `useCompletion` from `@ai-sdk/react` with `streamProtocol: "text"`.
- **Prompt engineering**: All prompt logic lives in `src/lib/prompt.ts` — system prompt + user prompt built from `buildPrompt()`. Inputs are truncated to 8,000 chars.
- **Bold formatting**: The AI outputs `**bold**` markdown for key achievements. This is rendered as highlighted `<mark>` tags in preview, rendered as bold in PDF, and stripped on clipboard copy.
- **PDF metadata extraction**: `src/lib/extract-metadata.ts` uses regex patterns to pull candidate name, company name, and job title from the cover letter and job description to build the PDF filename and header.
- **Types**: Shared types in `src/types/index.ts` — `Tone`, `ScrapeResult`, `ParseResumeResult`, `GenerateRequest`, `PdfMetadata`.
- **UI components**: shadcn/ui primitives in `src/components/ui/`, app components directly in `src/components/`.

### Test Setup

- Vitest with `jsdom` environment by default for component tests
- `environmentMatchGlobs` switches to `node` environment for `src/lib/__tests__/` and `src/app/api/__tests__/`
- Test setup file: `src/test-setup.ts`
- Tests co-located in `__tests__/` directories next to source files

### Environment Variables

- `ANTHROPIC_API_KEY` — required for the `/api/generate` endpoint (used by `@ai-sdk/anthropic`)
