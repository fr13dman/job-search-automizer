import jsPDF from "jspdf";
import { stripNonBoldMarkdown, stripCuratedMarkers } from "@/lib/clean-markdown";

type TextSegment = { text: string; bold: boolean };

function parseInlineBold(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      segments.push({ text: part.slice(2, -2), bold: true });
    } else {
      segments.push({ text: part.replace(/\*\*/g, ""), bold: false });
    }
  }
  return segments;
}

// Layout constants (mm, A4)
const STRIPE_W = 7; // orange left stripe width
const CONTENT_X = STRIPE_W + 6; // where content starts
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_TOP = 10;
const MARGIN_RIGHT = 10;
const MAX_W = PAGE_W - CONTENT_X - MARGIN_RIGHT;
const MARGIN_BOTTOM = 12;

const ORANGE_R = 197;
const ORANGE_G = 90;
const ORANGE_B = 17;

const HEADING_FS = 10;
const BODY_FS = 8.5;
const NAME_FS = 20;
const CONTACT_FS = 8;
const LINE_H_HEADING = 5.5;
const LINE_H_BODY = 4.5;
const LINE_H_NAME = 9;
const LINE_H_CONTACT = 5;
const BULLET_INDENT = 4;
const BLANK_SP = 2;

function drawOrangeStripe(doc: jsPDF) {
  doc.setFillColor(ORANGE_R, ORANGE_G, ORANGE_B);
  doc.rect(0, 0, STRIPE_W, PAGE_H, "F");
}

function buildResumeDoc(resumeText: string): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawOrangeStripe(doc);

  const lines = stripNonBoldMarkdown(stripCuratedMarkers(resumeText)).split("\n");
  let y = MARGIN_TOP;
  const maxY = PAGE_H - MARGIN_BOTTOM;

  let headerLinesRendered = 0;
  let firstSectionSeen = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      y += BLANK_SP;
      continue;
    }

    // ALL CAPS section heading
    if (trimmed.length > 2 && /[A-Za-z]/.test(trimmed) && trimmed === trimmed.toUpperCase()) {
      firstSectionSeen = true;

      if (y + LINE_H_HEADING > maxY) {
        doc.addPage();
        drawOrangeStripe(doc);
        y = MARGIN_TOP;
      }

      y += 2; // extra breathing room before heading

      doc.setFont("helvetica", "bold");
      doc.setFontSize(HEADING_FS);
      doc.setTextColor(26, 26, 26);
      doc.text(trimmed, CONTENT_X, y);
      y += LINE_H_HEADING;

      // Orange underline
      doc.setDrawColor(ORANGE_R, ORANGE_G, ORANGE_B);
      doc.setLineWidth(0.5);
      doc.line(CONTENT_X, y - 1, PAGE_W - MARGIN_RIGHT, y - 1);
      y += 2;
      continue;
    }

    // Bullet
    if (trimmed.startsWith("•") || trimmed.startsWith("-") || /^\*\s/.test(trimmed)) {
      const bulletText = trimmed.slice(1).trim();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(BODY_FS);
      const segments = parseInlineBold(bulletText);

      if (segments.some((s) => s.bold)) {
        if (y + LINE_H_BODY > maxY) {
          doc.addPage();
          drawOrangeStripe(doc);
          y = MARGIN_TOP;
        }
        // Orange bullet marker
        doc.setTextColor(ORANGE_R, ORANGE_G, ORANGE_B);
        doc.text("•", CONTENT_X, y);
        doc.setTextColor(60, 60, 60);
        let x = CONTENT_X + BULLET_INDENT;
        for (const seg of segments) {
          doc.setFont("helvetica", seg.bold ? "bold" : "normal");
          doc.text(seg.text, x, y);
          x += doc.getTextWidth(seg.text);
        }
        y += LINE_H_BODY;
      } else {
        const cleanBullet = segments.map((s) => s.text).join("");
        const wrappedLines: string[] = doc.splitTextToSize(cleanBullet, MAX_W - BULLET_INDENT);
        for (let i = 0; i < wrappedLines.length; i++) {
          if (y + LINE_H_BODY > maxY) {
            doc.addPage();
            drawOrangeStripe(doc);
            y = MARGIN_TOP;
          }
          if (i === 0) {
            doc.setTextColor(ORANGE_R, ORANGE_G, ORANGE_B);
            doc.text("•", CONTENT_X, y);
            doc.setTextColor(60, 60, 60);
            doc.text(wrappedLines[i], CONTENT_X + BULLET_INDENT, y);
          } else {
            doc.setTextColor(60, 60, 60);
            doc.text(wrappedLines[i], CONTENT_X + BULLET_INDENT, y);
          }
          y += LINE_H_BODY;
        }
      }
      continue;
    }

    // Name (first non-empty line before any section heading)
    if (!firstSectionSeen && headerLinesRendered === 0) {
      const cleanName = trimmed.replace(/\*\*/g, "");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(NAME_FS);
      doc.setTextColor(26, 26, 26);
      const nameWrapped: string[] = doc.splitTextToSize(cleanName, MAX_W);
      for (const nl of nameWrapped) {
        if (y + LINE_H_NAME > maxY) {
          doc.addPage();
          drawOrangeStripe(doc);
          y = MARGIN_TOP;
        }
        doc.text(nl, CONTENT_X, y);
        y += LINE_H_NAME;
      }
      headerLinesRendered++;
      continue;
    }

    // Contact line (second line before any section heading)
    if (!firstSectionSeen && headerLinesRendered === 1) {
      const cleanContact = trimmed.replace(/\*\*/g, "");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(CONTACT_FS);
      doc.setTextColor(100, 100, 100);
      const contactWrapped: string[] = doc.splitTextToSize(cleanContact, MAX_W);
      for (const cl of contactWrapped) {
        if (y + LINE_H_CONTACT > maxY) {
          doc.addPage();
          drawOrangeStripe(doc);
          y = MARGIN_TOP;
        }
        doc.text(cl, CONTENT_X, y);
        y += LINE_H_CONTACT;
      }
      y += 3; // spacing after contact
      headerLinesRendered++;
      continue;
    }

    // Regular body text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_FS);
    const segments = parseInlineBold(trimmed);

    if (segments.some((s) => s.bold)) {
      if (y + LINE_H_BODY > maxY) {
        doc.addPage();
        drawOrangeStripe(doc);
        y = MARGIN_TOP;
      }
      let x = CONTENT_X;
      for (const seg of segments) {
        doc.setFont("helvetica", seg.bold ? "bold" : "normal");
        doc.setTextColor(50, 50, 50);
        doc.text(seg.text, x, y);
        x += doc.getTextWidth(seg.text);
      }
      y += LINE_H_BODY;
    } else {
      const cleanText = segments.map((s) => s.text).join("");
      const wrappedLines: string[] = doc.splitTextToSize(cleanText, MAX_W);
      for (const wl of wrappedLines) {
        if (y + LINE_H_BODY > maxY) {
          doc.addPage();
          drawOrangeStripe(doc);
          y = MARGIN_TOP;
        }
        doc.setTextColor(50, 50, 50);
        doc.text(wl, CONTENT_X, y);
        y += LINE_H_BODY;
      }
    }
  }

  return doc;
}

export async function downloadResumePdf(
  resumeText: string,
  filename = "curated-resume.pdf"
): Promise<void> {
  buildResumeDoc(resumeText).save(filename);
}

export function getResumePdfBlob(resumeText: string): Blob {
  return buildResumeDoc(resumeText).output("blob") as Blob;
}
