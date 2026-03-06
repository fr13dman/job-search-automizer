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
  // Try cover letter FIRST when available. Claude's generated text reliably names the
  // job title in structured phrases. Scraped JD text is unreliable: ATS pages
  // (Greenhouse, Lever, etc.) prepend navigation text ("Back to jobs") and location
  // lists that corrupt first-line extraction.
  if (coverLetter) {
    const clPatterns = [
      // "for the Software Engineer position" / "for the Software Engineer role"
      /for\s+the\s+([A-Z][A-Za-z /()-]+?)\s+(?:position|role|opening|opportunity)/i,
      // "the Software Engineer position" (without "for")
      /\bthe\s+([A-Z][A-Za-z /()-]+?)\s+(?:position|role|opening|opportunity)\b/i,
      // "role of Senior Developer" / "position of Lead Engineer"
      /(?:role|position)\s+(?:of|as)\s+(?:a\s+|an\s+)?([A-Z][A-Za-z /()-]+?)(?:\s+(?:at|with|for|,|\.))/i,
      // "as a Software Engineer at/to/in/..."  — extended stop words cover more Claude phrasings
      /as\s+(?:a\s+|an\s+|your\s+(?:next\s+)?)?([A-Z][A-Za-z /()-]+?)(?:\s+(?:at|with|for|to|in|on|,|\.|\band\b|\bwho\b|\bwhere\b|\bresponsible\b))/i,
      // "applying for Software Engineer" / "interest in the Software Engineer"
      /(?:applying\s+for|interest\s+in)\s+(?:the\s+)?([A-Z][A-Za-z /()-]+?)(?:\s+(?:position|role|opening|opportunity|at|with))/i,
    ];
    for (const pattern of clPatterns) {
      const match = coverLetter.match(pattern);
      if (match) {
        const title = match[1].trim();
        if (title.length >= 3 && title.length <= 60) return title;
      }
    }
  }

  // JD fallback — strip common ATS navigation prefixes before pattern matching.
  // Greenhouse, Lever, etc. embed "← Back to jobs" links inside <main> which
  // Cheerio extracts as text, corrupting first-line extraction.
  const cleanJD = jobDescription
    .replace(/^[←→\s]*back\s+to\s+jobs?\s*/i, "")
    .trim();

  const jdPatterns = [
    // "Job Title: Software Engineer" or "Position: Senior Developer"
    // Commas are valid in titles ("Director, Engineering") — only \n stops the match.
    /(?:job\s+title|position|role)\s*[:]\s*([^\n|·•]+)/i,
    // First line of multi-line JD (e.g. copy-pasted text with newlines)
    /^([A-Z][A-Za-z /,()-]+)(?=\n)/,
    // First segment before · • – — separators used in scraped single-line text
    // (NOT | which appears in location lists: "United States | Canada | UK")
    /^([A-Z][A-Za-z /,()-]+?)(?:\s*[·•–—]|$)/,
  ];

  for (const pattern of jdPatterns) {
    const match = cleanJD.match(pattern);
    if (match) {
      const title = match[1].trim();
      if (title.length >= 3 && title.length <= 60) return title;
    }
  }

  return undefined;
}

/**
 * Extract phone, email, and location/address from the top of a resume.
 * Scans only the first 10 lines (the contact block) to avoid false positives.
 */
export function extractContactInfo(resumeText: string): {
  phone?: string;
  email?: string;
  address?: string;
} {
  const lines = resumeText.split("\n").slice(0, 10);
  const block = lines.join("\n");

  const email = block.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];

  const phone = block.match(
    /(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/
  )?.[0];

  // Look for a city/state line: e.g. "San Francisco, CA" or "New York, NY 10001"
  // or a full street address line containing a digit-prefixed number
  let address: string | undefined;
  for (const line of lines) {
    const trimmed = line.trim();
    // City, ST or City, ST 00000
    if (/^[A-Za-z\s]+,\s*[A-Z]{2}(\s+\d{5})?$/.test(trimmed)) {
      address = trimmed;
      break;
    }
    // Street address: starts with digits (e.g. "123 Main Street")
    if (/^\d+\s+[A-Za-z]/.test(trimmed) && trimmed.length < 80) {
      address = trimmed;
      break;
    }
  }

  return { email, phone, address };
}

export function extractMetadata(
  coverLetter: string,
  jobDescription: string,
  resumeText = ""
): PdfMetadata {
  const metadata: PdfMetadata = {};

  metadata.candidateName = extractCandidateName(coverLetter);
  metadata.companyName = extractCompanyName(coverLetter, jobDescription);
  metadata.jobTitle = extractJobTitle(coverLetter, jobDescription);

  if (resumeText) {
    const contact = extractContactInfo(resumeText);
    metadata.phone = contact.phone;
    metadata.email = contact.email;
    metadata.address = contact.address;
  }

  return metadata;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Build a filename for the curated resume using company and job title.
 * Format: {company}-{job-title}-resume  (no extension)
 */
const MAX_FILENAME_LENGTH = 45;

export function buildResumeFilename(_resumeText: string, jobDescription: string): string {
  const companyName = extractCompanyName("", jobDescription);
  const jobTitle = extractJobTitle("", jobDescription);

  const parts: string[] = [];
  if (companyName) parts.push(slugify(companyName));
  if (jobTitle) parts.push(slugify(jobTitle));
  parts.push("resume");

  const full = parts.join("-");
  if (full.length > MAX_FILENAME_LENGTH && companyName) {
    return `${slugify(companyName)}-resume`;
  }
  return full;
}

function buildCoverLetterBasename(metadata: PdfMetadata): string {
  const parts: string[] = [];
  if (metadata.companyName) parts.push(slugify(metadata.companyName));
  if (metadata.jobTitle) parts.push(slugify(metadata.jobTitle));
  parts.push("cover-letter");
  const full = parts.join("-");
  if (full.length > MAX_FILENAME_LENGTH && metadata.companyName) {
    return `${slugify(metadata.companyName)}-cover-letter`;
  }
  return full;
}

export function buildPdfFilename(metadata: PdfMetadata): string {
  return buildCoverLetterBasename(metadata) + ".pdf";
}

export function buildCoverLetterDocxFilename(metadata: PdfMetadata): string {
  return buildCoverLetterBasename(metadata) + ".docx";
}
