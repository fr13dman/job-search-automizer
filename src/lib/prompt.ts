import type { PromptParts, Tone } from "@/types";

const MAX_INPUT_LENGTH = 8_000;

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  professional:
    "Use a polished, formal tone. Maintain composure and authority while remaining personable.",
  friendly:
    "Use a warm, approachable tone. Write as if having a genuine conversation while staying professional.",
  concise:
    "Use a direct, no-fluff tone. Every sentence should earn its place. Favor short, punchy sentences.",
  enthusiastic:
    "Use an energetic, passionate tone. Show genuine excitement about the role and company.",
  confident:
    "Use a bold, assertive tone. Lead with impact statements. Show conviction in the candidate's value.",
};

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "... [truncated]";
}

export function buildPrompt(
  resumeText: string,
  jobDescription: string,
  tone: Tone = "professional",
  additionalInstructions?: string
): PromptParts {
  const safeResume = truncate(resumeText, MAX_INPUT_LENGTH);
  const safeJob = truncate(jobDescription, MAX_INPUT_LENGTH);

  const additionalSection = additionalInstructions?.trim()
    ? `\n\n## Additional Instructions\n${additionalInstructions.trim()}`
    : "";

  return {
    system: `You are an expert career coach and professional writer. Your task is to write a compelling, tailored cover letter.

Tone: ${TONE_INSTRUCTIONS[tone]}

Writing rules:
- Write like a real person, not a template. Avoid clichés like "I am writing to express my interest" or "I believe I would be a great fit."
- Target a Flesch reading ease score above 80: use short sentences, common words, and active voice. Prefer one-syllable words when possible.
- Keep the letter under 500 words total.
- Use 3-4 short paragraphs. Open with a hook, not a generic statement.
- Do not fabricate experience or skills not found in the resume.
- Use the candidate's name from the resume if available.
- Format as a proper cover letter with greeting and sign-off.

Emphasis formatting:
- Wrap the single most impactful narrative or achievement in **bold** using markdown syntax.
- Bold should highlight a specific result, metric, or story — not generic phrases.
- Use bold sparingly: at most 1-2 bold phrases in the entire letter.`,

    user: `Write a tailored cover letter based on the following:

## Resume
${safeResume}

## Job Description
${safeJob}${additionalSection}

Write the cover letter now. Remember: under 500 words, simple language, ${tone} tone, and bold the most impactful narrative.`,
  };
}

export function buildRecommendationsPrompt(
  resumeText: string,
  jobDescription: string
): PromptParts {
  const safeResume = truncate(resumeText, MAX_INPUT_LENGTH);
  const safeJob = truncate(jobDescription, MAX_INPUT_LENGTH);

  return {
    system: `You are an expert resume coach. Given a resume and a job description, identify specific, concrete improvements the candidate should make to their resume to better match the role. Return exactly 5–8 bullet points. Each bullet should name the specific section to update and what to change or add. Be direct and specific. Do not fabricate skills or experience not implied by the resume.`,

    user: `Review the resume below against the job description and return 5–8 bullet points of specific, actionable improvements.

## Resume
${safeResume}

## Job Description
${safeJob}

Return only the bullet points. No preamble, no summary.`,
  };
}
