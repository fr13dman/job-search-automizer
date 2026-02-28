import type { PdfMetadata } from "@/types";

/**
 * Extract the candidate name from the cover letter sign-off.
 */
function extractCandidateName(coverLetter: string): string | undefined {
  // Match sign-off patterns: "Sincerely,\nJohn Doe", "Best regards,\n**Jane Smith**", etc.
  const signOffMatch = coverLetter.match(
    /(?:sincerely|regards|respectfully|best|warmly|cheers|thanks|thank you)[,.]?\s*\n+\s*\**([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)\**\s*$/im
  );
  return signOffMatch?.[1]?.trim();
}

/**
 * Extract the company name from the job description first, then fall back to cover letter.
 */
function extractCompanyName(coverLetter: string, jobDescription: string): string | undefined {
  // Try job description first — often has "Company: X" or "About X" or "X is hiring"
  const jdPatterns = [
    // "Company: Acme Corp" or "Company Name: Acme Corp"
    /company(?:\s+name)?\s*[:]\s*([^\n,]+)/i,
    // "About Acme Corp" at start of line
    /^about\s+([A-Z][A-Za-z0-9&'. -]+?)(?:\s*\n|$)/im,
    // "Acme Corp is hiring" / "Acme Corp is looking" / "Acme Corp is seeking"
    /^([A-Z][A-Za-z0-9&'. -]+?)\s+is\s+(?:hiring|looking|seeking|searching)/im,
    // "at Acme Corp" in job description
    /\bat\s+([A-Z][A-Za-z0-9&'.]+(?:\s+[A-Z][A-Za-z0-9&'.]+){0,3})\b/,
  ];

  for (const pattern of jdPatterns) {
    const match = jobDescription.match(pattern);
    if (match) {
      const name = match[1].trim();
      // Skip generic words that aren't company names
      if (name.length > 1 && !/^(The|A|An|Our|This|We|You)$/i.test(name)) {
        return name;
      }
    }
  }

  // Fall back to cover letter patterns
  const clPatterns = [
    // "Dear [Hiring Manager at] Acme Corp" or "Dear Acme Corp Team"
    /dear\s+(?:.*?\s+at\s+)?([A-Z][A-Za-z0-9&'. -]+?)(?:\s+(?:team|hiring|recruitment))/i,
    // "at Acme Corp," / "at Acme Corp." / "at Acme Corp as" / "at Acme Corp in" etc.
    /\b(?:at|join|joining)\s+(?:the\s+)?([A-Z][A-Za-z0-9&'.]+(?:\s+[A-Z][A-Za-z0-9&'.]+){0,3})(?:\s*[,.]|\s+(?:team|as|in|for|is|has|and|where|to|I|that|this|with))/,
    // "to Acme Corp" in "contribute to Acme Corp" etc.
    /(?:contribute|contributing)\s+to\s+([A-Z][A-Za-z0-9&'.]+(?:\s+[A-Z][A-Za-z0-9&'.]+){0,3})/,
    // "working at Acme Corp" / "work at Acme Corp"
    /work(?:ing)?\s+(?:at|for|with)\s+([A-Z][A-Za-z0-9&'.]+(?:\s+[A-Z][A-Za-z0-9&'.]+){0,3})/,
  ];

  for (const pattern of clPatterns) {
    const match = coverLetter.match(pattern);
    if (match) {
      const name = match[1].trim();
      if (name.length > 1 && !/^(The|A|An|Our|This|We|You)$/i.test(name)) {
        return name;
      }
    }
  }

  return undefined;
}

/**
 * Extract job title from job description first, then fall back to cover letter.
 */
function extractJobTitle(coverLetter: string, jobDescription: string): string | undefined {
  // Try job description first
  const jdPatterns = [
    // "Job Title: Software Engineer" or "Position: Senior Developer"
    /(?:job\s+title|position|role)\s*[:]\s*([^\n]+)/i,
    // First line of JD is often the title (if short enough)
    /^([A-Z][A-Za-z /,()-]+)(?:\n|$)/,
  ];

  for (const pattern of jdPatterns) {
    const match = jobDescription.match(pattern);
    if (match) {
      const title = match[1].trim();
      // Must look like a job title (not too long, not too short)
      if (title.length >= 3 && title.length <= 60) {
        return title;
      }
    }
  }

  // Fall back to cover letter patterns
  const clPatterns = [
    // "for the Software Engineer position" / "for the Software Engineer role"
    /for\s+the\s+([A-Z][A-Za-z /()-]+?)\s+(?:position|role|opening|opportunity)/i,
    // "role of Senior Developer" / "position of Lead Engineer"
    /(?:role|position)\s+(?:of|as)\s+(?:a\s+|an\s+)?([A-Z][A-Za-z /()-]+?)(?:\s+(?:at|with|for|,|\.))/i,
    // "as a Software Engineer" / "as your next Senior Developer"
    /as\s+(?:a\s+|an\s+|your\s+(?:next\s+)?)?([A-Z][A-Za-z /()-]+?)(?:\s+(?:at|with|for|,|\.|\band\b))/i,
    // "applying for Software Engineer" / "interest in the Software Engineer"
    /(?:applying\s+for|interest\s+in)\s+(?:the\s+)?([A-Z][A-Za-z /()-]+?)(?:\s+(?:position|role|opening|opportunity|at|with))/i,
  ];

  for (const pattern of clPatterns) {
    const match = coverLetter.match(pattern);
    if (match) {
      const title = match[1].trim();
      if (title.length >= 3 && title.length <= 60) {
        return title;
      }
    }
  }

  return undefined;
}

export function extractMetadata(
  coverLetter: string,
  jobDescription: string
): PdfMetadata {
  const metadata: PdfMetadata = {};

  metadata.candidateName = extractCandidateName(coverLetter);
  metadata.companyName = extractCompanyName(coverLetter, jobDescription);
  metadata.jobTitle = extractJobTitle(coverLetter, jobDescription);

  return metadata;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Build a filename for the curated resume using candidate name, job title, and company.
 * Format: {candidate-name}-{job-title}-{company}-resume  (no extension)
 */
export function buildResumeFilename(resumeText: string, jobDescription: string): string {
  // Candidate name: first non-empty line that starts with a letter and is not an ALL-CAPS heading
  const nameLine =
    resumeText
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0 && /^[A-Za-z]/.test(l) && l !== l.toUpperCase()) ?? "";
  const candidateName = nameLine.replace(/[^a-zA-Z0-9 '-]+/g, "").trim();

  const companyName = extractCompanyName("", jobDescription);
  const jobTitle = extractJobTitle("", jobDescription);

  const parts: string[] = [];
  if (candidateName) parts.push(slugify(candidateName));
  if (jobTitle) parts.push(slugify(jobTitle));
  if (companyName) parts.push(slugify(companyName));
  parts.push("resume");

  return parts.join("-");
}

export function buildPdfFilename(metadata: PdfMetadata): string {
  const year = new Date().getFullYear();
  const parts: string[] = ["Cover-Letter"];

  if (metadata.companyName) {
    parts.push(metadata.companyName.replace(/[^a-zA-Z0-9]+/g, "-"));
  }

  if (metadata.jobTitle) {
    parts.push(metadata.jobTitle.replace(/[^a-zA-Z0-9]+/g, "-"));
  }

  parts.push(String(year));

  return parts.join("_") + ".pdf";
}
