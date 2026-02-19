import jsPDF from "jspdf";
import type { PdfMetadata } from "@/types";

const MARGIN = 25;
const BODY_FONT_SIZE = 11;
const HEADER_FONT_SIZE = 18;
const SUB_HEADER_FONT_SIZE = 10;
const LINE_HEIGHT = 6;
const PARAGRAPH_SPACING = 4;

export function downloadPdf(
  text: string,
  metadata: PdfMetadata = {},
  filename?: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - MARGIN * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxY = pageHeight - MARGIN;

  let y = MARGIN;

  // --- Header ---
  if (metadata.candidateName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(HEADER_FONT_SIZE);
    doc.text(metadata.candidateName, MARGIN, y);
    y += 8;
  }

  // Sub-header line: role + company + date
  const dateParts: string[] = [];
  if (metadata.jobTitle) dateParts.push(metadata.jobTitle);
  if (metadata.companyName) dateParts.push(metadata.companyName);
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  dateParts.push(dateStr);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(SUB_HEADER_FONT_SIZE);
  doc.setTextColor(100, 100, 100);
  doc.text(dateParts.join("  |  "), MARGIN, y);
  y += 6;

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 10;

  // Reset text color for body
  doc.setTextColor(0, 0, 0);

  // --- Body ---
  // Split text into paragraphs by double newlines or single newlines
  const rawParagraphs = text.split(/\n\s*\n/);

  for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
    const paragraph = rawParagraphs[pIdx].trim();
    if (!paragraph) continue;

    // Split paragraph into bold/normal segments
    const segments = paragraph.split(/(\*\*[^*]+\*\*)/g);

    for (const segment of segments) {
      if (!segment) continue;
      const isBold = segment.startsWith("**") && segment.endsWith("**");
      const cleanText = isBold ? segment.slice(2, -2) : segment;

      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setFontSize(BODY_FONT_SIZE);

      const lines: string[] = doc.splitTextToSize(cleanText, maxWidth);

      for (const line of lines) {
        if (y + LINE_HEIGHT > maxY) {
          doc.addPage();
          y = MARGIN;
        }
        doc.text(line, MARGIN, y, { align: "left", maxWidth });
        y += LINE_HEIGHT;
      }
    }

    // Add paragraph spacing (except after last paragraph)
    if (pIdx < rawParagraphs.length - 1) {
      y += PARAGRAPH_SPACING;
    }
  }

  const resolvedFilename = filename ?? "cover-letter.pdf";
  doc.save(resolvedFilename);
}
