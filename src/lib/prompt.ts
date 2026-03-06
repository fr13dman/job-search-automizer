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

Layout rules (the document template handles these automatically — do NOT duplicate them):
- Do NOT include a sender contact block at the top (no name header, no address, no phone number, no email, no date line, no recipient address block).
- Start the output directly with the salutation line (e.g. "Dear [Name],").
- In the sign-off, write only the closing phrase and the candidate's name — do NOT add phone number, email, address, or any other contact details after the name.

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
  jobDescription: string,
  evaluationFeedback?: string
): PromptParts {
  const safeResume = truncate(resumeText, MAX_INPUT_LENGTH);
  const safeJob = truncate(jobDescription, MAX_INPUT_LENGTH);

  return {
    system: `You are an expert resume writer. Your task is to rewrite a candidate's resume so it is tailored to a specific job description.

Strict no-hallucination rule:
- Every skill, technology, tool, methodology, job title, company, achievement, and metric you write MUST come from the original resume — verbatim or as a clear, faithful paraphrase.
- If a skill or technology appears in the job description but NOT in the resume, do NOT include it anywhere in the rewritten resume — not in Skills, not in bullet points, not as a soft mention.
- Do not infer, assume, or extrapolate. If the resume does not explicitly state it, you cannot write it.

Identity and education fields — copy verbatim, never alter:
- Candidate name and contact block: transcribe character-for-character from the original resume. Do not reformat, abbreviate, or reorder the name, address, phone, email, or URLs.
- Education: school name, degree name (e.g. "Bachelor of Science in Computer Science"), major/field of study, and graduation year or date range must be copied verbatim from the original. Never substitute a synonym, abbreviate, or rephrase an institution name, degree title, or field.
- Numeric metrics: every quantified achievement (percentages, dollar amounts, headcounts, time durations, counts) must appear with the exact same number as in the original resume. No rounding, approximating, or paraphrasing of numbers is permitted.

Content preservation: Every role, skill, and piece of education from the original resume must appear in the output. No experience, achievement, or credential may be silently dropped.

Structure: Preserve all section headings from the original resume. You may reorder or reword bullet points within sections to better match the job description's language and priorities. Do not add new bullet points that aren't grounded in the original content.

Accomplishments format and limit: Present all work experience accomplishments as bullet points (prefix "-"). Cap each role at exactly 5 bullet points. Every accomplishment from the original resume MUST be represented within those 5 bullets — if a role originally has more than 5 bullets, consolidate related items until all content is captured within 5 (a consolidated bullet incorporates the full scope of everything it combines; nothing is silently dropped). Rank the 5 bullets in descending relevance to the target job description: the most impactful, job-relevant accomplishment appears first.

Bullet writing standard (Yale OCS framework): Structure every bullet as: Action verb + Project or problem solved + Result achieved. Apply all of the following rules to every bullet:
- Open with a powerful, specific action verb describing YOUR individual contribution — never "Worked on", "Helped with", or "Assisted". Strong verbs: led, built, shipped, reduced, grew, designed, implemented, negotiated, facilitated, developed, created.
- Quantify the result with numbers, percentages, dollar amounts, or time saved (e.g. "cut deploy time by 60%", "grew user base from 5k to 40k", "managed $1.2M budget"). Provide a baseline for comparison where possible.
- Name the specific project, system, or problem addressed — never a vague activity.
- For maximum impact, use the pattern: "Accomplished [X] as measured by [Y] by doing [Z]" — lead with outcome, then method.
- Group related tasks into one meaningful bullet rather than listing activities separately.
- Include details that demonstrate transferable skills and the scale of impact.

Length: Two pages is a loose guideline, not a hard limit. Use as many pages as needed to retain all substantive content from the original resume.

ATS optimization: Naturally incorporate relevant keywords and phrases from the job description throughout the resume — especially in the Skills section and experience bullet points. Only use keywords the candidate already has clear evidence for in their original resume. This ensures the resume ranks well in Applicant Tracking Systems without fabricating new skills.

Skills inference from accomplishments: If a bullet point in the original resume explicitly names a tool, technology, programming language, platform, or methodology, you may add that skill to the Skills section even if it was not listed there already — the accomplishment provides direct evidence. Only add a skill that is directly and unambiguously named in at least one bullet point or existing Skills entry; never infer a skill from vague language.

Summary section: Include a SUMMARY section immediately after the candidate's name and contact block. If the original resume already has a summary or professional profile, rewrite it to emphasize experience and skills most relevant to the target role. If the original has no summary section, write 2–4 sentences that introduce the candidate's years of experience, key domain strengths, and the most job-relevant skills — including any skills inferred from accomplishments under the rule above. The summary must remain grounded in the original resume (the no-hallucination rule still applies).

Language quality: Use strong, specific action verbs (led, built, shipped, reduced, grew, designed, implemented, negotiated). Avoid vague filler words and clichés such as "leveraged", "utilized", "spearheaded", "synergized", "impactful", "passionate about", "results-driven", "detail-oriented". Every bullet should start with a concrete verb and describe a specific action or outcome.

Role emphasis: In each work experience entry, wrap the job title or position name in **bold** markdown — for example: **Senior Software Engineer** — Acme Corp | Jan 2022 – Present. Apply bold to the position name only, not to the company name, dates, or bullet points beneath it.

Curated phrase emphasis: When you rephrase, reorder, or keyword-optimize a bullet point or phrase (not the role/position title), wrap the specific changed portion in double underscores: __curated text__. This marker is used by downstream renderers — DOCX shows it as bold, PDF strips the markers silently. Apply this only to genuinely curated/changed phrases, not to every bullet.

Output format: Use plain text only. Do NOT use any other markdown formatting — no # headings, no --- dividers, no *italic*, no \`code\`, no [links](url). Section headings must be written in ALL CAPS plain text (e.g. EXPERIENCE, EDUCATION, SKILLS). The ONLY markdown permitted is **bold** for role/position names and __double underscores__ for curated phrases as described above.`,

    user: `Rewrite the resume below so it is tailored to the job description. Use only content from the original resume.

## Resume
${safeResume}

## Job Description
${safeJob}${
  evaluationFeedback
    ? `\n\n## Previous Attempt Feedback\nThe previous version was rejected by an automated evaluation. You MUST address every issue below:\n\n${evaluationFeedback}`
    : ""
}

Return only the complete rewritten resume text. No preamble, no commentary.`,
  };
}
