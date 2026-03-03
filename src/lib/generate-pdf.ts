import jsPDF from "jspdf";
import type { PdfMetadata } from "@/types";

const MARGIN = 25;
const BODY_FONT_SIZE = 11;
const LINE_HEIGHT = 6;
const PARAGRAPH_SPACING = 4;

export function downloadPdf(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  metadata: PdfMetadata = {},
  filename?: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - MARGIN * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxY = pageHeight - MARGIN;

  let y = MARGIN;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_FONT_SIZE);
  doc.setTextColor(0, 0, 0);

  // Strip all bold markers — cover letter body renders as plain text
  const strippedText = text.replace(/\*\*([^*]+)\*\*/g, "$1");

  const rawParagraphs = strippedText.split(/\n\s*\n/);

  for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
    // Collapse internal newlines (e.g. single line-breaks within a paragraph)
    const paragraph = rawParagraphs[pIdx].trim().replace(/\n/g, " ");
    if (!paragraph) continue;

    const lines: string[] = doc.splitTextToSize(paragraph, maxWidth);

    for (let i = 0; i < lines.length; i++) {
      if (y + LINE_HEIGHT > maxY) {
        doc.addPage();
        y = MARGIN;
      }
      // Justify all lines except the last of each paragraph
      const isLastLine = i === lines.length - 1;
      doc.text(lines[i], MARGIN, y, {
        align: isLastLine ? "left" : "justify",
        maxWidth,
      });
      y += LINE_HEIGHT;
    }

    if (pIdx < rawParagraphs.length - 1) {
      y += PARAGRAPH_SPACING;
    }
  }

  doc.save(filename ?? "cover-letter.pdf");
}
