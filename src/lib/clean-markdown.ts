/**
 * Strip any letter header block that precedes the salutation ("Dear ...").
 * The template renders sender contact info and date in its own left panel, so
 * those lines must not appear in the right-column letter body.
 * Also strips trailing phone/email lines from the sign-off block.
 */
export function stripLetterHeader(text: string): string {
  const lines = text.split("\n");

  // Find the first salutation line
  const dearIdx = lines.findIndex((l) => /^\s*dear[\s,]/i.test(l.trim()));
  if (dearIdx > 0) {
    // Drop everything before "Dear ..."
    return lines.slice(dearIdx).join("\n").trimStart();
  }

  // If no "Dear" found (unusual), strip leading lines that look like contact info:
  // phone numbers, email addresses, or pure address/date lines.
  const contactRe = /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/i;
  let start = 0;
  while (start < lines.length && (contactRe.test(lines[start]) || lines[start].trim() === "")) {
    start++;
  }
  return lines.slice(start).join("\n").trimStart();
}

/**
 * Strip __curated text__ double-underscore markers while preserving the inner text.
 * Used before PDF rendering so curated phrases appear as plain text.
 */
export function stripCuratedMarkers(text: string): string {
  return text.replace(/__([^_\n]+)__/g, "$1");
}

/**
 * Strip common markdown syntax from resume text while preserving **bold** markers
 * (which are used for role/position emphasis and handled by the renderers).
 */
export function stripNonBoldMarkdown(text: string): string {
  return (
    text
      // Remove heading markers: # ## ### etc. at start of line
      .replace(/^#{1,6}\s+/gm, "")
      // Remove horizontal rules: ---, ***, ___ on their own line
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Remove single-asterisk italic (*text*) — negative look-around avoids **bold**
      .replace(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, "$1")
      // Remove underscore italic (_text_)
      .replace(/(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_)/g, "$1")
      // Remove inline code (`text`)
      .replace(/`([^`\n]+)`/g, "$1")
      // Remove markdown links [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove blockquote markers
      .replace(/^>\s*/gm, "")
      // Collapse runs of 3+ blank lines down to 2
      .replace(/\n{3,}/g, "\n\n")
  );
}
