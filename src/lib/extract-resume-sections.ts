export interface ResumeSections {
  contactBlock: string; // text before the first section heading
  educationBlock: string; // text of the education section
}

const HEADING_KEYWORDS = [
  // Core sections
  "experience",
  "education",
  "skills",
  "summary",
  "profile",
  "objective",
  // Work experience variants
  "work history",
  "employment history",
  "professional experience",
  "additional experience",
  "relevant experience",
  // Education variants
  "academic background",
  "academic history",
  // Skills variants
  "technical skills",
  "core competencies",
  "competencies",
  "key skills",
  "areas of expertise",
  // Projects
  "projects",
  "project experience",
  "personal projects",
  "open source",
  // Credentials
  "certifications",
  "licenses",
  "licenses and certifications",
  "credentials",
  // Other standard sections
  "languages",
  "publications",
  "research",
  "awards",
  "honors",
  "achievements",
  "volunteer",
  "volunteer experience",
  "community service",
  "references",
  "interests",
  "activities",
  "leadership",
  "leadership experience",
  "training",
  "courses",
  "coursework",
  "professional development",
  "additional information",
  "about me",
];

function isSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // ALL CAPS line ≥ 3 chars (letters, spaces, & and ,)
  if (trimmed.length >= 3 && /^[A-Z][A-Z\s&,]+$/.test(trimmed)) return true;

  // Common title-case headings (case-insensitive, with optional trailing colon)
  const stripped = trimmed.toLowerCase().replace(/:$/, "").trim();
  if (HEADING_KEYWORDS.includes(stripped)) return true;

  // Line ending in : that starts with an uppercase letter (e.g. "Education:", "Skills:")
  if (trimmed.endsWith(":") && /^[A-Z]/.test(trimmed)) return true;

  return false;
}

export function extractResumeSections(resumeText: string): ResumeSections {
  const lines = resumeText.split("\n");

  // Contact block: lines from the top until the first section heading
  let firstHeadingIdx = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (isSectionHeading(lines[i])) {
      firstHeadingIdx = i;
      break;
    }
  }
  const contactBlock = lines.slice(0, firstHeadingIdx).join("\n").trim();

  // Education block: lines from the EDUCATION heading until the next heading
  let eduStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      /\bEDUCATION\b/i.test(trimmed) ||
      /\bAcademic Background\b/i.test(trimmed)
    ) {
      eduStartIdx = i;
      break;
    }
  }

  let educationBlock = "";
  if (eduStartIdx >= 0) {
    let eduEndIdx = lines.length;
    for (let i = eduStartIdx + 1; i < lines.length; i++) {
      if (isSectionHeading(lines[i])) {
        eduEndIdx = i;
        break;
      }
    }
    educationBlock = lines.slice(eduStartIdx, eduEndIdx).join("\n").trim();
  }

  return { contactBlock, educationBlock };
}
