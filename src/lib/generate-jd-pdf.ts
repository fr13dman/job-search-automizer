import jsPDF from "jspdf";
import type { PdfMetadata } from "@/types";

// Layout (mm, A4 = 210 x 297)
const PAGE_W = 210;
const PAGE_H = 297;
const HEADER_H = 16;
const CONTENT_X = 14;
const CONTENT_W = PAGE_W - CONTENT_X * 2;
const MARGIN_BOTTOM = 14;
const BODY_FS = 9;
const BODY_LINE_H = 4.8;
const PARA_GAP = 2.5;

/**
 * Replace characters outside Helvetica's Latin-1 range so jsPDF doesn't
 * silently produce blank lines for non-renderable codepoints.
 */
function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02BC]/g, "'")   // smart single quotes
    .replace(/[\u201C\u201D]/g, '"')           // smart double quotes
    .replace(/[\u2013\u2014\u2015]/g, "-")     // en-dash, em-dash, horizontal bar
    .replace(/\u2022/g, "*")                   // bullet •
    .replace(/\u2026/g, "...")                 // ellipsis …
    .replace(/\u00A0/g, " ")                   // non-breaking space
    .replace(/[^\x00-\xFF]/g, " ");            // anything else beyond Latin-1 → space
}

/**
 * Split the (potentially collapsed) body text into readable paragraphs.
 * Handles both preserved-newline text and fully-collapsed single-line text.
 */
function makeParagraphs(text: string): string[] {
  // If the text retains double-newline paragraph boundaries, honour them.
  if (/\n\n/.test(text)) {
    return text.split(/\n\n+/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
  }

  // Text is a single collapsed line — split at sentence boundaries and
  // group 3 sentences per paragraph for legibility.
  const sentences = text.match(/[^.!?]*[.!?]+/g) ?? [];

  if (sentences.length === 0) {
    // No sentence punctuation — fall back to ~200-char word-boundary chunks.
    const words = text.split(/\s+/);
    const paras: string[] = [];
    let current = "";
    for (const word of words) {
      if (current.length + word.length > 200) {
        if (current) paras.push(current.trim());
        current = word;
      } else {
        current += (current ? " " : "") + word;
      }
    }
    if (current) paras.push(current.trim());
    return paras;
  }

  const paras: string[] = [];
  const SENTENCES_PER_PARA = 3;
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARA) {
    const para = sentences.slice(i, i + SENTENCES_PER_PARA).join("").trim();
    if (para) paras.push(para);
  }
  return paras;
}

export function getJdPdfBlob(
  jobDescription: string,
  metadata: PdfMetadata,
  sourceUrl?: string
): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // ── Dark header bar ────────────────────────────────────────────────────────
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");

  // "Job Description" label left-aligned in header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("Job Description", CONTENT_X, HEADER_H / 2 + 2);

  // ── Info bar: source URL + date (right-aligned, below header) ─────────────
  let y = HEADER_H + 5;

  if (sourceUrl) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(50, 90, 160);
    const displayUrl = sourceUrl.length > 90 ? sourceUrl.slice(0, 87) + "..." : sourceUrl;
    doc.text(displayUrl, PAGE_W - CONTENT_X, y, { align: "right" });
    y += 4.5;
  }

  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(130, 130, 130);
  doc.text(`Saved: ${dateStr}`, PAGE_W - CONTENT_X, y, { align: "right" });
  y += 4;

  // ── Full-width dark separator ──────────────────────────────────────────────
  y += 2;
  doc.setDrawColor(26, 26, 26);
  doc.setLineWidth(0.5);
  doc.line(CONTENT_X, y, PAGE_W - CONTENT_X, y);
  y += 8;

  // ── Centered job title ─────────────────────────────────────────────────────
  if (metadata.jobTitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(26, 26, 26);
    const titleLines: string[] = doc.splitTextToSize(sanitize(metadata.jobTitle), CONTENT_W - 20);
    for (const tl of titleLines) {
      doc.text(tl, PAGE_W / 2, y, { align: "center" });
      y += 8;
    }
  }

  // Company name centered
  if (metadata.companyName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(sanitize(metadata.companyName), PAGE_W / 2, y, { align: "center" });
    y += 7;
  }

  // Thin light separator below title block
  y += 1;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(CONTENT_X, y, PAGE_W - CONTENT_X, y);
  y += 8;

  // ── Body text ──────────────────────────────────────────────────────────────
  // Strip the "Job Title: …\nCompany: …\n\n" header we prepended during scraping
  // (it is already displayed above) so we don't duplicate it in the body.
  let bodyText = jobDescription
    .replace(/^(Job Title:[^\n]*\n)?(Company:[^\n]*\n)?(Location:[^\n]*\n)*\n*/i, "")
    .trim();
  bodyText = sanitize(bodyText);

  const paragraphs = makeParagraphs(bodyText);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_FS);
  doc.setTextColor(45, 45, 45);

  const maxY = PAGE_H - MARGIN_BOTTOM;

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    // Call splitTextToSize on each paragraph separately — avoids jsPDF silent
    // failures that occur when the input string is extremely long (>8 KB).
    const lines: string[] = doc.splitTextToSize(paragraphs[pIdx], CONTENT_W);

    for (const line of lines) {
      if (!line.trim()) continue;
      if (y + BODY_LINE_H > maxY) {
        doc.addPage();
        // Thin continuation header
        doc.setFillColor(26, 26, 26);
        doc.rect(0, 0, PAGE_W, 5, "F");
        y = 11;
        // Restore font after page break
        doc.setFont("helvetica", "normal");
        doc.setFontSize(BODY_FS);
        doc.setTextColor(45, 45, 45);
      }
      doc.text(line, CONTENT_X, y);
      y += BODY_LINE_H;
    }

    if (pIdx < paragraphs.length - 1) {
      y += PARA_GAP;
    }
  }

  return doc.output("blob") as Blob;
}
