import { extractResumeSections } from "./extract-resume-sections";

export interface RestorationResult {
  text: string;
  restorations: string[]; // descriptions of what was restored (for logging)
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Extract the content lines of the education section from the original resume.
// Capped at maxLines to prevent oversized injection when heading detection misses
// a boundary in an unusually formatted original resume.
function extractOriginalEducationContent(
  originalResume: string,
  maxLines = 20
): string[] {
  const lines = originalResume.split("\n");
  const eduLineIdx = lines.findIndex(
    (line) =>
      /\beducation\b/i.test(line.trim()) ||
      /\bacademic background\b/i.test(line.trim())
  );
  if (eduLineIdx === -1) return [];

  // Minimal heading detector for the original resume (handles common formats)
  const isHeading = (line: string): boolean => {
    const t = line.trim();
    if (!t) return false;
    if (t.length >= 3 && /^[A-Z][A-Z\s&,]+$/.test(t)) return true;
    const low = t.toLowerCase().replace(/:$/, "").trim();
    return [
      "experience", "education", "skills", "summary", "profile", "objective",
      "work history", "employment history", "professional experience",
      "certifications", "projects", "languages", "publications", "awards",
      "volunteer", "references", "interests", "leadership", "training",
    ].includes(low);
  };

  const contentLines: string[] = [];
  for (
    let i = eduLineIdx + 1;
    i < lines.length && contentLines.length < maxLines;
    i++
  ) {
    if (isHeading(lines[i])) break;
    contentLines.push(lines[i]);
  }

  // Trim trailing blank lines
  while (
    contentLines.length > 0 &&
    !contentLines[contentLines.length - 1].trim()
  ) {
    contentLines.pop();
  }

  return contentLines;
}

export function restoreProtectedFields(
  curatedResume: string,
  originalResume: string
): RestorationResult {
  const { contactBlock } = extractResumeSections(originalResume);
  const { contactBlock: curatedContact } = extractResumeSections(curatedResume);

  let text = curatedResume;
  const restorations: string[] = [];

  // --- Contact block restoration ---
  // Safety guard: if the original resume's section headings weren't recognised,
  // contactBlock = entire original resume. Real contact blocks never contain bullet
  // points or work date ranges — if either is present, section detection failed.
  const contactLines = contactBlock.split("\n").filter((l) => l.trim());
  const hasBullets = contactLines.some((l) => /^[-•*]/.test(l.trim()));
  const hasWorkDateRange =
    /\b(19|20)\d{2}\s*[-–—]\s*((19|20)\d{2}|Present|current)/i.test(
      contactBlock
    );
  const contactLooksValid =
    contactLines.length <= 12 && !hasBullets && !hasWorkDateRange;

  if (
    contactBlock &&
    contactLooksValid &&
    curatedContact &&
    normalizeWhitespace(contactBlock) !== normalizeWhitespace(curatedContact)
  ) {
    const idx = text.indexOf(curatedContact);
    if (idx !== -1) {
      text =
        text.slice(0, idx) +
        contactBlock +
        text.slice(idx + curatedContact.length);
      restorations.push("Restored name/contact block from original resume");
    }
  }

  // --- Education section restoration ---
  // Deterministically replace the curated EDUCATION section with content from the
  // original resume. This eliminates education as a source of hallucinations entirely.
  //
  // The curated resume always uses ALL-CAPS section headers (enforced by system prompt),
  // so finding and bounding the EDUCATION section in the curated output is reliable.
  // The extraction from the original is line-capped (20 lines) so that missing heading
  // detection on an unusually formatted original cannot cause bloat.
  const originalEduContent = extractOriginalEducationContent(originalResume);
  if (originalEduContent.length > 0) {
    const curatedLines = text.split("\n");
    const eduStartIdx = curatedLines.findIndex((line) =>
      /^EDUCATION\b/i.test(line.trim())
    );
    if (eduStartIdx !== -1) {
      // Find the next ALL-CAPS section heading after EDUCATION in the curated resume
      const eduEndIdx = curatedLines.findIndex(
        (line, idx) =>
          idx > eduStartIdx &&
          line.trim().length >= 3 &&
          /^[A-Z][A-Z\s&,]+$/.test(line.trim())
      );

      const before = curatedLines.slice(0, eduStartIdx + 1); // includes "EDUCATION" line
      const after = eduEndIdx !== -1 ? curatedLines.slice(eduEndIdx) : [];
      const newLines = [
        ...before,
        ...originalEduContent,
        ...(after.length > 0 ? [""] : []),
        ...after,
      ];
      const newText = newLines.join("\n");
      if (newText !== text) {
        text = newText;
        restorations.push(
          "Restored EDUCATION section verbatim from original resume"
        );
      }
    }
  }

  return { text, restorations };
}
