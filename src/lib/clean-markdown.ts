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
