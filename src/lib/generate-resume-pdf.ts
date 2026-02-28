import jsPDF from "jspdf";

type TextSegment = { text: string; bold: boolean };

function parseInlineBold(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      segments.push({ text: part.slice(2, -2), bold: true });
    } else {
      // Strip any bare ** that weren't part of a matched bold pair
      segments.push({ text: part.replace(/\*\*/g, ""), bold: false });
    }
  }
  return segments;
}

// Narrow margins + compact font sizing to ensure content fits in 2 A4 pages
const MARGIN = 12; // mm — was 20
const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297; // A4 mm
const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2; // 186 mm usable width
const HEADING_FONT_SIZE = 10; // pt — was 12
const BODY_FONT_SIZE = 8.5; // pt — was 10
const LINE_HEIGHT_HEADING = 5; // mm — was 7
const LINE_HEIGHT_BODY = 4.5; // mm — was 5.5
const BULLET_INDENT = 4; // mm — was 5
const BLANK_LINE_SPACING = 2; // mm — was 3

export async function downloadResumePdf(
  resumeText: string,
  filename = "curated-resume.pdf"
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const lines = resumeText.split("\n");
  let y = MARGIN;
  const maxY = PAGE_HEIGHT - MARGIN;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      y += BLANK_LINE_SPACING;
      continue;
    }

    // ALL CAPS section heading: length > 2, contains a letter, all uppercase
    if (
      trimmed.length > 2 &&
      /[A-Za-z]/.test(trimmed) &&
      trimmed === trimmed.toUpperCase()
    ) {
      if (y + LINE_HEIGHT_HEADING > maxY) {
        doc.addPage();
        y = MARGIN;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(HEADING_FONT_SIZE);
      doc.text(trimmed, MARGIN, y);
      y += LINE_HEIGHT_HEADING;

      // Thin divider under heading
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y - 1, PAGE_WIDTH - MARGIN, y - 1);
      y += 1.5;
      continue;
    }

    // Bullet point (•, -, or * followed by space — not **bold**)
    if (
      trimmed.startsWith("•") ||
      trimmed.startsWith("-") ||
      /^\*\s/.test(trimmed)
    ) {
      const bulletText = trimmed.slice(1).trim();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(BODY_FONT_SIZE);
      const bulletSegments = parseInlineBold(bulletText);
      if (bulletSegments.some((s) => s.bold)) {
        if (y + LINE_HEIGHT_BODY > maxY) {
          doc.addPage();
          y = MARGIN;
        }
        doc.text("•", MARGIN, y);
        let x = MARGIN + BULLET_INDENT;
        for (const seg of bulletSegments) {
          doc.setFont("helvetica", seg.bold ? "bold" : "normal");
          doc.text(seg.text, x, y);
          x += doc.getTextWidth(seg.text);
        }
        y += LINE_HEIGHT_BODY;
      } else {
        const cleanBulletText = bulletSegments.map((s) => s.text).join("");
        const wrappedLines: string[] = doc.splitTextToSize(
          cleanBulletText,
          MAX_WIDTH - BULLET_INDENT
        );
        for (let i = 0; i < wrappedLines.length; i++) {
          if (y + LINE_HEIGHT_BODY > maxY) {
            doc.addPage();
            y = MARGIN;
          }
          if (i === 0) {
            doc.text("•", MARGIN, y);
            doc.text(wrappedLines[i], MARGIN + BULLET_INDENT, y);
          } else {
            doc.text(wrappedLines[i], MARGIN + BULLET_INDENT, y);
          }
          y += LINE_HEIGHT_BODY;
        }
      }
      continue;
    }

    // Normal text (name, contact info, role titles, dates, etc.)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_FONT_SIZE);
    const segments = parseInlineBold(trimmed);
    if (segments.some((s) => s.bold)) {
      // Inline bold: render each segment with correct font, advancing x position
      if (y + LINE_HEIGHT_BODY > maxY) {
        doc.addPage();
        y = MARGIN;
      }
      let x = MARGIN;
      for (const seg of segments) {
        doc.setFont("helvetica", seg.bold ? "bold" : "normal");
        doc.text(seg.text, x, y);
        x += doc.getTextWidth(seg.text);
      }
      y += LINE_HEIGHT_BODY;
    } else {
      // Use stripped text so any stray ** don't appear in output
      const cleanText = segments.map((s) => s.text).join("");
      const wrappedLines: string[] = doc.splitTextToSize(cleanText, MAX_WIDTH);
      for (const wl of wrappedLines) {
        if (y + LINE_HEIGHT_BODY > maxY) {
          doc.addPage();
          y = MARGIN;
        }
        doc.text(wl, MARGIN, y);
        y += LINE_HEIGHT_BODY;
      }
    }
  }

  doc.save(filename);
}
