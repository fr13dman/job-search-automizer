import type { PromptParts } from "@/types";

const MAX_INPUT_LENGTH = 8_000;

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "... [truncated]";
}

export function buildPrompt(
  resumeText: string,
  jobDescription: string
): PromptParts {
  const safeResume = truncate(resumeText, MAX_INPUT_LENGTH);
  const safeJob = truncate(jobDescription, MAX_INPUT_LENGTH);

  return {
    system: `You are an expert career coach and professional writer. Your task is to write a compelling, tailored cover letter.

Guidelines:
- Write in a professional but personable tone
- Highlight relevant experience from the resume that matches the job requirements
- Be specific about why the candidate is a great fit
- Keep the letter concise (3-4 paragraphs)
- Do not fabricate experience or skills not found in the resume
- Format as a proper cover letter with greeting and sign-off
- Use the candidate's name from the resume if available`,

    user: `Write a tailored cover letter based on the following:

## Resume
${safeResume}

## Job Description
${safeJob}

Please write a professional cover letter that connects the candidate's experience to this specific role.`,
  };
}
