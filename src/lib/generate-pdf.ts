import jsPDF from "jspdf";
import type { PdfMetadata } from "@/types";
import { stripLetterHeader } from "@/lib/clean-markdown";

// Layout constants (mm, A4 = 210 x 297)
const PAGE_W = 210;
const PAGE_H = 297;
const HEADER_H = 18; // dark bar height
const LEFT_W = 68; // left column width
const GAP = 5; // gap between columns
const RIGHT_X = LEFT_W + GAP; // right column starts here
const RIGHT_W = PAGE_W - RIGHT_X - 8; // right column usable width
const PAD_X = 7; // left padding inside left column
const BODY_FS_DEFAULT = 9.5;
const LINE_H_FACTOR = 0.55; // mm per pt of font size (line height ≈ font * factor)
const PARA_GAP = 3; // extra mm between paragraphs

// Common English words that should never appear as a job title / company name
const STOP_WORDS = new Set([
  "same", "this", "that", "there", "here", "where", "when", "which", "what",
  "the", "a", "an", "my", "your", "our", "their", "its", "new", "old",
]);

function isValidMeta(value: string | undefined): value is string {
  if (!value || value.trim().length < 3) return false;
  return !STOP_WORDS.has(value.trim().toLowerCase());
}

export function downloadPdf(
  text: string,
  metadata: PdfMetadata = {},
  filename?: string
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const { candidateName, companyName, phone, email, address } = metadata;

  // Strip bold markers and any header block the model may have included
  const strippedText = stripLetterHeader(text).replace(/\*\*([^*]+)\*\*/g, "$1");
  const rawParagraphs = strippedText.split(/\n\s*\n/);
  const paragraphs = rawParagraphs.map((p) => p.trim().replace(/\n/g, " ")).filter(Boolean);

  // ── Auto-scale: find the largest font that fits all body text in one page ──
  const contentStartY = HEADER_H + 10;
  const maxY = PAGE_H - 12;
  const availableH = maxY - contentStartY;

  let bodyFs = BODY_FS_DEFAULT;
  doc.setFont("helvetica", "normal");
  for (let attempt = 0; attempt < 8 && bodyFs >= 6.5; attempt++) {
    doc.setFontSize(bodyFs);
    let totalH = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      const lines: string[] = doc.splitTextToSize(paragraphs[i], RIGHT_W);
      totalH += lines.length * (bodyFs * LINE_H_FACTOR);
      if (i < paragraphs.length - 1) totalH += PARA_GAP;
    }
    if (totalH <= availableH) break;
    bodyFs -= 0.5;
  }

  const lineH = bodyFs * LINE_H_FACTOR;

  // ── Dark header bar ─────────────────────────────────────────────────────────
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");

  // ── Light gray left background ───────────────────────────────────────────────
  doc.setFillColor(240, 240, 240);
  doc.rect(0, HEADER_H, LEFT_W, PAGE_H - HEADER_H, "F");

  // ── Left column content ──────────────────────────────────────────────────────
  const leftColW = LEFT_W - PAD_X * 2;
  let leftY = HEADER_H + 10;

  if (isValidMeta(candidateName)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(26, 26, 26);
    const nameLines: string[] = doc.splitTextToSize(candidateName, leftColW);
    doc.text(nameLines, PAD_X, leftY);
    leftY += nameLines.length * 6.5 + 2;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);

  if (phone) {
    doc.text(phone, PAD_X, leftY);
    leftY += 4.5;
  }

  if (email) {
    const emailLines: string[] = doc.splitTextToSize(email, leftColW);
    doc.text(emailLines, PAD_X, leftY);
    leftY += emailLines.length * 4.5;
  }

  if (address) {
    const addrLines: string[] = doc.splitTextToSize(address, leftColW);
    doc.text(addrLines, PAD_X, leftY);
    leftY += addrLines.length * 4.5;
  }

  // Date
  leftY += 9;
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text(date, PAD_X, leftY);
  leftY += 5.5;

  if (isValidMeta(companyName)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(26, 26, 26);
    const coLines: string[] = doc.splitTextToSize(companyName, leftColW);
    doc.text(coLines, PAD_X, leftY);
  }

  // ── Right column: letter body ────────────────────────────────────────────────
  let rightY = contentStartY;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(bodyFs);
  doc.setTextColor(30, 30, 30);

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const lines: string[] = doc.splitTextToSize(paragraphs[pIdx], RIGHT_W);

    for (let i = 0; i < lines.length; i++) {
      if (rightY + lineH > maxY) break; // stay within one page
      const isLast = i === lines.length - 1;
      doc.text(lines[i], RIGHT_X, rightY, { align: isLast ? "left" : "justify", maxWidth: RIGHT_W });
      rightY += lineH;
    }

    if (pIdx < paragraphs.length - 1) {
      rightY += PARA_GAP;
    }
  }

  doc.save(filename ?? "cover-letter.pdf");
}
