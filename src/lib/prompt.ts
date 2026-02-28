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
- Use the candidate's name from the resume if available.
- Format as a proper cover letter with greeting and sign-off.

Strict no-hallucination rule:
- Every skill, technology, tool, methodology, job title, company, achievement, and metric you mention MUST appear verbatim or as a clear paraphrase of something explicitly stated in the provided resume.
- If a skill or technology is mentioned in the job description but NOT in the resume, do NOT include it — not even as an aspiration or soft mention.
- Do not infer, assume, or extrapolate capabilities. If the resume does not say it, you cannot say it.

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

export function buildCurateResumePrompt(
  resumeText: string,
  jobDescription: string
): PromptParts {
  const safeResume = truncate(resumeText, MAX_INPUT_LENGTH);
  const safeJob = truncate(jobDescription, MAX_INPUT_LENGTH);

  return {
    system: `You are an expert resume writer. Your task is to rewrite a candidate's resume so it is tailored to a specific job description.

Strict no-hallucination rule:
- Every skill, technology, tool, methodology, job title, company, achievement, and metric you write MUST come from the original resume — verbatim or as a clear, faithful paraphrase.
- If a skill or technology appears in the job description but NOT in the resume, do NOT include it anywhere in the rewritten resume — not in Skills, not in bullet points, not as a soft mention.
- Do not infer, assume, or extrapolate. If the resume does not explicitly state it, you cannot write it.

Content preservation: Your top priority is to keep every role, bullet point, achievement, skill, and piece of education from the original resume. Do not remove, merge, or shorten any bullet unless it is a verbatim duplicate of another. A complete resume that runs longer than 2 pages is far better than a shorter one that omits impact. Never cut a bullet to save space.

Structure: Preserve all section headings from the original resume. You may reorder or reword bullet points within sections to better match the job description's language and priorities. Do not add new bullet points that aren't grounded in the original content.

Length: Two pages is a loose guideline, not a hard limit. Use as many pages as needed to retain all substantive content from the original resume.

ATS optimization: Naturally incorporate relevant keywords and phrases from the job description throughout the resume — especially in the Skills section and experience bullet points. Only use keywords the candidate already has clear evidence for in their original resume. This ensures the resume ranks well in Applicant Tracking Systems without fabricating new skills.

Role emphasis: In each work experience entry, wrap the job title or position name in **bold** markdown — for example: **Senior Software Engineer** — Acme Corp | Jan 2022 – Present. Apply bold to the position name only, not to the company name, dates, or bullet points beneath it.`,

    user: `Rewrite the resume below so it is tailored to the job description. Use only content from the original resume.

## Resume
${safeResume}

## Job Description
${safeJob}

Return only the complete rewritten resume text. No preamble, no commentary.`,
  };
}
