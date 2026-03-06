import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  HeightRule,
  convertInchesToTwip,
} from "docx";
import type { PdfMetadata } from "@/types";
import { stripLetterHeader } from "@/lib/clean-markdown";

const DARK_HEADER = "1A1A1A";
const LIGHT_BG = "F0F0F0";
const TEXT_DARK = "1A1A1A";
const TEXT_GRAY = "767676";

// Common English words that should never appear as job title / company name
const STOP_WORDS = new Set([
  "same", "this", "that", "there", "here", "where", "when", "which", "what",
  "the", "a", "an", "my", "your", "our", "their", "its", "new", "old",
]);

function isValidMeta(value: string | undefined): value is string {
  if (!value || value.trim().length < 3) return false;
  return !STOP_WORDS.has(value.trim().toLowerCase());
}

// Twip helpers
const mm = (n: number) => Math.round(n * 56.69);
const inch = convertInchesToTwip;

function cellNoBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none };
}

function tableNoBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
}

function makeRuns(text: string, opts: { bold?: boolean; color?: string; size?: number } = {}): TextRun[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => {
      const isBold = part.startsWith("**") && part.endsWith("**");
      const cleanText = isBold ? part.slice(2, -2) : part.replace(/\*\*/g, "");
      return new TextRun({ text: cleanText, bold: isBold || !!opts.bold, color: opts.color, size: opts.size });
    });
}

export async function downloadDocx(
  text: string,
  metadata: PdfMetadata,
  filename = "cover-letter.docx"
): Promise<void> {
  const { candidateName, companyName, phone, email, address } = metadata;
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // ── Left column ─────────────────────────────────────────────────────────────
  const leftChildren: Paragraph[] = [];

  if (isValidMeta(candidateName)) {
    leftChildren.push(
      new Paragraph({
        children: [new TextRun({ text: candidateName, bold: true, size: 44, color: TEXT_DARK })],
        spacing: { after: 80 },
      })
    );
  }

  if (phone) {
    leftChildren.push(
      new Paragraph({
        children: [new TextRun({ text: phone, size: 18, color: TEXT_GRAY })],
        spacing: { after: 40 },
      })
    );
  }

  if (email) {
    leftChildren.push(
      new Paragraph({
        children: [new TextRun({ text: email, size: 18, color: TEXT_GRAY })],
        spacing: { after: 40 },
      })
    );
  }

  if (address) {
    leftChildren.push(
      new Paragraph({
        children: [new TextRun({ text: address, size: 18, color: TEXT_GRAY })],
        spacing: { after: 40 },
      })
    );
  }

  // Spacer before date
  leftChildren.push(new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 280 } }));

  leftChildren.push(
    new Paragraph({
      children: [new TextRun({ text: date, size: 18, color: TEXT_DARK })],
      spacing: { after: 100 },
    })
  );

  if (isValidMeta(companyName)) {
    leftChildren.push(
      new Paragraph({
        children: [new TextRun({ text: companyName, bold: true, size: 18, color: TEXT_DARK })],
      })
    );
  }

  // ── Right column (letter body) ───────────────────────────────────────────────
  // Strip any header block the model may have included before "Dear ..."
  const bodyText = stripLetterHeader(text);
  const rightChildren: Paragraph[] = bodyText.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return new Paragraph({ spacing: { after: 60 } });
    return new Paragraph({
      children: makeRuns(trimmed),
      spacing: { after: 80 },
    });
  });

  const nb = tableNoBorders();
  const cnb = cellNoBorders();

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: nb,
    rows: [
      // Dark header bar (two same-colored cells side by side)
      new TableRow({
        height: { value: mm(14), rule: HeightRule.EXACT },
        children: [
          new TableCell({
            width: { size: 36, type: WidthType.PERCENTAGE },
            shading: { fill: DARK_HEADER, type: ShadingType.CLEAR, color: "auto" },
            borders: cnb,
            children: [new Paragraph({ children: [new TextRun({ text: " " })] })],
          }),
          new TableCell({
            width: { size: 64, type: WidthType.PERCENTAGE },
            shading: { fill: DARK_HEADER, type: ShadingType.CLEAR, color: "auto" },
            borders: cnb,
            children: [new Paragraph({ children: [new TextRun({ text: " " })] })],
          }),
        ],
      }),
      // Content row
      new TableRow({
        children: [
          new TableCell({
            width: { size: 36, type: WidthType.PERCENTAGE },
            shading: { fill: LIGHT_BG, type: ShadingType.CLEAR, color: "auto" },
            borders: cnb,
            margins: {
              top: inch(0.2),
              left: inch(0.2),
              bottom: inch(0.2),
              right: inch(0.15),
            },
            children: leftChildren,
          }),
          new TableCell({
            width: { size: 64, type: WidthType.PERCENTAGE },
            borders: cnb,
            margins: {
              top: inch(0.2),
              left: inch(0.2),
              bottom: inch(0.2),
              right: inch(0.2),
            },
            children: rightChildren,
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: inch(0.35),
              right: inch(0.35),
              bottom: inch(0.35),
              left: inch(0.35),
            },
          },
        },
        children: [table],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
